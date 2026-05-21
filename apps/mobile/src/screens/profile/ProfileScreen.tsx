import React, { useState } from "react";
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
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import { useAuthStore } from "@store/authStore";
import { submitUserProfile, parseDateInput, normalizeUsername, optionalString } from "@services/profileService";

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

const ProfileScreen = () => {
  const navigation = useNavigation<any>();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);

  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [dob, setDob] = useState("");
  const [gender, setGender] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [loading, setLoading] = useState(false);

  const roleLabel = user?.role ? ROLE_LABELS[user.role] ?? user.role : "";

  const handleContinue = async () => {
    if (!user) return;

    if (!fullName.trim()) {
      Alert.alert("Required", "Please enter your full name.");
      return;
    }
    if (!username.trim()) {
      Alert.alert("Required", "Please choose a username.");
      return;
    }

    setLoading(true);
    try {
      await submitUserProfile(user.id, {
        fullName: optionalString(fullName),
        username: normalizeUsername(username),
        dob: parseDateInput(dob, "DMY"),
        gender: optionalString(gender),
        city: optionalString(city),
        state: optionalString(state),
      });

      setUser({ ...user, profileComplete: true });
      navigation.navigate("ProfileDetails");
    } catch (error: unknown) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response
          ?.data?.message ?? "We could not save your profile. Please try again.";
      Alert.alert("Unable to continue", message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F6F6F6" />

      {/* HEADER */}
      <View style={styles.topHeader}>
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
          <View style={styles.inputContainer}>
            <TextInput
              placeholder="e.g. Priya Sharma"
              placeholderTextColor="#A89BB0"
              style={styles.input}
              value={fullName}
              onChangeText={setFullName}
            />
          </View>

          {/* Username */}
          <Text style={styles.fieldLabel}>Username *</Text>
          <View style={styles.usernameInputContainer}>
            <Text style={styles.atSymbol}>@</Text>
            <TextInput
              placeholder="your_username"
              placeholderTextColor="#A89BB0"
              style={styles.usernameInput}
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
            />
          </View>

          {/* DOB */}
          <Text style={styles.fieldLabel}>Date of Birth</Text>
          <View style={styles.inputContainer}>
            <TextInput
              placeholder="DD/MM/YYYY"
              placeholderTextColor="#A89BB0"
              style={styles.input}
              value={dob}
              onChangeText={setDob}
              keyboardType="numbers-and-punctuation"
            />
          </View>
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
              <Text style={styles.buttonText}>Complete Profile</Text>
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
    alignItems: "center",
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
    marginBottom: 14,
  },

  input: {
    height: 52,
    paddingHorizontal: 16,
    fontSize: 15,
    color: "#1A1B20",
    fontFamily: "PlusJakartaSans-Regular",
  },

  usernameInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F4F3FA",
    borderRadius: 14,
    paddingHorizontal: 16,
    marginBottom: 14,
    height: 52,
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
