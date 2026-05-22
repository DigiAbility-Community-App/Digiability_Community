import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Animated,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { AuthStackParamList } from '@navigation/AuthNavigator';
import { verifyEmailOtp, resendVerificationOtp } from '@services/authService';

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'Otp'>;
  route: RouteProp<AuthStackParamList, 'Otp'>;
};

const OTP_LENGTH = 6;
const OTP_EXPIRY_SECONDS = 10 * 60; // 10 minutes
const RESEND_COOLDOWN_SECONDS = 60;

type ApiErrorShape = {
  response?: {
    data?: {
      message?: string;
      errors?: Array<{ message?: string }>;
    };
  };
};

function getApiErrorMessage(error: unknown, fallback: string): string {
  const apiError = error as ApiErrorShape;
  return (
    apiError.response?.data?.errors?.[0]?.message ??
    apiError.response?.data?.message ??
    fallback
  );
}

const OtpScreen = ({ navigation, route }: Props) => {
  const { email, name } = route.params;

  // ── State ────────────────────────────────────────────
  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [expirySeconds, setExpirySeconds] = useState(OTP_EXPIRY_SECONDS);
  const [resendCooldown, setResendCooldown] = useState(0);

  // ── Refs ─────────────────────────────────────────────
  const inputRefs = useRef<(TextInput | null)[]>([]);
  const shakeAnim = useRef(new Animated.Value(0)).current;

  // ── Expiry countdown ─────────────────────────────────
  useEffect(() => {
    if (expirySeconds <= 0) return;
    const timer = setInterval(() => {
      setExpirySeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [expirySeconds]);

  // ── Resend cooldown ──────────────────────────────────
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // ── Format time ──────────────────────────────────────
  const formatTime = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // ── Shake animation for errors ───────────────────────
  const triggerShake = () => {
    shakeAnim.setValue(0);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  };

  // ── Handle digit input ───────────────────────────────
  const handleDigitChange = useCallback((text: string, index: number) => {
    setError(null);

    // Handle paste of full OTP
    if (text.length === OTP_LENGTH) {
      const digits = text.split('').slice(0, OTP_LENGTH);
      if (digits.every((d) => /^\d$/.test(d))) {
        setOtp(digits);
        inputRefs.current[OTP_LENGTH - 1]?.focus();
        // Auto-submit
        handleVerify(digits.join(''));
        return;
      }
    }

    // Single digit input
    const digit = text.slice(-1);
    if (digit && !/^\d$/.test(digit)) return;

    const newOtp = [...otp];
    newOtp[index] = digit;
    setOtp(newOtp);

    // Auto-advance to next input
    if (digit && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all digits filled
    if (digit && index === OTP_LENGTH - 1) {
      const fullOtp = newOtp.join('');
      if (fullOtp.length === OTP_LENGTH) {
        handleVerify(fullOtp);
      }
    }
  }, [otp]);

  // ── Handle backspace ─────────────────────────────────
  const handleKeyPress = (e: { nativeEvent: { key: string } }, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      const newOtp = [...otp];
      newOtp[index - 1] = '';
      setOtp(newOtp);
      inputRefs.current[index - 1]?.focus();
    }
  };

  // ── Verify OTP ───────────────────────────────────────
  const handleVerify = async (otpCode?: string) => {
    const code = otpCode || otp.join('');
    if (code.length !== OTP_LENGTH) {
      setError('Please enter all 6 digits.');
      triggerShake();
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await verifyEmailOtp(email, code);
      setSuccess('Email verified! Redirecting...');
      // Auth store is already set from registration — RootNavigator will switch
    } catch (err: unknown) {
      const msg = getApiErrorMessage(err, 'Verification failed. Please try again.');
      setError(msg);
      triggerShake();
      // Clear OTP inputs on failure
      setOtp(Array(OTP_LENGTH).fill(''));
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  // ── Resend OTP ───────────────────────────────────────
  const handleResend = async () => {
    if (resendCooldown > 0) return;

    setError(null);
    try {
      await resendVerificationOtp(email);
      setSuccess('New OTP sent to your email.');
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
      setExpirySeconds(OTP_EXPIRY_SECONDS);
      setOtp(Array(OTP_LENGTH).fill(''));
      inputRefs.current[0]?.focus();
      // Clear success after 3 seconds
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Failed to resend OTP.'));
    }
  };

  // ── Masked email ─────────────────────────────────────
  const maskedEmail = (() => {
    const [local, domain] = email.split('@');
    if (local.length <= 2) return email;
    return `${local[0]}${'•'.repeat(Math.min(local.length - 2, 6))}${local[local.length - 1]}@${domain}`;
  })();

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.content}>
          {/* Back Button */}
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.iconCircle}>
              <Text style={styles.iconEmoji}>✉️</Text>
            </View>
            <Text style={styles.title}>Verify your email</Text>
            <Text style={styles.subtitle}>
              We sent a 6-digit code to
            </Text>
            <Text style={styles.emailText}>{maskedEmail}</Text>
          </View>

          {/* OTP Inputs */}
          <Animated.View
            style={[styles.otpRow, { transform: [{ translateX: shakeAnim }] }]}
          >
            {Array.from({ length: OTP_LENGTH }).map((_, i) => (
              <TextInput
                key={i}
                ref={(ref) => { inputRefs.current[i] = ref; }}
                style={[
                  styles.otpInput,
                  otp[i] ? styles.otpInputFilled : {},
                  error ? styles.otpInputError : {},
                ]}
                value={otp[i]}
                onChangeText={(text) => handleDigitChange(text, i)}
                onKeyPress={(e) => handleKeyPress(e, i)}
                keyboardType="number-pad"
                maxLength={i === 0 ? OTP_LENGTH : 1} // Allow paste on first input
                autoFocus={i === 0}
                selectTextOnFocus
                editable={!loading}
              />
            ))}
          </Animated.View>

          {/* Timer */}
          <View style={styles.timerRow}>
            {expirySeconds > 0 ? (
              <Text style={styles.timerText}>
                Code expires in{' '}
                <Text style={styles.timerBold}>{formatTime(expirySeconds)}</Text>
              </Text>
            ) : (
              <Text style={styles.timerExpired}>Code expired</Text>
            )}
          </View>

          {/* Error / Success */}
          {error && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}
          {success && (
            <View style={styles.successBanner}>
              <Text style={styles.successText}>{success}</Text>
            </View>
          )}

          {/* Verify Button */}
          <TouchableOpacity
            style={[styles.verifyBtn, loading && styles.verifyBtnDisabled]}
            onPress={() => handleVerify()}
            disabled={loading || otp.join('').length !== OTP_LENGTH}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.verifyBtnText}>Verify Email</Text>
            )}
          </TouchableOpacity>

          {/* Resend */}
          <View style={styles.resendRow}>
            <Text style={styles.resendLabel}>Didn't receive the code? </Text>
            <TouchableOpacity
              onPress={handleResend}
              disabled={resendCooldown > 0}
            >
              <Text
                style={[
                  styles.resendBtn,
                  resendCooldown > 0 && styles.resendBtnDisabled,
                ]}
              >
                {resendCooldown > 0
                  ? `Resend in ${resendCooldown}s`
                  : 'Resend OTP'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default OtpScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#500088',
  },
  content: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 20,
  },

  // ── Back ──────────────────────────────────────────────
  backBtn: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    marginBottom: 12,
  },
  backText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 15,
    fontWeight: '500',
  },

  // ── Header ────────────────────────────────────────────
  header: {
    alignItems: 'center',
    marginBottom: 36,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  iconEmoji: {
    fontSize: 32,
  },
  title: {
    fontSize: 24,
    color: '#FFFFFF',
    fontWeight: '700',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.65)',
  },
  emailText: {
    fontSize: 15,
    color: '#FFD600',
    fontWeight: '600',
    marginTop: 4,
  },

  // ── OTP Inputs ────────────────────────────────────────
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 20,
  },
  otpInput: {
    width: 48,
    height: 56,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
  },
  otpInputFilled: {
    borderColor: '#FFD600',
    backgroundColor: 'rgba(255,214,0,0.1)',
  },
  otpInputError: {
    borderColor: '#ef4444',
    backgroundColor: 'rgba(239,68,68,0.1)',
  },

  // ── Timer ─────────────────────────────────────────────
  timerRow: {
    alignItems: 'center',
    marginBottom: 16,
  },
  timerText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
  },
  timerBold: {
    fontWeight: '700',
    color: 'rgba(255,255,255,0.85)',
  },
  timerExpired: {
    fontSize: 13,
    color: '#ef4444',
    fontWeight: '600',
  },

  // ── Error / Success ───────────────────────────────────
  errorBanner: {
    backgroundColor: 'rgba(239,68,68,0.15)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#ef4444',
  },
  errorText: {
    color: '#fca5a5',
    fontSize: 13,
  },
  successBanner: {
    backgroundColor: 'rgba(34,197,94,0.15)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#22c55e',
  },
  successText: {
    color: '#86efac',
    fontSize: 13,
  },

  // ── Verify Button ─────────────────────────────────────
  verifyBtn: {
    backgroundColor: '#FFD600',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#FFD600',
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  verifyBtnDisabled: {
    opacity: 0.5,
  },
  verifyBtnText: {
    color: '#1A1A1A',
    fontWeight: '800',
    fontSize: 16,
    letterSpacing: 0.5,
  },

  // ── Resend ────────────────────────────────────────────
  resendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  resendLabel: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
  },
  resendBtn: {
    fontSize: 13,
    color: '#FFD600',
    fontWeight: '700',
  },
  resendBtnDisabled: {
    color: 'rgba(255,255,255,0.3)',
    fontWeight: '400',
  },
});
