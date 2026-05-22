import React, { useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  Alert,
  BackHandler,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { useAuthStore } from "@store/authStore";
import {
  checkUsernameAvailability,
  normalizeUsername,
  parseDateInput,
  optionalString,
} from "@services/profileService";

const GENDERS = ["Male", "Female", "Non-binary", "Prefer not to say"];

// Role display label map
const ROLE_LABELS: Record<string, string> = {
  pwd: "PwD",
  caregiver: "Caregiver",
  therapist: "Therapist",
  ngo: "NGO",
  volunteer: "Volunteer",
  student: "Student",
};

// Username format regex (mirrors backend)
const USERNAME_REGEX = /^[a-z0-9_.]{3,20}$/;

type FieldErrors = {
  fullName?: string;
  username?: string;
  dob?: string;
};

type UsernameStatus = "idle" | "checking" | "available" | "taken" | "invalid";

const ProfileScreen = () => {
  const navigation = useNavigation<any>();
  const user = useAuthStore((s) => s.user);
  const setPendingProfile = useAuthStore((s) => s.setPendingProfile);
  const pendingRole = useAuthStore((s) => s.pendingRole);

  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [dob, setDob] = useState("");
  const [gender, setGender] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [loading, setLoading] = useState(false);

  const [errors, setErrors] = useState<FieldErrors>({});
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>("idle");
  const [usernameMessage, setUsernameMessage] = useState("");

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const roleLabel = pendingRole
    ? ROLE_LABELS[pendingRole] ?? pendingRole
    : user?.role
    ? ROLE_LABELS[user.role] ?? user.role
    : "";

  // ── Back Guard ─────────────────────────────────────────────
  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        Alert.alert(
          "Go Back?",
          "Your role selection will be kept. Do you want to go back to role selection?",
          [
            { text: "Stay", style: "cancel" },
            {
              text: "Go Back",
              style: "destructive",
              onPress: () => navigation.goBack(),
            },
          ]
        );
        return true;
      };

      const subscription = BackHandler.addEventListener(
        "hardwareBackPress",
        onBackPress
      );
      return () => subscription.remove();
    }, [navigation])
  );

  // ── Real-time username check ───────────────────────────────
  const handleUsernameChange = (value: string) => {
    setUsername(value);
    const normalized = normalizeUsername(value) ?? "";

    if (!normalized) {
      setUsernameStatus("idle");
      setUsernameMessage("");
      return;
    }

    if (!USERNAME_REGEX.test(normalized)) {
      setUsernameStatus("invalid");
      setUsernameMessage(
        "3–20 characters: lowercase letters, numbers, _ or . only"
      );
      return;
    }

    setUsernameStatus("checking");
    setUsernameMessage("Checking availability...");

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const result = await checkUsernameAvailability(normalized);
      setUsernameStatus(result.available ? "available" : "taken");
      setUsernameMessage(result.message);
    }, 500);
  };

  // ── Validation ─────────────────────────────────────────────
  const validate = (): boolean => {
    const newErrors: FieldErrors = {};

    const trimmedName = fullName.trim();
    if (!trimmedName) {
      newErrors.fullName = "Full name is required.";
    } else if (trimmedName.length < 2) {
      newErrors.fullName = "Name must be at least 2 characters.";
    } else if (!/^[a-zA-Z\s'-]{2,100}$/.test(trimmedName)) {
      newErrors.fullName =
        "Name may only contain letters, spaces, hyphens, or apostrophes.";
    }

    const normalizedUser = normalizeUsername(username);
    if (!normalizedUser) {
      newErrors.username = "Username is required.";
    } else if (!USERNAME_REGEX.test(normalizedUser)) {
      newErrors.username =
        "3–20 characters: lowercase letters, numbers, _ or . only";
    } else if (usernameStatus === "taken") {
      newErrors.username = "This username is already taken.";
    } else if (usernameStatus === "checking") {
      newErrors.username = "Please wait while we verify your username.";
    }

    if (dob.trim()) {
      const parsed = parseDateInput(dob.trim(), "DMY");
      if (!parsed) {
        newErrors.dob = "Invalid date. Use DD/MM/YYYY format.";
      } else {
        const birthDate = new Date(parsed);
        const now = new Date();
        const minAge = new Date(
          now.getFullYear() - 5,
          now.getMonth(),
          now.getDate()
        );
        if (birthDate > now) {
          newErrors.dob = "Date of birth cannot be in the future.";
        } else if (birthDate > minAge) {
          newErrors.dob = "You must be at least 5 years old.";
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleContinue = () => {
    if (!user) return;
    if (!validate()) return;

    const normalizedUser = normalizeUsername(username);
    const parsedDob = dob.trim() ? parseDateInput(dob.trim(), "DMY") : undefined;

    // Store data locally — NOT written to DB yet.
    // The full DB write happens in ProfileDetailsScreen.
    setPendingProfile({
      fullName: optionalString(fullName),
      username: normalizedUser,
      dob: parsedDob,
      gender: optionalString(gender),
      city: optionalString(city),
      state: optionalString(state),
    });

    navigation.navigate("ProfileDetails");
  };

  // ── Username status indicator ──────────────────────────────
  const renderUsernameIndicator = () => {
    if (usernameStatus === "idle") return null;
    if (usernameStatus === "checking") {
      return <ActivityIndicator size="small" color="#7C3AED" style={styles.indicator} />;
    }
    const color =
      usernameStatus === "available"
        ? "#059669"
        : usernameStatus === "invalid"
        ? "#B45309"
        : "#DC2626";
    const icon =
      usernameStatus === "available" ? "✓" : "✗";
    return (
      <Text style={[styles.usernameIndicatorText, { color }]}>
        {icon} {usernameMessage}
      </Text>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F6F6F6" />

      {/* HEADER */}
      <View style={styles.topHeader}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() =>
            Alert.alert(
              "Go Back?",
              "Your role selection will be kept. Do you want to go back?",
              [
                { text: "Stay", style: "cancel" },
                {
                  text: "Go Back",
                  style: "destructive",
                  onPress: () => navigation.goBack(),
                },
              ]
            )
          }
          accessibilityLabel="Go back"
        >
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>

        <View style={styles.progressWrapper}>
          <View style={styles.inactiveProgress} />
          <View style={styles.inactiveProgress} />
          <View style={styles.activeProgress} />
          <View style={styles.inactiveProgress} />
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scrollContent}
      >
        {/* HERO */}
        <View style={styles.heroSection}>
          <Text style={styles.heroTitle}>Your Profile</Text>
          <Text style={styles.heroSubtitle}>
            Only share what you're comfortable with
          </Text>

          {/* Role Badge */}
          {roleLabel ? (
            <View style={styles.roleBadge}>
              <Text style={styles.roleBadgeText}>{roleLabel}</Text>
            </View>
          ) : null}
        </View>

        {/* BASIC INFO CARD */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>BASIC INFO</Text>

          {/* Full Name */}
          <Text style={styles.fieldLabel}>Full Name *</Text>
          <View
            style={[
              styles.inputContainer,
              errors.fullName ? styles.inputError : null,
            ]}
          >
            <TextInput
              placeholder="e.g. Priya Sharma"
              placeholderTextColor="#A89BB0"
              style={styles.input}
              value={fullName}
              onChangeText={(v) => {
                setFullName(v);
                if (errors.fullName) setErrors((e) => ({ ...e, fullName: undefined }));
              }}
            />
          </View>
          {errors.fullName ? (
            <Text style={styles.fieldError}>{errors.fullName}</Text>
          ) : null}

          {/* Username */}
          <Text style={styles.fieldLabel}>Username *</Text>
          <View
            style={[
              styles.usernameInputContainer,
              errors.username ? styles.inputError : null,
            ]}
          >
            <Text style={styles.atSymbol}>@</Text>
            <TextInput
              placeholder="your_username"
              placeholderTextColor="#A89BB0"
              style={styles.usernameInput}
              value={username}
              onChangeText={handleUsernameChange}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
          {renderUsernameIndicator()}
          {errors.username ? (
            <Text style={styles.fieldError}>{errors.username}</Text>
          ) : null}

          {/* DOB */}
          <Text style={styles.fieldLabel}>Date of Birth</Text>
          <View
            style={[
              styles.inputContainer,
              errors.dob ? styles.inputError : null,
            ]}
          >
            <TextInput
              placeholder="DD/MM/YYYY"
              placeholderTextColor="#A89BB0"
              style={styles.input}
              value={dob}
              onChangeText={(v) => {
                setDob(v);
                if (errors.dob) setErrors((e) => ({ ...e, dob: undefined }));
              }}
              keyboardType="numbers-and-punctuation"
            />
          </View>
          {errors.dob ? (
            <Text style={styles.fieldError}>{errors.dob}</Text>
          ) : null}
        </View>

        {/* GENDER CARD */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>GENDER</Text>
          <View style={styles.genderGrid}>
            {GENDERS.map((g) => {
              const selected = gender === g;
              return (
                <TouchableOpacity
                  key={g}
                  activeOpacity={0.8}
                  onPress={() => setGender(g)}
                  style={[styles.genderChip, selected && styles.genderChipSelected]}
                >
                  <Text
                    style={[
                      styles.genderChipText,
                      selected && styles.genderChipTextSelected,
                    ]}
                  >
                    {g}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* LOCATION CARD */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>LOCATION</Text>

          <Text style={styles.fieldLabel}>City</Text>
          <View style={styles.inputContainer}>
            <TextInput
              placeholder="e.g. Mumbai"
              placeholderTextColor="#A89BB0"
              style={styles.input}
              value={city}
              onChangeText={setCity}
            />
          </View>

          <Text style={styles.fieldLabel}>State</Text>
          <View style={styles.inputContainer}>
            <TextInput
              placeholder="e.g. Maharashtra"
              placeholderTextColor="#A89BB0"
              style={styles.input}
              value={state}
              onChangeText={setState}
            />
          </View>

          <View style={styles.noticeBox}>
            <Text style={styles.noticeText}>
              📍 Your location helps us connect you with nearby services
            </Text>
          </View>
        </View>

        <Text style={styles.footnote}>
          Fields marked * are required. You can edit your profile anytime.
        </Text>

        {/* BUTTON */}
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={handleContinue}
          disabled={loading}
          style={styles.buttonContainer}
        >
          <LinearGradient
            colors={["#500088", "#6B21A8"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.button}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Continue</Text>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

export default ProfileScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F6F6F6",
  },

  // HEADER
  topHeader: {
    paddingTop: 20,
    paddingHorizontal: 24,
    paddingBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(80,0,136,0.08)",
  },

  backArrow: {
    fontSize: 18,
    color: "#581C87",
    fontWeight: "700",
  },

  progressWrapper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  activeProgress: {
    width: 24,
    height: 8,
    borderRadius: 999,
    backgroundColor: "#6B21A8",
  },

  inactiveProgress: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: "rgba(207,194,212,0.5)",
  },

  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },

  // HERO
  heroSection: {
    marginTop: 16,
    marginBottom: 24,
  },

  heroTitle: {
    fontSize: 30,
    fontWeight: "700",
    color: "#232222",
    marginBottom: 6,
    fontFamily: "PlusJakartaSans-Bold",
  },

  heroSubtitle: {
    fontSize: 15,
    color: "#636363",
    fontFamily: "PlusJakartaSans-Regular",
    marginBottom: 14,
  },

  roleBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#F3EAFF",
    borderWidth: 1.5,
    borderColor: "#8A38F5",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 5,
  },

  roleBadgeText: {
    color: "#6B21A8",
    fontWeight: "700",
    fontSize: 13,
    fontFamily: "PlusJakartaSans-Bold",
  },

  // CARD
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },

  sectionLabel: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.1,
    color: "#4C4452",
    marginBottom: 16,
    fontFamily: "PlusJakartaSans-Bold",
  },

  fieldLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#4C4452",
    marginBottom: 8,
    marginTop: 4,
    fontFamily: "PlusJakartaSans-Regular",
  },

  inputContainer: {
    backgroundColor: "#F4F3FA",
    borderRadius: 14,
    marginBottom: 6,
    borderWidth: 1.5,
    borderColor: "transparent",
  },

  inputError: {
    borderColor: "#DC2626",
    backgroundColor: "#FEF2F2",
  },

  input: {
    height: 52,
    paddingHorizontal: 16,
    fontSize: 15,
    color: "#1A1B20",
    fontFamily: "PlusJakartaSans-Regular",
  },

  fieldError: {
    fontSize: 12,
    color: "#DC2626",
    marginBottom: 10,
    marginLeft: 4,
    fontFamily: "PlusJakartaSans-Regular",
  },

  usernameInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F4F3FA",
    borderRadius: 14,
    paddingHorizontal: 16,
    marginBottom: 4,
    height: 52,
    borderWidth: 1.5,
    borderColor: "transparent",
  },

  atSymbol: {
    fontSize: 18,
    color: "#500088",
    fontWeight: "700",
    marginRight: 4,
  },

  usernameInput: {
    flex: 1,
    fontSize: 15,
    color: "#1A1B20",
    fontFamily: "PlusJakartaSans-Regular",
  },

  usernameIndicatorText: {
    fontSize: 12,
    marginBottom: 6,
    marginLeft: 4,
    fontFamily: "PlusJakartaSans-Regular",
  },

  indicator: {
    alignSelf: "flex-start",
    marginBottom: 6,
    marginLeft: 4,
  },

  // GENDER
  genderGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 4,
  },

  genderChip: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "#F4F3FA",
    borderWidth: 1.5,
    borderColor: "transparent",
  },

  genderChipSelected: {
    backgroundColor: "#F3EAFF",
    borderColor: "#8A38F5",
  },

  genderChipText: {
    fontSize: 13,
    color: "#636363",
    fontWeight: "600",
    fontFamily: "PlusJakartaSans-Regular",
  },

  genderChipTextSelected: {
    color: "#6B21A8",
    fontFamily: "PlusJakartaSans-Bold",
  },

  // NOTICE
  noticeBox: {
    backgroundColor: "rgba(138,56,245,0.07)",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 4,
  },

  noticeText: {
    color: "#4C4452",
    fontSize: 12,
    fontFamily: "PlusJakartaSans-Regular",
    lineHeight: 18,
  },

  footnote: {
    fontSize: 12,
    color: "#A89BB0",
    textAlign: "center",
    marginBottom: 20,
    fontStyle: "italic",
    fontFamily: "PlusJakartaSans-Regular",
  },

  // BUTTON
  buttonContainer: {
    borderRadius: 14,
    overflow: "hidden",
    shadowColor: "#500088",
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
    marginBottom: 8,
  },

  button: {
    height: 60,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 14,
  },

  buttonText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
    fontFamily: "Nunito-Bold",
  },
});
