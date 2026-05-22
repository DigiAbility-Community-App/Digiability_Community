import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Image,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";

import { LinearGradient } from "expo-linear-gradient";

import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AuthStackParamList } from "@navigation/AuthNavigator";
import { login, register } from "@services/authService";

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, "Welcome">;
};

type ApiErrorShape = {
  response?: {
    data?: {
      message?: string;
      errors?: Array<{
        field?: string;
        message?: string;
      }>;
    };
  };
};

function getApiErrorMessage(error: unknown, fallback: string) {
  const apiError = error as ApiErrorShape;
  const fieldMessage = apiError.response?.data?.errors?.[0]?.message;
  const message = apiError.response?.data?.message;

  if (fieldMessage) return fieldMessage;
  if (message) return message;
  return fallback;
}

const WelcomeScreen = ({ navigation }: Props) => {
  const [activeTab, setActiveTab] = useState<"SignUp" | "Login">("SignUp");

  // SignUp
  const [name, setName] = useState("");
  const [signUpEmail, setSignUpEmail] = useState("");
  const [signUpPassword, setSignUpPassword] = useState("");
  const [showSignUpPassword, setShowSignUpPassword] = useState(false);

  // Login
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Shared
  const [loading, setLoading] = useState(false);

  // Errors
  const [signUpErrors, setSignUpErrors] = useState<{
    name?: string;
    email?: string;
    password?: string;
  }>({});

  const [loginErrors, setLoginErrors] = useState<{
    email?: string;
    password?: string;
  }>({});

  const [signUpGeneralError, setSignUpGeneralError] = useState<string | null>(null);
  const [loginGeneralError, setLoginGeneralError] = useState<string | null>(null);

  const handleTabChange = (tab: "SignUp" | "Login") => {
    // Clear inputs when switching tabs
    setName("");
    setSignUpEmail("");
    setSignUpPassword("");
    setLoginEmail("");
    setLoginPassword("");

    // Clear errors when switching tabs
    setSignUpErrors({});
    setLoginErrors({});
    setSignUpGeneralError(null);
    setLoginGeneralError(null);

    // Reset password visibility toggles
    setShowSignUpPassword(false);
    setShowLoginPassword(false);

    setActiveTab(tab);
  };

  // Validation helpers
  const validateSignUpEmail = (emailVal: string) => {
    const trimmed = emailVal.trim();
    if (!trimmed) {
      return "Email is required.";
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      return "Please enter a valid email address.";
    }
    return undefined;
  };

  const validateSignUpName = (nameVal: string) => {
    const trimmed = nameVal.trim();
    if (!trimmed) {
      return "Full name is required.";
    }
    if (trimmed.length < 2) {
      return "Name must be at least 2 characters.";
    }
    if (!/^[a-zA-Z\s'-]{2,100}$/.test(trimmed)) {
      return "Name may only contain letters, spaces, hyphens, or apostrophes.";
    }
    return undefined;
  };

  const validateSignUpPassword = (passwordVal: string) => {
    const trimmed = passwordVal.trim();
    if (!trimmed) {
      return "Password is required.";
    }
    if (trimmed.length < 8) {
      return "Password must be at least 8 characters.";
    }
    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(trimmed)) {
      return "Password must include uppercase, lowercase, and a number.";
    }
    return undefined;
  };

  const validateLoginEmail = (emailVal: string) => {
    const trimmed = emailVal.trim();
    if (!trimmed) {
      return "Email is required.";
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      return "Please enter a valid email address.";
    }
    return undefined;
  };

  const validateLoginPassword = (passwordVal: string) => {
    if (!passwordVal.trim()) {
      return "Password is required.";
    }
    return undefined;
  };

  // Signup
  const handleSignUp = async () => {
    setSignUpGeneralError(null);

    const nameErr = validateSignUpName(name);
    const emailErr = validateSignUpEmail(signUpEmail);
    const passwordErr = validateSignUpPassword(signUpPassword);

    if (nameErr || emailErr || passwordErr) {
      setSignUpErrors({
        name: nameErr,
        email: emailErr,
        password: passwordErr,
      });
      return;
    }

    const trimmedName = name.trim();
    const trimmedEmail = signUpEmail.trim().toLowerCase();
    const trimmedPassword = signUpPassword.trim();

    setLoading(true);

    try {
      await register({
        name: trimmedName,
        email: trimmedEmail,
        password: trimmedPassword,
      });
      // Navigate to OTP screen for email verification
      navigation.navigate('Otp', {
        email: signUpEmail.trim().toLowerCase(),
        name: name.trim(),
      });
    } catch (err: unknown) {
      console.error("[SignUpError]", err);
      setSignUpGeneralError(getApiErrorMessage(err, "Registration failed."));
    } finally {
      setLoading(false);
    }
  };

  // Login
  const handleLogin = async () => {
    setLoginGeneralError(null);

    const emailErr = validateLoginEmail(loginEmail);
    const passwordErr = validateLoginPassword(loginPassword);

    if (emailErr || passwordErr) {
      setLoginErrors({
        email: emailErr,
        password: passwordErr,
      });
      return;
    }

    const trimmedEmail = loginEmail.trim().toLowerCase();
    const trimmedPassword = loginPassword;

    setLoading(true);

    try {
      await login({
        email: trimmedEmail,
        password: trimmedPassword,
      });
    } catch (err: unknown) {
      console.error("[LoginError]", err);
      setLoginGeneralError(getApiErrorMessage(err, "Login failed."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* HEADER */}
      <LinearGradient
        colors={["#7C3AED", "#500088"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
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

          <Text style={styles.title}>Welcome to DigiAbility</Text>

          <Text style={styles.subtitle}>
            Your support network awaits
          </Text>
        </View>
      </LinearGradient>

      {/* MAIN CARD */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          style={styles.bottomCard}
          contentContainerStyle={styles.bottomContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* TABS */}
          <View style={styles.tabs}>
            <TouchableOpacity
              style={[
                styles.tabBtn,
                activeTab === "SignUp" && styles.activeTabBtn,
              ]}
              onPress={() => handleTabChange("SignUp")}
            >
              <Text
                style={
                  activeTab === "SignUp"
                    ? styles.activeTabText
                    : styles.inactiveTabText
                }
              >
                Sign Up
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.tabBtn,
                activeTab === "Login" && styles.activeTabBtn,
              ]}
              onPress={() => handleTabChange("Login")}
            >
              <Text
                style={
                  activeTab === "Login"
                    ? styles.activeTabText
                    : styles.inactiveTabText
                }
              >
                Login
              </Text>
            </TouchableOpacity>
          </View>

          {/* GENERAL ERROR BANNER */}
          {((activeTab === "SignUp" && signUpGeneralError) ||
            (activeTab === "Login" && loginGeneralError)) && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>
                {activeTab === "SignUp" ? signUpGeneralError : loginGeneralError}
              </Text>
            </View>
          )}

          {/* SIGNUP */}
          {activeTab === "SignUp" && (
            <View style={styles.form}>
              <View>
                <Text style={styles.label}>FULL NAME</Text>

                <TextInput
                  placeholder="Enter your full name"
                  placeholderTextColor="rgba(126,115,131,0.5)"
                  style={[styles.input, signUpErrors.name ? styles.inputError : null]}
                  value={name}
                  onChangeText={(val) => {
                    setName(val);
                    if (signUpErrors.name) {
                      setSignUpErrors((prev) => ({ ...prev, name: undefined }));
                    }
                  }}
                  onBlur={() => {
                    const err = validateSignUpName(name);
                    setSignUpErrors((prev) => ({ ...prev, name: err }));
                  }}
                />
                {signUpErrors.name ? (
                  <Text style={styles.fieldError}>{signUpErrors.name}</Text>
                ) : null}
              </View>

              <View>
                <Text style={styles.label}>EMAIL</Text>

                <TextInput
                  placeholder="you@example.com"
                  placeholderTextColor="rgba(126,115,131,0.5)"
                  style={[styles.input, signUpErrors.email ? styles.inputError : null]}
                  value={signUpEmail}
                  onChangeText={(val) => {
                    setSignUpEmail(val);
                    if (signUpErrors.email) {
                      setSignUpErrors((prev) => ({ ...prev, email: undefined }));
                    }
                  }}
                  onBlur={() => {
                    const err = validateSignUpEmail(signUpEmail);
                    setSignUpErrors((prev) => ({ ...prev, email: err }));
                  }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                {signUpErrors.email ? (
                  <Text style={styles.fieldError}>{signUpErrors.email}</Text>
                ) : null}
              </View>

              <View>
                <Text style={styles.label}>PASSWORD</Text>

                <View style={[styles.passwordInputContainer, signUpErrors.password ? styles.inputError : null]}>
                  <TextInput
                    placeholder="Min. 8 characters"
                    placeholderTextColor="rgba(126,115,131,0.5)"
                    style={styles.passwordInput}
                    value={signUpPassword}
                    onChangeText={(val) => {
                      setSignUpPassword(val);
                      if (signUpErrors.password) {
                        setSignUpErrors((prev) => ({ ...prev, password: undefined }));
                      }
                    }}
                    onBlur={() => {
                      const err = validateSignUpPassword(signUpPassword);
                      setSignUpErrors((prev) => ({ ...prev, password: err }));
                    }}
                    secureTextEntry={!showSignUpPassword}
                  />
                  <TouchableOpacity
                    style={styles.eyeButton}
                    onPress={() => setShowSignUpPassword(!showSignUpPassword)}
                  >
                    <Text style={styles.eyeText}>{showSignUpPassword ? "Hide" : "Show"}</Text>
                  </TouchableOpacity>
                </View>
                {signUpErrors.password ? (
                  <Text style={styles.fieldError}>{signUpErrors.password}</Text>
                ) : null}
              </View>

              <TouchableOpacity
                style={styles.ctaButton}
                onPress={handleSignUp}
                disabled={loading}
              >
                <LinearGradient
                  colors={["#500088", "#6B21A8"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.gradientButton}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.ctaText}>
                      Create Account
                    </Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          )}

          {/* LOGIN */}
          {activeTab === "Login" && (
            <View style={styles.form}>
              <View>
                <Text style={styles.label}>EMAIL</Text>

                <TextInput
                  placeholder="you@example.com"
                  placeholderTextColor="rgba(126,115,131,0.5)"
                  style={[styles.input, loginErrors.email ? styles.inputError : null]}
                  value={loginEmail}
                  onChangeText={(val) => {
                    setLoginEmail(val);
                    if (loginErrors.email) {
                      setLoginErrors((prev) => ({ ...prev, email: undefined }));
                    }
                  }}
                  onBlur={() => {
                    const err = validateLoginEmail(loginEmail);
                    setLoginErrors((prev) => ({ ...prev, email: err }));
                  }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                {loginErrors.email ? (
                  <Text style={styles.fieldError}>{loginErrors.email}</Text>
                ) : null}
              </View>

              <View>
                <Text style={styles.label}>PASSWORD</Text>

                <View style={[styles.passwordInputContainer, loginErrors.password ? styles.inputError : null]}>
                  <TextInput
                    placeholder="Your password"
                    placeholderTextColor="rgba(126,115,131,0.5)"
                    style={styles.passwordInput}
                    value={loginPassword}
                    onChangeText={(val) => {
                      setLoginPassword(val);
                      if (loginErrors.password) {
                        setLoginErrors((prev) => ({ ...prev, password: undefined }));
                      }
                    }}
                    onBlur={() => {
                      const err = validateLoginPassword(loginPassword);
                      setLoginErrors((prev) => ({ ...prev, password: err }));
                    }}
                    secureTextEntry={!showLoginPassword}
                  />
                  <TouchableOpacity
                    style={styles.eyeButton}
                    onPress={() => setShowLoginPassword(!showLoginPassword)}
                  >
                    <Text style={styles.eyeText}>{showLoginPassword ? "Hide" : "Show"}</Text>
                  </TouchableOpacity>
                </View>
                {loginErrors.password ? (
                  <Text style={styles.fieldError}>{loginErrors.password}</Text>
                ) : null}
              </View>

              <TouchableOpacity style={styles.forgotBtn}>
                <Text style={styles.forgotText}>
                  Forgot password?
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.ctaButton}
                onPress={handleLogin}
                disabled={loading}
              >
                <LinearGradient
                  colors={["#500088", "#6B21A8"]}
                  style={styles.gradientButton}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.ctaText}>Login</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          )}

          {/* DIVIDER */}
          <View style={styles.divider}>
            <View style={styles.line} />
            <Text style={styles.or}>or</Text>
            <View style={styles.line} />
          </View>

          {/* SOCIAL */}
          <View style={styles.socialRow}>
            <TouchableOpacity style={styles.socialBtn}>
              <Text style={styles.socialText}>🌐 Google</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.socialBtn}>
              <Text style={styles.socialText}>🍎 Apple</Text>
            </TouchableOpacity>
          </View>

          {/* FOOTER */}
          <Text style={styles.footer}>
            By continuing, you agree to our{" "}
            <Text style={styles.footerLink}>Terms</Text> &{" "}
            <Text style={styles.footerLink}>Privacy Policy</Text>
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default WelcomeScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FAF8FF",
  },

  // HEADER
  header: {
    height: "38%",
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
    marginTop: -32,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
  },

  bottomContent: {
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 64,
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
    borderWidth: 1.5,
    borderColor: "transparent",
  },

  inputError: {
    borderColor: "#DC2626",
    backgroundColor: "#FEF2F2",
  },

  fieldError: {
    fontSize: 12,
    color: "#DC2626",
    marginTop: 4,
    marginLeft: 4,
  },

  passwordInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F4F3FA",
    borderRadius: 12,
    paddingHorizontal: 18,
    borderWidth: 1.5,
    borderColor: "transparent",
  },

  passwordInput: {
    flex: 1,
    paddingVertical: 17,
    fontSize: 16,
    color: "#1A1B20",
  },

  eyeButton: {
    paddingLeft: 10,
    justifyContent: "center",
    alignItems: "center",
  },

  eyeText: {
    color: "#500088",
    fontWeight: "700",
    fontSize: 14,
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

  // DIVIDER
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 34,
  },

  line: {
    flex: 1,
    height: 1,
    backgroundColor: "#E8E7EE",
  },

  or: {
    marginHorizontal: 16,
    color: "#7E7383",
    fontSize: 14,
    fontWeight: "500",
  },

  // SOCIAL
  socialRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 14,
  },

  socialBtn: {
    flex: 1,
    height: 58,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#CFC2D4",
    justifyContent: "center",
    alignItems: "center",
  },

  socialText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1A1B20",
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