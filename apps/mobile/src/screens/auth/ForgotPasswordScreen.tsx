import React, { useState } from "react";
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

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, "ForgotPassword">;
};

const ForgotPasswordScreen = ({ navigation }: Props) => {
  const { colors, spacing, highContrast } = useTheme();
  const insets = useSafeAreaInsets();

  // Step 1: enter email
  const [email, setEmail] = useState("");
  // Step 2: enter OTP token + new password
  const [token, setToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [step, setStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = () => setError(null);

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

    setLoading(true);
    try {
      await forgotPassword({ email: trimmedEmail });
      // Always show step 2 regardless of whether the email exists (safe message)
      setStep(2);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    clearError();

    if (!token.trim()) {
      setError("Please enter the OTP token from your email.");
      return;
    }

    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
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
      await resetPassword({ token: token.trim(), password: newPassword });
      Alert.alert(
        "Password Reset",
        "Your password has been reset successfully. Please log in with your new password.",
        [{ text: "Login", onPress: () => navigation.navigate("Welcome") }]
      );
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      setError(msg || "Invalid or expired token. Please request a new one.");
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
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => (step === 2 ? setStep(1) : navigation.goBack())}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <AccessibleText variant="body" color="#fff">← Back</AccessibleText>
        </TouchableOpacity>

        <AccessibleText variant="heroTitle" color="#fff" style={styles.headerTitle}>
          {step === 1 ? "Forgot Password" : "Reset Password"}
        </AccessibleText>
        <AccessibleText variant="subtitle" color="rgba(255,255,255,0.8)" style={styles.headerSubtitle}>
          {step === 1
            ? "Enter your email to receive a reset OTP"
            : "Enter the OTP from your email and your new password"}
        </AccessibleText>
      </LinearGradient>

      {/* FORM CARD */}
      <View style={styles.bottomCard}>
        <KeyboardAwareScrollView
          contentContainerStyle={styles.bottomContent}
          keyboardShouldPersistTaps="handled"
          enableOnAndroid
        >
          {/* Error */}
          {error ? (
            <View style={[styles.errorBox, { borderLeftColor: colors.error }, highContrast && { backgroundColor: "#FFFFFF", borderWidth: 2, borderColor: "#000000" }]}>
              <AccessibleText variant="body" color={colors.error} accessibilityRole="alert">
                {error}
              </AccessibleText>
            </View>
          ) : null}

          {step === 1 ? (
            <>
              <AccessibleText variant="label" style={styles.fieldLabel}>Email Address</AccessibleText>
              <Input
                value={email}
                onChangeText={(t) => { setEmail(t); clearError(); }}
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
              <AccessibleText variant="label" style={styles.fieldLabel}>OTP Token</AccessibleText>
              <Input
                value={token}
                onChangeText={(t) => { setToken(t); clearError(); }}
                placeholder="Paste the token from your email"
                autoCapitalize="none"
                autoCorrect={false}
                accessibilityLabel="OTP token"
                accessibilityHint="Copy and paste the token from the reset email"
              />

              <AccessibleText variant="label" style={[styles.fieldLabel, { marginTop: spacing.md }]}>
                New Password
              </AccessibleText>
              <Input
                value={newPassword}
                onChangeText={(t) => { setNewPassword(t); clearError(); }}
                placeholder="Minimum 8 characters"
                secureTextEntry
                accessibilityLabel="New password"
                accessibilityHint="At least 8 characters with uppercase, lowercase, and a number"
              />

              <AccessibleText variant="label" style={[styles.fieldLabel, { marginTop: spacing.md }]}>
                Confirm Password
              </AccessibleText>
              <Input
                value={confirmPassword}
                onChangeText={(t) => { setConfirmPassword(t); clearError(); }}
                placeholder="Repeat new password"
                secureTextEntry
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
                onPress={handleRequestReset}
                style={styles.resendBtn}
                accessibilityRole="button"
                accessibilityLabel="Resend OTP"
              >
                <AccessibleText variant="body" color={colors.primary}>
                  Didn't receive the OTP? Resend
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
    backgroundColor: "#fff",
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
});
