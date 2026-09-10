import React, { useState, useRef, useEffect } from "react";
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
import { Check } from "lucide-react-native";
import apiClient from "@services/apiClient";
import {
  evaluatePassword,
  firstPasswordError,
  FALLBACK_PASSWORD_POLICY,
  type PasswordPolicy,
} from "../../utils/passwordValidation";
import { useTheme } from "../../theme/ThemeContext";
import { AccessibleText } from "../../components/shared/AccessibleText";
import { AccessibleButton } from "../../components/shared/AccessibleButton";
import { Input } from "../../components/shared/Input";
import ScreenWrapper from "../../components/layout/ScreenWrapper";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as WebBrowser from "expo-web-browser";

// Green used for a satisfied password rule / an available email. The theme
// has no success colour, and the brand purple reads as "selected" rather
// than "done".
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
  const { colors, spacing, highContrast } = useTheme();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<"SignUp" | "Login">("SignUp");

  // SignUp
  const [name, setName] = useState("");
  const [signUpEmail, setSignUpEmail] = useState("");
  const [signUpPassword, setSignUpPassword] = useState("");

  // ── Live "already registered?" check (item 7) ──
  // Mirrors the username check in ProfileScreen: debounced, and every early
  // return cancels the pending timer so a stale resolve can't overwrite a
  // newer state.
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

  // ── Password rules (item 8) ──
  // The rules are admin-configured and served by user-svc, so the checklist
  // shows exactly what the API enforces. The list is revealed only while the
  // password field is focused, per QA.
  const [passwordPolicy, setPasswordPolicy] = useState<PasswordPolicy>(FALLBACK_PASSWORD_POLICY);
  const [passwordFocused, setPasswordFocused] = useState(false);

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
    return () => { cancelled = true; };
  }, []);

  const passwordRules = evaluatePassword(signUpPassword, passwordPolicy);
  const [signUpPhone, setSignUpPhone] = useState("");

  // Login
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Shared
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

    if (!/^[6-9]\d{9}$/.test(trimmedPhone)) {
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
    // blocked too, so an in-flight result can't land after the request.
    if (emailStatus === "taken") {
      setError(emailMessage || "An account with this email already exists.");
      return;
    }
    if (emailStatus === "checking") {
      setError("Checking that email address, please wait…");
      return;
    }

    // Rules come from the admin-configured policy, so this can't drift from
    // what the API enforces.
    const passwordError = firstPasswordError(trimmedPassword, passwordPolicy);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    setLoading(true);

    try {
      const result = await register({
        name: trimmedName,
        email: trimmedEmail,
        password: trimmedPassword,
        phoneNo: trimmedPhone,
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
            Welcome to DigiAbility
          </AccessibleText>

          <AccessibleText variant="subtitle" style={{ color: 'rgba(255,255,255,0.8)', textAlign: 'center' }}>
            Your support network awaits
          </AccessibleText>
        </View>
      </LinearGradient>

      {/* MAIN CARD */}
      <KeyboardAwareScrollView
        style={[styles.bottomCard, { backgroundColor: colors.card }]}
        contentContainerStyle={[styles.bottomContent, { flexGrow: 1 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        enableOnAndroid={true}
        extraScrollHeight={20}
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

            {/* Availability feedback while typing — "already registered" used
                to surface only after submitting the whole form. */}
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

            {/* Requirements are revealed only while the password field is
                focused (per QA) and tick off live as each rule is met. The
                list itself is the admin-configured policy. */}
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
                            ? highContrast ? "#000000" : RULE_MET_COLOR
                            : "transparent",
                          borderColor: rule.met
                            ? highContrast ? "#000000" : RULE_MET_COLOR
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
                  style={[styles.phoneInput, { color: colors.text }]}
                  placeholder="XXXXX XXXXX"
                  placeholderTextColor="rgba(126,115,131,0.5)"
                  value={signUpPhone}
                  onChangeText={(t) => setSignUpPhone(t.replace(/[^0-9]/g, ''))}
                  keyboardType="phone-pad"
                  maxLength={10}
                  accessible={true}
                  accessibilityLabel="Phone number"
                  accessibilityHint="Enter your 10-digit mobile number without country code."
                />
              </View>
            </View>

            <AccessibleButton
              accessibilityLabel="Create Account"
              accessibilityHint="Submit registration details and continue"
              onPress={handleSignUp}
              disabled={loading}
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
            onPress={() => navigation.navigate("Legal", { doc: "privacy" })}
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

  // PHONE INPUT
  phoneContainer: {
    width: '100%',
  },
  phoneLabel: {
    textTransform: 'uppercase',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
    letterSpacing: 0.5,
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
    fontSize: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
    minHeight: 48,
  },


  // HEADER
  header: {
    height: "38%",
    minHeight: 220,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
    overflow: "hidden",
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
    marginBottom: 24,
  },

  logo: {
    width: 80,
    height: 80,
  },

  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: -0.7,
    marginBottom: 8,
    textAlign: "center",
  },

  subtitle: {
    fontSize: 16,
    fontWeight: "500",
    color: "rgba(255,255,255,0.8)",
    textAlign: "center",
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

  activeTabBtn: {
    borderBottomColor: "#500088",
  },

  activeTabText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#500088",
  },

  inactiveTabText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#7E7383",
  },

  // FORM
  form: {
    gap: 22,
  },

  label: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.2,
    color: "#7E7383",
    marginBottom: 8,
  },

  input: {
    backgroundColor: "#F4F3FA",
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 17,
    fontSize: 16,
    color: "#1A1B20",
  },

  forgotBtn: {
    alignSelf: "flex-end",
    marginTop: -10,
  },

  forgotText: {
    color: "#500088",
    fontWeight: "600",
    fontSize: 14,
  },

  // BUTTON
  ctaButton: {
    marginTop: 8,
    borderRadius: 12,
    overflow: "hidden",
    shadowColor: "#500088",
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },

  gradientButton: {
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
  },

  ctaText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },

  // ERROR
  errorBanner: {
    backgroundColor: "#FFEAEA",
    borderLeftWidth: 4,
    borderLeftColor: "#E53935",
    borderRadius: 12,
    padding: 14,
    marginBottom: 22,
  },

  errorText: {
    color: "#C62828",
    fontSize: 14,
  },

  // FOOTER
  footer: {
    marginTop: 34,
    textAlign: "center",
    color: "#7E7383",
    fontSize: 14,
    lineHeight: 22,
  },

  footerLink: {
    color: "#500088",
    fontWeight: "700",
  },
});