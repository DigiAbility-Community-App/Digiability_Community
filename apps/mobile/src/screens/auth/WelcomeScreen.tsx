import React, { useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Platform,
  Alert,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";

import { LinearGradient } from "expo-linear-gradient";

import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AuthStackParamList } from "@navigation/AuthNavigator";
import { login, register, checkEmailAvailability } from "@services/authService";
import { sanitizeNameInput, isValidNameFormat } from "../../utils/nameValidation";
import { sanitizeMobileInput, isValidMobileFormat } from "../../utils/mobileValidation";
import {
  evaluatePassword,
  firstPasswordError,
  FALLBACK_PASSWORD_POLICY,
  type PasswordPolicy,
} from "../../utils/passwordValidation";
import apiClient from "@services/apiClient";
import { useTheme } from "../../theme/ThemeContext";
import { AccessibleText } from "../../components/shared/AccessibleText";
import { AccessibleButton } from "../../components/shared/AccessibleButton";
import { Input } from "../../components/shared/Input";
import ScreenWrapper from "../../components/layout/ScreenWrapper";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as WebBrowser from "expo-web-browser";
import { Check } from "lucide-react-native";
import DateTimePickerModal from "react-native-modal-datetime-picker";
import {
  isOldEnough,
  latestEligibleBirthDate,
  toApiDate,
  toDisplayDate,
  MINIMUM_AGE,
} from "../../utils/ageValidation";
import { POLICY_VERSION } from "../../legal/legal-docs.generated";
import { useEffect } from "react";

// Green used for a satisfied password rule. The theme has no success colour,
// and the brand purple would read as "selected" rather than "done".
const RULE_MET_COLOR = "#1B873F";

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, "Welcome">;
};

type ApiErrorShape = {
  response?: {
    status?: number;
    data?: {
      message?: string;
      code?: string;
      banned?: boolean;
      permanent?: boolean;
      suspendedUntil?: string | null;
      reason?: string | null;
      errors?: Array<{
        field?: string;
        message?: string;
      }>;
    };
  };
};

function isUnverifiedEmailError(error: unknown): boolean {
  const res = (error as ApiErrorShape).response;
  return (
    res?.data?.code === "EMAIL_NOT_VERIFIED" ||
    (res?.status === 403 && !!res?.data?.message?.toLowerCase().includes("verify"))
  );
}

function getBanInfo(error: unknown) {
  const data = (error as ApiErrorShape).response?.data;
  if (!data?.banned) return null;
  return {
    permanent: !!data.permanent,
    suspendedUntil: data.suspendedUntil ?? null,
    reason: data.reason ?? null,
  };
}

function getApiErrorMessage(error: unknown, fallback: string) {
  const apiError = error as ApiErrorShape;
  const fieldMessage = apiError.response?.data?.errors?.[0]?.message;
  const message = apiError.response?.data?.message;

  if (fieldMessage) return fieldMessage;
  if (message) return message;
  return fallback;
}

const WelcomeScreen = ({ navigation }: Props) => {
  const { colors, spacing, highContrast, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<"SignUp" | "Login">("SignUp");

  // SignUp
  const [name, setName] = useState("");
  const [signUpEmail, setSignUpEmail] = useState("");
  // Live "already registered?" check so the user isn't told only after
  // submitting the whole form. Same shape as the username check in
  // ProfileScreen: debounced, with every early return cancelling the pending
  // timer so a stale resolve can't overwrite a newer state.
  const [emailStatus, setEmailStatus] = useState<
    "idle" | "invalid" | "checking" | "available" | "taken"
  >("idle");
  const [emailMessage, setEmailMessage] = useState("");
  const emailDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (emailDebounceRef.current) clearTimeout(emailDebounceRef.current);
    };
  }, []);

  const handleSignUpEmailChange = (value: string) => {
    setSignUpEmail(value);
    const trimmed = value.trim().toLowerCase();

    if (!trimmed) {
      if (emailDebounceRef.current) clearTimeout(emailDebounceRef.current);
      setEmailStatus("idle");
      setEmailMessage("");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      if (emailDebounceRef.current) clearTimeout(emailDebounceRef.current);
      setEmailStatus("invalid");
      setEmailMessage("Enter a valid email address");
      return;
    }

    setEmailStatus("checking");
    setEmailMessage("Checking...");

    if (emailDebounceRef.current) clearTimeout(emailDebounceRef.current);
    emailDebounceRef.current = setTimeout(async () => {
      const result = await checkEmailAvailability(trimmed);
      setEmailStatus(result.available ? "available" : "taken");
      setEmailMessage(result.message);
    }, 500);
  };

  const [signUpPassword, setSignUpPassword] = useState("");

  // Password rules are set by an admin (Settings → Password Policy) and served
  // by user-svc, so the checklist under the field always matches what the API
  // will actually enforce. Falls back to the documented defaults if the
  // request fails, so signup still works offline/degraded.
  const [passwordPolicy, setPasswordPolicy] = useState<PasswordPolicy>(FALLBACK_PASSWORD_POLICY);

  useEffect(() => {
    let cancelled = false;
    apiClient
      .get<{ success: boolean; data: PasswordPolicy }>("/api/master/password-policy")
      .then(({ data }) => {
        if (!cancelled && data.success && data.data) setPasswordPolicy(data.data);
      })
      .catch(() => {
        // keep FALLBACK_PASSWORD_POLICY
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // The checklist is only relevant while the password field is being filled
  // in, so it appears on focus and collapses again on blur rather than
  // permanently occupying space between Email and Phone Number.
  const [passwordFocused, setPasswordFocused] = useState(false);

  const passwordRules = evaluatePassword(signUpPassword, passwordPolicy);
  const [signUpPhone, setSignUpPhone] = useState("");

  // Login
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Shared
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Real checkbox, not the passive caption this used to be. Registration is
  // blocked until this is checked — see the guard in handleSignUp below.
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  // Digiability is an 18+ platform (DPDP §9). The server is the real gate;
  // collecting it here gives a clear message before submitting.
  const [dob, setDob] = useState<Date | null>(null);
  const [showDobPicker, setShowDobPicker] = useState(false);

  const clearError = () => setError(null);

  const handleTabChange = (tab: "SignUp" | "Login") => {
    clearError();
    setActiveTab(tab);
  };

  // Signup
  const handleSignUp = async () => {
    clearError();

    const trimmedName = name.trim();
    const trimmedEmail = signUpEmail.trim().toLowerCase();
    const trimmedPassword = signUpPassword.trim();

    const trimmedPhone = signUpPhone.trim();

    if (!trimmedName || !trimmedEmail || !trimmedPassword || !trimmedPhone) {
      setError("Please fill in all required fields.");
      return;
    }

    if (!isValidMobileFormat(trimmedPhone)) {
      setError("Please enter a valid 10-digit mobile number.");
      return;
    }

    if (trimmedName.length < 2) {
      setError("Name must be at least 2 characters.");
      return;
    }

    if (!isValidNameFormat(trimmedName)) {
      setError("Name may only contain letters, spaces, and single hyphens or apostrophes between name parts.");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError("Please enter a valid email address.");
      return;
    }

    // Don't submit an address the live check already flagged. "checking" is
    // also blocked so a in-flight result can't land after the request.
    if (emailStatus === "taken") {
      setError(emailMessage || "An account with this email already exists.");
      return;
    }
    if (emailStatus === "checking") {
      setError("Checking that email address, please wait…");
      return;
    }

    // Rules come from the admin-configured policy (see passwordPolicy state
    // above) so this can't drift from what the API enforces.
    const passwordError = firstPasswordError(trimmedPassword, passwordPolicy);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    if (!dob) {
      setError("Please enter your date of birth.");
      return;
    }

    if (!isOldEnough(dob)) {
      setError(`You must be ${MINIMUM_AGE} or older to use Digiability Community.`);
      return;
    }

    if (!acceptedTerms) {
      setError("Please accept the Terms of Use and Community Guidelines to continue.");
      return;
    }

    setLoading(true);

    try {
      const result = await register({
        name: trimmedName,
        email: trimmedEmail,
        password: trimmedPassword,
        phoneNo: trimmedPhone,
        acceptedTerms: true,
        policyVersion: POLICY_VERSION,
        dateOfBirth: toApiDate(dob),
      });
      // Registration no longer starts a session (the server issues tokens only
      // after the OTP is verified), so navigate to Verify Email explicitly
      // rather than relying on setAuth flipping RootNavigator to the Main stack.
      if (result.otpEmailSent === false) {
        // Account exists either way — this just tells the user not to sit
        // waiting for an email that never sent, and to use Resend instead.
        Alert.alert(
          "Account created",
          "We couldn't send the verification email right now. On the next screen, use Resend OTP to try again."
        );
      }
      navigation.navigate("VerifyEmail", { email: trimmedEmail });
    } catch (err: unknown) {
      console.error("[SignUpError]", err);
      setError(getApiErrorMessage(err, "Registration failed."));
    } finally {
      setLoading(false);
    }
  };

  // Login
  const handleLogin = async () => {
    clearError();

    if (!loginEmail.trim() || !loginPassword.trim()) {
      setError("Please enter your email and password.");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(loginEmail.trim())) {
      setError("Please enter a valid email address.");
      return;
    }

    setLoading(true);

    try {
      await login({
        email: loginEmail.trim().toLowerCase(),
        password: loginPassword,
      });
    } catch (err: unknown) {
      console.error("[LoginError]", err);
      const banInfo = getBanInfo(err);
      if (banInfo) {
        navigation.navigate("AccountSuspended", banInfo);
      } else if (isUnverifiedEmailError(err)) {
        // Account exists but email isn't verified — send them to the verify
        // screen (with resend) so they can finish signup they abandoned.
        navigation.navigate("VerifyEmail", { email: loginEmail.trim().toLowerCase() });
      } else {
        setError(getApiErrorMessage(err, "Login failed."));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenWrapper statusBarStyle="light">
      {/* HEADER */}
      <LinearGradient
        colors={highContrast ? ["#000000", "#000000"] : ["#7C3AED", "#500088"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: insets.top }]}
      >
        {/* Decorative Blur */}
        <View style={styles.topGlow} />
        <View style={styles.bottomGlow} />

        {/* Logo */}
        <View style={styles.logoContainer}>
          <View style={styles.logoShadow} />

          <View style={styles.logoBox}>
            <Image
              source={require("../../../assets/logo.png")}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>

          <AccessibleText
            variant="heroTitle"
            style={{ color: '#FFFFFF', textAlign: 'center' }}
          >
            Welcome to Digiability Community
          </AccessibleText>

          <AccessibleText variant="subtitle" style={{ color: 'rgba(255,255,255,0.8)', textAlign: 'center' }}>
            Your support network awaits
          </AccessibleText>
        </View>
      </LinearGradient>

      {/* MAIN CARD */}
      <KeyboardAwareScrollView
        style={[styles.bottomCard, { backgroundColor: colors.card }]}
        // Flat object, not an array — with enableOnAndroid this library reads
        // (contentContainerStyle || {}).paddingBottom to add its own keyboard
        // padding on top of ours; on an array that's undefined, so its
        // replacement value becomes the ONLY paddingBottom RN keeps after
        // flattening the style array, silently discarding bottomContent's.
        contentContainerStyle={{ ...styles.bottomContent, flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        enableOnAndroid={true}
        // Phone Number is the last field, right above the submit button —
        // 20 wasn't enough clearance to scroll it above the keyboard once
        // focused, so it stayed hidden behind it.
        extraScrollHeight={100}
      >
        {/* TABS */}
        <View style={styles.tabs}>
          <TouchableOpacity
            style={[
              styles.tabBtn,
              activeTab === "SignUp" && { borderBottomColor: colors.primary },
            ]}
            onPress={() => handleTabChange("SignUp")}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === "SignUp" }}
            accessibilityLabel="Sign Up Tab"
            accessibilityHint="Double tap to switch to registration form"
          >
            <AccessibleText
              variant="title"
              style={{
                color: activeTab === "SignUp" ? colors.primary : colors.subtext,
              }}
            >
              Sign Up
            </AccessibleText>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tabBtn,
              activeTab === "Login" && { borderBottomColor: colors.primary },
            ]}
            onPress={() => handleTabChange("Login")}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === "Login" }}
            accessibilityLabel="Login Tab"
            accessibilityHint="Double tap to switch to login form"
          >
            <AccessibleText
              variant="title"
              style={{
                color: activeTab === "Login" ? colors.primary : colors.subtext,
              }}
            >
              Login
            </AccessibleText>
          </TouchableOpacity>
        </View>

        {/* ERROR */}
        {error && (
          <View style={[styles.errorBanner, highContrast && { borderWidth: 2, borderColor: "#000000" }]}>
            <AccessibleText variant="body" color={colors.error} accessibilityRole="alert">
              ⚠️ {error}
            </AccessibleText>
          </View>
        )}

        {/* SIGNUP */}
        {activeTab === "SignUp" && (
          <View style={styles.form}>
            <Input
              label="Full Name"
              placeholder="Enter your full name"
              value={name}
              onChangeText={(v) => setName(sanitizeNameInput(v))}
              accessibilityHint="Enter your first and last name (letters only)"
            />

            <Input
              label="Email"
              placeholder="you@example.com"
              value={signUpEmail}
              onChangeText={handleSignUpEmailChange}
              keyboardType="email-address"
              autoCapitalize="none"
              accessibilityHint="Enter your email address"
              error={emailStatus === "taken" || emailStatus === "invalid" ? emailMessage : undefined}
            />

            {/* Availability feedback while typing — the "already registered"
                case used to surface only after submitting the whole form. */}
            {(emailStatus === "checking" || emailStatus === "available") && (
              <AccessibleText
                variant="caption"
                accessibilityLiveRegion="polite"
                style={{
                  marginTop: 0,
                  marginBottom: 4,
                  color: emailStatus === "available" ? RULE_MET_COLOR : colors.subtext,
                }}
              >
                {emailStatus === "available" ? `\u2713 ${emailMessage}` : emailMessage}
              </AccessibleText>
            )}

            <Input
              label="Password"
              placeholder={`${passwordPolicy.minLength}\u2013${passwordPolicy.maxLength} characters`}
              value={signUpPassword}
              onChangeText={setSignUpPassword}
              onFocus={() => setPasswordFocused(true)}
              onBlur={() => setPasswordFocused(false)}
              secureTextEntry={true}
              accessibilityHint={`Password must meet these rules: ${passwordRules
                .map((r) => r.label)
                .join(", ")}`}
            />

            {/* Password requirements — revealed while the field is focused,
                ticking off live as each rule is met. The list itself comes
                from the admin-configured policy. */}
            {passwordFocused && (
              <View
                style={styles.passwordRules}
                accessible={true}
                accessibilityLabel={`Password requirements. ${passwordRules
                  .map((r) => `${r.label}: ${r.met ? "met" : "not met"}`)
                  .join(". ")}`}
              >
                <AccessibleText style={[styles.passwordRulesTitle, { color: colors.subtext }]}>
                  Your password must have:
                </AccessibleText>
                {passwordRules.map((rule) => (
                  <View key={rule.key} style={styles.passwordRuleRow}>
                    <View
                      style={[
                        styles.passwordRuleIcon,
                        {
                          backgroundColor: rule.met
                            ? highContrast
                              ? "#000000"
                              : RULE_MET_COLOR
                            : "transparent",
                          borderColor: rule.met
                            ? highContrast
                              ? "#000000"
                              : RULE_MET_COLOR
                            : colors.border,
                        },
                      ]}
                    >
                      {rule.met && <Check size={11} color="#FFFFFF" strokeWidth={3.5} />}
                    </View>
                    <AccessibleText
                      style={[
                        styles.passwordRuleText,
                        { color: rule.met ? colors.text : colors.subtext },
                      ]}
                    >
                      {rule.label}
                    </AccessibleText>
                  </View>
                ))}
              </View>
            )}

            {/* Phone Number — split: fixed +91 | digit input */}
            <View style={styles.phoneContainer}>
              <AccessibleText style={[styles.phoneLabel, { color: colors.subtext }]}>Phone Number</AccessibleText>
              <View style={[styles.phoneWrapper, { backgroundColor: colors.surface, borderColor: colors.border }, highContrast && { borderWidth: 2, borderColor: "#000000" }]}>
                {/* Static country code section */}
                <View style={[styles.phonePrefix, { backgroundColor: highContrast ? colors.card : "#EDEAF8" }]}
                  accessible={true}
                  accessibilityLabel="Country code India plus 91"
                >
                  <AccessibleText style={[styles.phonePrefixText, { color: colors.subtext }]}>+91</AccessibleText>
                </View>
                {/* Divider */}
                <View style={[styles.phoneDivider, { backgroundColor: colors.border }]} />
                {/* Phone number digit section */}
                <TextInput
                  style={[styles.phoneInput, { color: colors.text, fontSize: typography.input.fontSize }]}
                  placeholder="XXXXX XXXXX"
                  placeholderTextColor="rgba(126,115,131,0.5)"
                  value={signUpPhone}
                  onChangeText={(t) => setSignUpPhone(sanitizeMobileInput(t))}
                  keyboardType="phone-pad"
                  maxLength={10}
                  accessible={true}
                  accessibilityLabel="Phone number"
                  accessibilityHint="Enter your 10-digit mobile number without country code."
                />
              </View>
            </View>

            <View style={styles.phoneContainer}>
              <AccessibleText style={[styles.phoneLabel, { color: colors.subtext }]}>
                Date of Birth
              </AccessibleText>
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => setShowDobPicker(true)}
                accessibilityRole="button"
                accessibilityLabel="Date of birth"
                accessibilityHint={
                  dob
                    ? `Selected: ${toDisplayDate(dob)}. Double tap to change`
                    : "Double tap to open the date picker"
                }
              >
                <TextInput
                  style={[
                    styles.phoneInput,
                    {
                      color: colors.text,
                      fontSize: typography.input.fontSize,
                      backgroundColor: colors.surface,
                      borderWidth: 1,
                      borderColor: colors.border,
                      borderRadius: 12,
                      paddingHorizontal: 14,
                    },
                    highContrast && { borderWidth: 2, borderColor: "#000000" },
                  ]}
                  placeholder="DD/MM/YYYY"
                  placeholderTextColor="rgba(126,115,131,0.5)"
                  value={dob ? toDisplayDate(dob) : ""}
                  editable={false}
                  pointerEvents="none"
                  accessibilityLabel="Date of birth"
                />
              </TouchableOpacity>
              <AccessibleText variant="caption" style={{ color: colors.subtext, marginTop: 6 }}>
                You must be {MINIMUM_AGE} or older to join.
              </AccessibleText>
            </View>

            <DateTimePickerModal
              isVisible={showDobPicker}
              mode="date"
              // Opening on the latest eligible date makes the requirement
              // obvious and saves scrolling back 18 years.
              date={dob ?? latestEligibleBirthDate()}
              maximumDate={new Date()}
              onConfirm={(date) => {
                setShowDobPicker(false);
                setDob(date);
                clearError();
              }}
              onCancel={() => setShowDobPicker(false)}
            />

            <TouchableOpacity
              onPress={() => setAcceptedTerms((prev) => !prev)}
              style={styles.termsRow}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: acceptedTerms }}
              accessibilityLabel="Accept Terms of Use and Community Guidelines"
            >
              <View
                style={[
                  styles.checkbox,
                  {
                    borderColor: acceptedTerms ? colors.primary : colors.border,
                    backgroundColor: acceptedTerms ? colors.primary : "transparent",
                  },
                  highContrast && { borderWidth: 2, borderColor: "#000000" },
                ]}
              >
                {acceptedTerms && <Check size={14} color="#fff" strokeWidth={3} />}
              </View>
              <AccessibleText variant="caption" style={{ flex: 1, lineHeight: 20 }}>
                I agree to the{" "}
                <Text
                  style={{ color: colors.primary, fontWeight: "700" }}
                  onPress={() => navigation.navigate("Legal", { doc: "terms" })}
                  accessibilityRole="link"
                >
                  Terms of Use
                </Text>{" "}
                and{" "}
                <Text
                  style={{ color: colors.primary, fontWeight: "700" }}
                  onPress={() => navigation.navigate("Legal", { doc: "community-guidelines" })}
                  accessibilityRole="link"
                >
                  Community Guidelines
                </Text>
              </AccessibleText>
            </TouchableOpacity>

            <AccessibleButton
              accessibilityLabel="Create Account"
              accessibilityHint={
                acceptedTerms
                  ? "Submit registration details and continue"
                  : "Accept the Terms of Use and Community Guidelines first"
              }
              onPress={handleSignUp}
              disabled={loading || !acceptedTerms}
            >
              {loading ? <ActivityIndicator color="#fff" /> : "Create Account"}
            </AccessibleButton>
          </View>
        )}

        {/* LOGIN */}
        {activeTab === "Login" && (
          <View style={styles.form}>
            <Input
              label="Email"
              placeholder="you@example.com"
              value={loginEmail}
              onChangeText={setLoginEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              accessibilityHint="Enter your registered email address"
            />

            <Input
              label="Password"
              placeholder="Your password"
              value={loginPassword}
              onChangeText={setLoginPassword}
              secureTextEntry={true}
              accessibilityHint="Enter your account password"
            />

            <TouchableOpacity
              style={styles.forgotBtn}
              accessibilityRole="button"
              accessibilityLabel="Forgot Password"
              accessibilityHint="Launches recovery steps for lost passwords"
              onPress={() => navigation.navigate("ForgotPassword")}
            >
              <AccessibleText variant="body" color={colors.primary} style={{ fontWeight: '600' }}>
                Forgot password?
              </AccessibleText>
            </TouchableOpacity>

            <AccessibleButton
              accessibilityLabel="Login"
              accessibilityHint="Submit credentials to log in"
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? <ActivityIndicator color="#fff" /> : "Login"}
            </AccessibleButton>
          </View>
        )}

        {/* FOOTER — privacy notice required by DPDP Act 2023 §6 */}
        {/* [LEGAL PLACEHOLDER] The documents themselves are still drafts.
            These open in-app now — the old external links were built from
            EXPO_PUBLIC_WEB_BASE_URL, which is defined nowhere, so every
            build fell back to http://localhost:3000 and went nowhere. */}
        <AccessibleText variant="caption" style={{ marginTop: spacing.xl, textAlign: 'center', lineHeight: 22 }}>
          By continuing, you agree to our{" "}
          <Text
            style={{ color: colors.primary, fontWeight: '700' }}
            onPress={() => navigation.navigate("Legal", { doc: "terms" })}
            accessibilityRole="link"
            accessibilityLabel="Terms of Service"
          >
            Terms
          </Text>
          {" "}&{" "}
          <Text
            style={{ color: colors.primary, fontWeight: '700' }}
            onPress={() => navigation.navigate("Legal", { doc: "privacy-policy" })}
            accessibilityRole="link"
            accessibilityLabel="Privacy Policy"
          >
            Privacy Policy
          </Text>
        </AccessibleText>
      </KeyboardAwareScrollView>
    </ScreenWrapper>
  );
};

export default WelcomeScreen;

const styles = StyleSheet.create({
  passwordRules: {
    marginTop: 0,
    marginBottom: 4,
    gap: 6,
  },

  passwordRulesTitle: {
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 2,
  },

  passwordRuleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  passwordRuleIcon: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },

  passwordRuleText: {
    fontSize: 12.5,
    flexShrink: 1,
  },

  // TERMS CHECKBOX
  termsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 4,
    marginBottom: 4,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },

  // PHONE INPUT
  phoneContainer: {
    width: '100%',
  },
  // Matches Input's own label (variant="label": weight 700, letterSpacing
  // 1.2). No fontSize — the label variant supplies a scaled one, and the
  // hardcoded 12 here meant Phone and Date of Birth ignored the text-size
  // setting while every field above them honoured it.
  phoneLabel: {
    textTransform: 'uppercase',
    fontWeight: '700',
    marginBottom: 8,
    letterSpacing: 1.2,
  },
  phoneWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    minHeight: 48,
  },
  phonePrefix: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  phonePrefixText: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  phoneDivider: {
    width: 1,
    height: '60%',
  },
  phoneInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 48,
  },


  // HEADER
  header: {
    // No fixed height: the title wraps to two lines on narrower phones and
    // grows further with the app's text-size setting, and the old
    // height/minHeight pair plus overflow:"hidden" clipped it. The decorative
    // glows are clipped individually instead (see topGlow/bottomGlow).
    minHeight: 240,
    paddingVertical: 24,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },

  topGlow: {
    position: "absolute",
    width: 256,
    height: 256,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.1)",
    top: -48,
    right: -48,
  },

  bottomGlow: {
    position: "absolute",
    width: 192,
    height: 192,
    borderRadius: 999,
    backgroundColor: "rgba(254,166,25,0.2)",
    bottom: -48,
    left: -48,
  },

  logoContainer: {
    alignItems: "center",
    zIndex: 10,
  },

  logoShadow: {
    position: "absolute",
    width: 80,
    height: 80,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 10,
  },

  logoBox: {
    width: 80,
    height: 80,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },

  logo: {
    width: 80,
    height: 80,
  },



  // BOTTOM CARD
  bottomCard: {
    flex: 1,
    backgroundColor: "#fff",
    marginTop: -26,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
  },

  bottomContent: {
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 120,
    flexGrow: 1,
  },

  // TABS
  tabs: {
    flexDirection: "row",
    marginBottom: 28,
  },

  tabBtn: {
    flex: 1,
    alignItems: "center",
    paddingBottom: 16,
    borderBottomWidth: 2,
    borderBottomColor: "#E8E7EE",
  },




  // FORM
  form: {
    gap: 22,
  },



  forgotBtn: {
    alignSelf: "flex-end",
    marginTop: 2,
  },


  // BUTTON



  // ERROR
  errorBanner: {
    backgroundColor: "#FFEAEA",
    borderLeftWidth: 4,
    borderLeftColor: "#E53935",
    borderRadius: 12,
    padding: 14,
    marginBottom: 22,
  },


  // FOOTER

});