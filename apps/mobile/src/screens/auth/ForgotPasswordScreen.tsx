import React, { useState, useRef, useEffect } from "react";
import {
  View,
  StyleSheet,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { LinearGradient } from "expo-linear-gradient";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AuthStackParamList } from "@navigation/AuthNavigator";
import { forgotPassword, resetPassword } from "@services/authService";
import { useTheme } from "../../theme/ThemeContext";
import { AccessibleText } from "../../components/shared/AccessibleText";
import { AccessibleButton } from "../../components/shared/AccessibleButton";
import { Input } from "../../components/shared/Input";
import ScreenWrapper from "../../components/layout/ScreenWrapper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// -------------------------------------------------------------------
// Resend OTP cooldown in seconds
// -------------------------------------------------------------------
const RESEND_COOLDOWN_SECONDS = 60;

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, "ForgotPassword">;
};

const ForgotPasswordScreen = ({ navigation }: Props) => {
  const { colors, spacing, highContrast } = useTheme();
  const insets = useSafeAreaInsets();

  // Step 1: enter email
  const [email, setEmail] = useState("");
  // Step 2: enter 6-digit OTP + new password
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [step, setStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Resend OTP rate-limiting
  const [resendCooldown, setResendCooldown] = useState(0);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (cooldownRef.current) clearInterval(cooldownRef.current);
    };
  }, []);

  const startCooldown = () => {
    setResendCooldown(RESEND_COOLDOWN_SECONDS);
    cooldownRef.current = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(cooldownRef.current!);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const clearError = () => setError(null);

  // ------------------------------------------------------------------
  // Step 1 — Request OTP
  // ------------------------------------------------------------------
  const handleRequestReset = async () => {
    clearError();
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedEmail) {
      setError("Please enter your email address.");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError("Please enter a valid email address.");
      return;
    }

    // Guard: prevent spamming Resend while cooldown is active
    if (resendCooldown > 0) {
      setError(`Please wait ${resendCooldown}s before requesting a new code.`);
      return;
    }

    setLoading(true);
    try {
      await forgotPassword({ email: trimmedEmail });
      // Always move to step 2 regardless of whether the email is registered
      // (prevents email enumeration attacks)
      setStep(2);
      startCooldown();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // ------------------------------------------------------------------
  // Step 2 — Submit OTP + new password
  // ------------------------------------------------------------------
  const handleResetPassword = async () => {
    clearError();

    if (!/^\d{6}$/.test(otp.trim())) {
      setError("Please enter the 6-digit code from your email.");
      return;
    }

    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (newPassword.length > 16) {
      setError("Password must be at most 16 characters.");
      return;
    }

    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(newPassword)) {
      setError("Password must include uppercase, lowercase, and a number.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      await resetPassword({
        email: email.trim().toLowerCase(),
        otp: otp.trim(),
        password: newPassword,
      });
      Alert.alert(
        "Password Reset",
        "Your password has been reset successfully. Please log in with your new password.",
        [{ text: "Login", onPress: () => navigation.navigate("Welcome") }]
      );
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      setError(msg || "Invalid or expired code. Please request a new one.");
    } finally {
      setLoading(false);
    }
  };

  // ------------------------------------------------------------------
  // Resend OTP — clear stale OTP/password inputs, apply cooldown
  // ------------------------------------------------------------------
  const handleResend = async () => {
    clearError();

    if (resendCooldown > 0) {
      setError(`Please wait ${resendCooldown}s before requesting a new code.`);
      return;
    }

    // Clear Step 2 fields so user doesn't accidentally submit an old OTP
    setOtp("");
    setNewPassword("");
    setConfirmPassword("");

    await handleRequestReset();
  };

  // ------------------------------------------------------------------
  // Back — step 2 → step 1 (also clear stale fields)
  // ------------------------------------------------------------------
  const handleBack = () => {
    if (step === 2) {
      setOtp("");
      setNewPassword("");
      setConfirmPassword("");
      clearError();
      setStep(1);
    } else {
      navigation.goBack();
    }
  };

  const canResend = !loading && resendCooldown === 0;

  return (
    <ScreenWrapper statusBarStyle="light">
      {/* HEADER */}
      <LinearGradient
        colors={highContrast ? ["#000000", "#000000"] : ["#7C3AED", "#500088"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: insets.top }]}
      >
        <TouchableOpacity
          style={styles.backBtn}
          onPress={handleBack}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <AccessibleText variant="body" color="#fff">← Back</AccessibleText>
        </TouchableOpacity>

        <AccessibleText variant="heroTitle" color="#fff" style={styles.headerTitle}>
          {step === 1 ? "Forgot Password" : "Reset Password"}
        </AccessibleText>
        <AccessibleText
          variant="subtitle"
          color="rgba(255,255,255,0.8)"
          style={styles.headerSubtitle}
        >
          {step === 1
            ? "Enter your email to receive a reset OTP"
            : "Enter the OTP from your email and your new password"}
        </AccessibleText>
      </LinearGradient>

      {/* FORM CARD */}
      <View style={[styles.bottomCard, { backgroundColor: colors.card }]}>
        <KeyboardAwareScrollView
          contentContainerStyle={styles.bottomContent}
          keyboardShouldPersistTaps="handled"
          enableOnAndroid
        >
          {/* Error */}
          {error ? (
            <View
              style={[
                styles.errorBox,
                { borderLeftColor: colors.error },
                highContrast && {
                  backgroundColor: "#FFFFFF",
                  borderWidth: 2,
                  borderColor: "#000000",
                },
              ]}
            >
              <AccessibleText
                variant="body"
                color={colors.error}
                accessibilityRole="alert"
              >
                {error}
              </AccessibleText>
            </View>
          ) : null}

          {step === 1 ? (
            <>
              <AccessibleText variant="label" style={styles.fieldLabel}>
                Email Address
              </AccessibleText>
              <Input
                value={email}
                onChangeText={(t) => {
                  setEmail(t);
                  clearError();
                }}
                placeholder="you@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                accessibilityLabel="Email address"
                accessibilityHint="Enter the email linked to your account"
              />

              <AccessibleButton
                accessibilityLabel="Send reset OTP"
                accessibilityHint="Sends a password reset OTP to your email"
                onPress={handleRequestReset}
                disabled={loading}
                style={styles.submitBtn}
              >
                {loading ? <ActivityIndicator color="#fff" /> : "Send Reset OTP"}
              </AccessibleButton>
            </>
          ) : (
            <>
              {/* Contextual info: which email was used */}
              <View style={[styles.emailInfoBox, { backgroundColor: highContrast ? colors.surface : "#F5F3FF" }]}>
                <AccessibleText
                  variant="caption"
                  style={[styles.emailInfoText, { color: colors.secondary }]}
                >
                  We sent a 6-digit code to{" "}
                  <AccessibleText variant="caption" style={{ fontWeight: "800", color: colors.secondary }}>
                    {email.trim().toLowerCase()}
                  </AccessibleText>
                  . Check your spam folder if you don't see it.
                </AccessibleText>
              </View>

              <AccessibleText variant="label" style={styles.fieldLabel}>
                Reset Code
              </AccessibleText>
              <Input
                value={otp}
                onChangeText={(t) => {
                  setOtp(t.replace(/[^0-9]/g, ""));
                  clearError();
                }}
                placeholder="6-digit code"
                keyboardType="number-pad"
                maxLength={6}
                autoCapitalize="none"
                autoCorrect={false}
                accessibilityLabel="Reset code"
                accessibilityHint="Enter the 6-digit code from the reset email"
              />

              <AccessibleText
                variant="label"
                style={[styles.fieldLabel, { marginTop: spacing.md }]}
              >
                New Password
              </AccessibleText>
              <Input
                value={newPassword}
                onChangeText={(t) => {
                  setNewPassword(t);
                  clearError();
                }}
                placeholder="Minimum 8 characters"
                secureTextEntry
                showPasswordToggle
                accessibilityLabel="New password"
                accessibilityHint="At least 8 characters with uppercase, lowercase, and a number"
              />

              <AccessibleText
                variant="label"
                style={[styles.fieldLabel, { marginTop: spacing.md }]}
              >
                Confirm Password
              </AccessibleText>
              <Input
                value={confirmPassword}
                onChangeText={(t) => {
                  setConfirmPassword(t);
                  clearError();
                }}
                placeholder="Repeat new password"
                secureTextEntry
                showPasswordToggle
                accessibilityLabel="Confirm new password"
                accessibilityHint="Re-enter your new password to confirm"
              />

              <AccessibleButton
                accessibilityLabel="Reset password"
                accessibilityHint="Submit new password to complete the reset"
                onPress={handleResetPassword}
                disabled={loading}
                style={styles.submitBtn}
              >
                {loading ? <ActivityIndicator color="#fff" /> : "Reset Password"}
              </AccessibleButton>

              <TouchableOpacity
                onPress={handleResend}
                disabled={!canResend}
                style={[styles.resendBtn, !canResend && styles.resendDisabled]}
                accessibilityRole="button"
                accessibilityLabel={
                  resendCooldown > 0
                    ? `Resend OTP available in ${resendCooldown} seconds`
                    : "Resend OTP"
                }
                accessibilityState={{ disabled: !canResend }}
              >
                <AccessibleText
                  variant="body"
                  color={canResend ? colors.primary : colors.subtext}
                >
                  {resendCooldown > 0
                    ? `Resend OTP in ${resendCooldown}s`
                    : "Didn't receive the OTP? Resend"}
                </AccessibleText>
              </TouchableOpacity>
            </>
          )}
        </KeyboardAwareScrollView>
      </View>
    </ScreenWrapper>
  );
};

export default ForgotPasswordScreen;

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 24,
    paddingBottom: 40,
    justifyContent: "flex-end",
    minHeight: "30%",
  },
  backBtn: {
    marginBottom: 16,
  },
  headerTitle: {
    marginBottom: 8,
  },
  headerSubtitle: {
    marginBottom: 8,
  },
  bottomCard: {
    flex: 1,
    marginTop: -24,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
  },
  bottomContent: {
    paddingHorizontal: 24,
    paddingTop: 36,
    paddingBottom: 60,
    flexGrow: 1,
  },
  errorBox: {
    backgroundColor: "#FFF0F0",
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    borderLeftWidth: 4,
  },
  emailInfoBox: {
    borderRadius: 10,
    padding: 12,
    marginBottom: 20,
  },
  emailInfoText: {
    lineHeight: 20,
  },
  fieldLabel: {
    marginBottom: 6,
    fontWeight: "600",
  },
  submitBtn: {
    marginTop: 24,
  },
  resendBtn: {
    marginTop: 16,
    alignItems: "center",
  },
  resendDisabled: {
    opacity: 0.5,
  },
});
