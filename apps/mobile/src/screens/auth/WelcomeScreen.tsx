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

  // ── Sign-Up fields ──────────────────────────────────────
  const [name, setName] = useState("");
  const [signUpEmail, setSignUpEmail] = useState("");
  const [signUpPassword, setSignUpPassword] = useState("");

  // ── Login fields ────────────────────────────────────────
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // ── Shared state ────────────────────────────────────────
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Helpers ─────────────────────────────────────────────
  const clearError = () => setError(null);

  const handleTabChange = (tab: "SignUp" | "Login") => {
    clearError();
    setActiveTab(tab);
  };

  // ── Sign Up ─────────────────────────────────────────────
  const handleSignUp = async () => {
    clearError();
    if (!name.trim() || !signUpEmail.trim() || !signUpPassword.trim()) {
      setError("Please fill in all fields.");
      return;
    }
    if (signUpPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(signUpPassword)) {
      setError("Password must include uppercase, lowercase, and a number.");
      return;
    }
    setLoading(true);
    try {
      await register({
        name: name.trim(),
        email: signUpEmail.trim().toLowerCase(),
        password: signUpPassword,
      });
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, "Registration failed. Please try again."));
    } finally {
      setLoading(false);
    }
  };

  // ── Login ────────────────────────────────────────────────
  const handleLogin = async () => {
    clearError();
    if (!loginEmail.trim() || !loginPassword.trim()) {
      setError("Please enter your email and password.");
      return;
    }
    setLoading(true);
    try {
      await login({
        email: loginEmail.trim().toLowerCase(),
        password: loginPassword,
      });
      // authStore is updated inside authService.login()
      // RootNavigator will auto-switch to Home when isAuthenticated = true
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, "Login failed. Check your credentials."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* TOP SECTION */}
      <View style={styles.header}>
        <View style={styles.logoBox}>
          <Image
            source={require("../../../assets/logo.png")}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>
        <Text style={styles.title}>Welcome to DigiAbility</Text>
        <Text style={styles.subtitle}>Your support network awaits</Text>
      </View>

      {/* BOTTOM SECTION */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          style={styles.bottom}
          contentContainerStyle={styles.bottomContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Tabs */}
          <View style={styles.tabs}>
            <TouchableOpacity
              style={[styles.tabBtn, activeTab === "SignUp" && styles.tabBtnActive]}
              onPress={() => handleTabChange("SignUp")}
            >
              <Text style={activeTab === "SignUp" ? styles.activeTab : styles.inactiveTab}>
                Sign Up
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tabBtn, activeTab === "Login" && styles.tabBtnActive]}
              onPress={() => handleTabChange("Login")}
            >
              <Text style={activeTab === "Login" ? styles.activeTab : styles.inactiveTab}>
                Login
              </Text>
            </TouchableOpacity>
          </View>

          {/* Error Banner */}
          {error && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* ── Sign Up Form ── */}
          {activeTab === "SignUp" && (
            <View style={styles.form}>
              <Text style={styles.label}>Full Name</Text>
              <TextInput
                placeholder="Enter your full name"
                placeholderTextColor="#aaa"
                style={styles.input}
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
                returnKeyType="next"
              />

              <Text style={styles.label}>Email</Text>
              <TextInput
                placeholder="you@example.com"
                placeholderTextColor="#aaa"
                style={styles.input}
                value={signUpEmail}
                onChangeText={setSignUpEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
              />

              <Text style={styles.label}>Password</Text>
              <TextInput
                placeholder="Min. 8 characters"
                placeholderTextColor="#aaa"
                style={styles.input}
                value={signUpPassword}
                onChangeText={setSignUpPassword}
                secureTextEntry
                returnKeyType="done"
                onSubmitEditing={handleSignUp}
              />

              <TouchableOpacity
                style={[styles.button, loading && styles.buttonDisabled]}
                onPress={handleSignUp}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>Create Account</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* ── Login Form ── */}
          {activeTab === "Login" && (
            <View style={styles.form}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                placeholder="you@example.com"
                placeholderTextColor="#aaa"
                style={styles.input}
                value={loginEmail}
                onChangeText={setLoginEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
              />

              <Text style={styles.label}>Password</Text>
              <TextInput
                placeholder="Your password"
                placeholderTextColor="#aaa"
                style={styles.input}
                value={loginPassword}
                onChangeText={setLoginPassword}
                secureTextEntry
                returnKeyType="done"
                onSubmitEditing={handleLogin}
              />

              <TouchableOpacity style={styles.forgotBtn}>
                <Text style={styles.forgotText}>Forgot password?</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.button, loading && styles.buttonDisabled]}
                onPress={handleLogin}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>Login</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* Divider */}
          <View style={styles.divider}>
            <View style={styles.line} />
            <Text style={styles.or}>or</Text>
            <View style={styles.line} />
          </View>

          {/* Social Buttons */}
          <View style={styles.socialRow}>
            <TouchableOpacity style={styles.socialBtn}>
              <Text style={styles.socialText}>🌐  Google</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.socialBtn}>
              <Text style={styles.socialText}>🍎  Apple</Text>
            </TouchableOpacity>
          </View>

          {/* Footer */}
          <Text style={styles.footer}>
            By continuing, you agree to our Terms & Privacy Policy
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
    backgroundColor: "#500088",
  },

  // ── Header ────────────────────────────────────────────────
  header: {
    height: "38%",
    backgroundColor: "#500088",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  logoBox: {
    width: 80,
    height: 80,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  logo: {
    width: 60,
    height: 60,
  },
  title: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  subtitle: {
    color: "rgba(255,255,255,0.7)",
    marginTop: 6,
    fontSize: 14,
  },

  // ── Bottom card ───────────────────────────────────────────
  bottom: {
    flex: 1,
    backgroundColor: "#fff",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  bottomContent: {
    padding: 24,
    paddingBottom: 40,
  },

  // ── Tabs ─────────────────────────────────────────────────
  tabs: {
    flexDirection: "row",
    backgroundColor: "#f4f3fa",
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
  },
  tabBtnActive: {
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  activeTab: {
    fontWeight: "700",
    color: "#500088",
    fontSize: 14,
  },
  inactiveTab: {
    color: "#999",
    fontSize: 14,
  },

  // ── Error banner ──────────────────────────────────────────
  errorBanner: {
    backgroundColor: "#ffeaea",
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: "#e53e3e",
  },
  errorText: {
    color: "#c53030",
    fontSize: 13,
  },

  // ── Form ──────────────────────────────────────────────────
  form: {
    gap: 8,
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
    color: "#555",
    marginTop: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: "#f4f3fa",
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: "#1a1a1a",
  },
  forgotBtn: {
    alignSelf: "flex-end",
    marginTop: 4,
  },
  forgotText: {
    fontSize: 13,
    color: "#500088",
    fontWeight: "500",
  },
  button: {
    backgroundColor: "#500088",
    padding: 16,
    borderRadius: 12,
    marginTop: 16,
    alignItems: "center",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#fff",
    textAlign: "center",
    fontWeight: "700",
    fontSize: 16,
  },

  // ── Divider ───────────────────────────────────────────────
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 24,
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: "#e8e8e8",
  },
  or: {
    marginHorizontal: 12,
    color: "#999",
    fontSize: 13,
  },

  // ── Social ────────────────────────────────────────────────
  socialRow: {
    flexDirection: "row",
    gap: 12,
  },
  socialBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    padding: 13,
    borderRadius: 12,
    alignItems: "center",
    backgroundColor: "#fafafa",
  },
  socialText: {
    fontSize: 14,
    color: "#333",
    fontWeight: "500",
  },

  // ── Footer ────────────────────────────────────────────────
  footer: {
    textAlign: "center",
    fontSize: 12,
    color: "#aaa",
    marginTop: 24,
    lineHeight: 18,
  },
});
