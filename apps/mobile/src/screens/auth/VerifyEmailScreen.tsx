import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Pressable,
} from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { MainStackParamList } from "../../navigation/MainNavigator";
import { useAuthStore } from "../../store/authStore";
import { verifyEmailOtp, resendVerificationOtp } from "../../services/authService";
import { Ionicons } from "@expo/vector-icons";

type Props = {
  navigation: NativeStackNavigationProp<MainStackParamList, "VerifyEmail">;
};

const VerifyEmailScreen = ({ navigation }: Props) => {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  
  const [otp, setOtp] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const inputRef = React.useRef<TextInput>(null);

  const OTP_LENGTH = 6;

  const handleVerify = async () => {
    if (!otp || otp.length < 6) {
      setError("Please enter a valid 6-digit OTP.");
      return;
    }

    if (!user?.email) {
      setError("Email not found. Please log in again.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      await verifyEmailOtp(user.email, otp);
      // Update user state to true so MainNavigator can re-route them
      setUser({ ...user, isEmailVerified: true });
      // The RootNavigator / MainNavigator will automatically react to the updated user state
      // but we can also manually navigate to the next step if we want.
      // Since MainNavigator is keyed by initialRoute in some ways, we can just replace:
      if (!user.role) {
        navigation.replace("Accessibility");
      } else if (!user.profileComplete) {
        navigation.replace("Profile");
      } else {
        navigation.replace("MainTabs");
      }
    } catch (err: any) {
      console.error("[VerifyEmailError]", err);
      setError(err.response?.data?.message || "Failed to verify email. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (!user?.email) return;

    setIsResending(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const msg = await resendVerificationOtp(user.email);
      setSuccessMsg(msg);
    } catch (err: any) {
      console.error("[ResendOtpError]", err);
      setError(err.response?.data?.message || "Failed to resend OTP.");
    } finally {
      setIsResending(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Ionicons name="mail-open-outline" size={64} color="#500088" />
        </View>
        <Text style={styles.title}>Verify your email</Text>
        <Text style={styles.subtitle}>
          We sent a 6-digit code to {user?.email}. Enter it below to verify your account.
        </Text>

        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {successMsg && (
          <View style={styles.successContainer}>
            <Text style={styles.successText}>{successMsg}</Text>
          </View>
        )}

        <View style={styles.otpContainer}>
          <Pressable style={styles.otpBoxes} onPress={() => inputRef.current?.focus()}>
            {Array.from({ length: OTP_LENGTH }).map((_, index) => {
              const char = otp[index];
              const isCurrent = index === otp.length;
              return (
                <View 
                  key={index} 
                  style={[
                    styles.otpBox, 
                    isCurrent && styles.otpBoxActive,
                    char ? styles.otpBoxFilled : null
                  ]}
                >
                  <Text style={styles.otpBoxText}>{char || ""}</Text>
                </View>
              );
            })}
          </Pressable>
          <TextInput
            ref={inputRef}
            style={styles.hiddenInput}
            keyboardType="number-pad"
            maxLength={OTP_LENGTH}
            value={otp}
            onChangeText={(text) => {
              // Ensure only numbers are entered
              const numericText = text.replace(/[^0-9]/g, '');
              setOtp(numericText);
              if (error) setError(null);
            }}
            autoFocus
          />
        </View>

        <TouchableOpacity
          style={[styles.button, (!otp || otp.length < 6) && styles.buttonDisabled]}
          onPress={handleVerify}
          disabled={isLoading || !otp || otp.length < 6}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Verify Email</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.resendContainer} 
          onPress={handleResend}
          disabled={isResending}
        >
          <Text style={styles.resendText}>
            {isResending ? "Sending..." : "Didn't receive code? Resend OTP"}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

export default VerifyEmailScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: "center",
  },
  iconContainer: {
    alignItems: "center",
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#1F2937",
    textAlign: "center",
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: "#4B5563",
    textAlign: "center",
    marginBottom: 32,
    lineHeight: 24,
  },
  errorContainer: {
    backgroundColor: "#FEE2E2",
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    color: "#DC2626",
    fontSize: 14,
    textAlign: "center",
  },
  otpContainer: {
    marginBottom: 32,
    alignItems: "center",
  },
  otpBoxes: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    paddingHorizontal: 10,
  },
  otpBox: {
    width: 48,
    height: 56,
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
  },
  otpBoxActive: {
    borderColor: "#500088",
    backgroundColor: "#F3E8FF",
  },
  otpBoxFilled: {
    borderColor: "#500088",
  },
  otpBoxText: {
    fontSize: 24,
    fontWeight: "600",
    color: "#1F2937",
  },
  hiddenInput: {
    position: "absolute",
    width: 1,
    height: 1,
    opacity: 0,
  },
  button: {
    backgroundColor: "#500088",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  buttonDisabled: {
    backgroundColor: "#A78BFA",
  },
  buttonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
  },
  resendContainer: {
    marginTop: 24,
    alignItems: "center",
  },
  resendText: {
    color: "#500088",
    fontSize: 16,
    fontWeight: "600",
  },
  successContainer: {
    backgroundColor: "#D1FAE5",
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  successText: {
    color: "#059669",
    fontSize: 14,
    textAlign: "center",
  },
});
