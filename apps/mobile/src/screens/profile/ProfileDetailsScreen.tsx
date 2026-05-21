import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  TextInput,
  StatusBar,
  ActivityIndicator,
  Alert,
} from "react-native";

import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import { useAuthStore } from "@store/authStore";
import { submitProfileDetails } from "@services/profileService";

// ─────────────────────────────────────────────────────────
// ProfileDetailsScreen
//
// Step 2 of profile onboarding — role-specific details.
// Shown after ProfileScreen (basic info). Shows only the
// section(s) that are relevant to the user's selected role.
//
// Role → Section(s) shown:
//   pwd        → My Disability
//   caregiver  → Person I Care For
//   therapist  → Professional Info
//   ngo        → NGO Info
//   volunteer  → (no role-specific section; shows generic bio)
//   student    → (no role-specific section; shows generic bio)
// ─────────────────────────────────────────────────────────

const disabilityOptions = [
  "Visual",
  "Hearing",
  "Mobility",
  "Cognitive",
  "Speech",
];

const supportOptions = [
  "Mobility",
  "Communication",
  "Learning",
  "Daily Tasks",
];

const ProfileDetailsScreen = () => {
  const navigation = useNavigation<any>();
  const user = useAuthStore((s) => s.user);
  const role = user?.role ?? "";

  // ── PwD ──────────────────────────────────────────────────
  const [selectedDisability, setSelectedDisability] = useState("Hearing");
  const [disabilitySince, setDisabilitySince] = useState("");
  const [selectedSupport, setSelectedSupport] = useState("Communication");

  // ── Caregiver ─────────────────────────────────────────────
  const [personName, setPersonName] = useState("");
  const [relation, setRelation] = useState("");
  const [careeDob, setCareeDob] = useState("");
  const [careDisability, setCareDisability] = useState("");

  // ── Therapist / Educator ──────────────────────────────────
  const [speciality, setSpeciality] = useState("");
  const [organization, setOrganization] = useState("");
  const [experience, setExperience] = useState("");

  // ── NGO ───────────────────────────────────────────────────
  const [ngoName, setNgoName] = useState("");
  const [ngoRole, setNgoRole] = useState("");
  const [district, setDistrict] = useState("");

  const [loading, setLoading] = useState(false);

  // ── Build payload based on role ───────────────────────────
  const buildPayload = () => {
    switch (role) {
      case "pwd":
        return {
          disabilityType: selectedDisability,
          disabilitySince: disabilitySince.trim() || undefined,
          supportNeeded: selectedSupport,
        };
      case "caregiver":
        return {
          carePersonName: personName.trim() || undefined,
          careRelation: relation.trim() || undefined,
          careDob: careeDob.trim() || undefined,
          careDisabilityType: careDisability.trim() || undefined,
        };
      case "therapist":
        return {
          speciality: speciality.trim() || undefined,
          organization: organization.trim() || undefined,
          yearsOfExperience: experience.trim() || undefined,
        };
      case "ngo":
        return {
          ngoName: ngoName.trim() || undefined,
          ngoRole: ngoRole.trim() || undefined,
          district: district.trim() || undefined,
        };
      default:
        return {};
    }
  };

  const handleComplete = async () => {
    setLoading(true);
    try {
      if (user?.id) {
        await submitProfileDetails(user.id, buildPayload());
      }
      navigation.navigate("CareCircle");
    } catch (error: unknown) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response
          ?.data?.message ??
        "We could not save your details. You can update them later.";
      Alert.alert("Notice", message, [
        {
          text: "Continue anyway",
          onPress: () => navigation.navigate("CareCircle"),
        },
        { text: "Retry", style: "cancel" },
      ]);
    } finally {
      setLoading(false);
    }
  };

  // ── Skip (for roles with no specific section) ────────────
  const hasRoleSection = ["pwd", "caregiver", "therapist", "ngo"].includes(role);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FAF8FF" />

      {/* BACKGROUND BLOBS */}
      <View style={styles.topBlob} />
      <View style={styles.bottomBlob} />

      {/* HEADER */}
      <View style={styles.topHeader}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          accessibilityLabel="Go back"
        >
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>

        {/* Progress: 4 steps, step 4 active */}
        <View style={styles.progressWrapper}>
          <View style={styles.inactiveProgress} />
          <View style={styles.inactiveProgress} />
          <View style={styles.inactiveProgress} />
          <View style={styles.activeProgress} />
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scrollContent}
      >
        {/* HERO */}
        <View style={styles.heroSection}>
          <Text style={styles.heroTitle}>A little more about you</Text>
          <Text style={styles.heroSubtitle}>
            Help us personalise your experience
          </Text>
        </View>

        {/* ── SECTION C: My Disability (PwD) ───────────────── */}
        {role === "pwd" && (
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>My Disability</Text>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>OPTIONAL</Text>
              </View>
            </View>

            {/* Disability Type */}
            <View style={styles.field}>
              <Text style={styles.label}>Disability Type</Text>
              <View style={styles.chipsContainer}>
                {disabilityOptions.map((item) => {
                  const selected = selectedDisability === item;
                  return (
                    <TouchableOpacity
                      key={item}
                      onPress={() => setSelectedDisability(item)}
                      style={[styles.chip, selected && styles.selectedChip]}
                      accessibilityState={{ selected }}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          selected && styles.selectedChipText,
                        ]}
                      >
                        {item}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Since */}
            <View style={styles.field}>
              <Text style={styles.label}>Disability Since</Text>
              <TextInput
                placeholder="Year (e.g. 1995)"
                placeholderTextColor="rgba(126,115,131,0.6)"
                style={styles.input}
                value={disabilitySince}
                onChangeText={setDisabilitySince}
                keyboardType="number-pad"
                maxLength={4}
              />
            </View>

            {/* Support Needed */}
            <View style={[styles.field, styles.lastField]}>
              <Text style={styles.label}>Support Needed</Text>
              <View style={styles.chipsContainer}>
                {supportOptions.map((item) => {
                  const selected = selectedSupport === item;
                  return (
                    <TouchableOpacity
                      key={item}
                      onPress={() => setSelectedSupport(item)}
                      style={[styles.chip, selected && styles.selectedChip]}
                      accessibilityState={{ selected }}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          selected && styles.selectedChipText,
                        ]}
                      >
                        {item}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </View>
        )}

        {/* ── SECTION D: Person I Care For (Caregiver) ─────── */}
        {role === "caregiver" && (
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Person I Care For</Text>
              <View style={styles.yellowBadge}>
                <Text style={styles.yellowBadgeText}>CAREGIVER</Text>
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Person Name</Text>
              <TextInput
                placeholder="Enter full name"
                placeholderTextColor="rgba(126,115,131,0.6)"
                style={styles.input}
                value={personName}
                onChangeText={setPersonName}
              />
            </View>

            <View style={styles.row}>
              <View style={styles.halfField}>
                <Text style={styles.label}>Relation</Text>
                <TextInput
                  placeholder="Parent"
                  placeholderTextColor="rgba(126,115,131,0.6)"
                  style={styles.input}
                  value={relation}
                  onChangeText={setRelation}
                />
              </View>

              <View style={styles.halfField}>
                <Text style={styles.label}>DOB</Text>
                <TextInput
                  placeholder="DD/MM/YYYY"
                  placeholderTextColor="rgba(126,115,131,0.6)"
                  style={styles.input}
                  value={careeDob}
                  onChangeText={setCareeDob}
                  keyboardType="numbers-and-punctuation"
                />
              </View>
            </View>

            <View style={[styles.field, styles.lastField]}>
              <Text style={styles.label}>Disability Type</Text>
              <TextInput
                placeholder="Specify disability type"
                placeholderTextColor="rgba(126,115,131,0.6)"
                style={styles.input}
                value={careDisability}
                onChangeText={setCareDisability}
              />
            </View>
          </View>
        )}

        {/* ── SECTION E: Professional Info (Therapist) ──────── */}
        {role === "therapist" && (
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Professional Info</Text>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>EDUCATOR</Text>
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Specialty</Text>
              <TextInput
                placeholder="Select specialty"
                placeholderTextColor="rgba(126,115,131,0.6)"
                style={styles.input}
                value={speciality}
                onChangeText={setSpeciality}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Organization</Text>
              <TextInput
                placeholder="Company or School Name"
                placeholderTextColor="rgba(126,115,131,0.6)"
                style={styles.input}
                value={organization}
                onChangeText={setOrganization}
              />
            </View>

            <View style={[styles.field, styles.lastField]}>
              <Text style={styles.label}>Years of Experience</Text>
              <TextInput
                placeholder="Enter years of experience"
                placeholderTextColor="rgba(126,115,131,0.6)"
                style={styles.input}
                value={experience}
                onChangeText={setExperience}
                keyboardType="number-pad"
              />
            </View>
          </View>
        )}

        {/* ── SECTION F: NGO Info ───────────────────────────── */}
        {role === "ngo" && (
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>NGO Info</Text>
              <View style={styles.yellowBadge}>
                <Text style={styles.yellowBadgeText}>NGO</Text>
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Organization Name</Text>
              <TextInput
                placeholder="Full NGO Name"
                placeholderTextColor="rgba(126,115,131,0.6)"
                style={styles.input}
                value={ngoName}
                onChangeText={setNgoName}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Role</Text>
              <TextInput
                placeholder="Your designation"
                placeholderTextColor="rgba(126,115,131,0.6)"
                style={styles.input}
                value={ngoRole}
                onChangeText={setNgoRole}
              />
            </View>

            <View style={[styles.field, styles.lastField]}>
              <Text style={styles.label}>District of Operation</Text>
              <TextInput
                placeholder="Enter district"
                placeholderTextColor="rgba(126,115,131,0.6)"
                style={styles.input}
                value={district}
                onChangeText={setDistrict}
              />
            </View>
          </View>
        )}

        {/* ── Fallback for roles without a specific section ─── */}
        {!hasRoleSection && (
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>You're all set!</Text>
            </View>
            <Text style={styles.fallbackText}>
              Your profile is ready. You can add more details anytime from
              Settings.
            </Text>
          </View>
        )}

        <Text style={styles.footnote}>
          All fields are optional — you can fill them in anytime.
        </Text>
      </ScrollView>

      {/* FOOTER BUTTON */}
      <View style={styles.footer}>
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={handleComplete}
          disabled={loading}
          style={styles.buttonWrapper}
          accessibilityLabel="Complete Profile"
        >
          <LinearGradient
            colors={["#FEC800", "#FEA619"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.button}
          >
            {loading ? (
              <ActivityIndicator color="#000" />
            ) : (
              <>
                <Text style={styles.buttonText}>Complete Profile</Text>
                <Text style={styles.buttonArrow}>→</Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

export default ProfileDetailsScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FAF8FF",
  },

  topBlob: {
    position: "absolute",
    width: 256,
    height: 256,
    borderRadius: 999,
    backgroundColor: "rgba(80,0,136,0.05)",
    right: -96,
    top: -96,
  },

  bottomBlob: {
    position: "absolute",
    width: 256,
    height: 256,
    borderRadius: 999,
    backgroundColor: "rgba(133,83,0,0.05)",
    left: -96,
    bottom: 200,
  },

  // HEADER
  topHeader: {
    height: 64,
    paddingHorizontal: 24,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "rgba(249,248,255,0.8)",
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
    gap: 8,
  },

  inactiveProgress: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: "rgba(207,194,212,0.5)",
  },

  activeProgress: {
    width: 24,
    height: 8,
    borderRadius: 999,
    backgroundColor: "#6B21A8",
  },

  // SCROLL
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 140,
    gap: 20,
  },

  // HERO
  heroSection: {
    marginBottom: 4,
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
  },

  // CARD
  sectionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 20,
    shadowColor: "#500088",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },

  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#500088",
    fontFamily: "PlusJakartaSans-Bold",
  },

  badge: {
    backgroundColor: "rgba(80,0,136,0.1)",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
  },

  badgeText: {
    color: "#500088",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1,
    fontFamily: "PlusJakartaSans-Bold",
  },

  yellowBadge: {
    backgroundColor: "rgba(254,166,25,0.2)",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
  },

  yellowBadgeText: {
    color: "#855300",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1,
    fontFamily: "PlusJakartaSans-Bold",
  },

  // FIELD
  field: {
    marginBottom: 16,
  },

  lastField: {
    marginBottom: 0,
  },

  label: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: "#4C4452",
    marginBottom: 10,
    fontFamily: "PlusJakartaSans-Bold",
  },

  input: {
    height: 52,
    backgroundColor: "#F4F3FA",
    borderRadius: 14,
    paddingHorizontal: 16,
    fontSize: 15,
    color: "#1A1B20",
    fontFamily: "PlusJakartaSans-Regular",
  },

  // ROW (caregiver half-fields)
  row: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },

  halfField: {
    flex: 1,
  },

  // CHIPS
  chipsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },

  chip: {
    backgroundColor: "#F4F3FA",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "transparent",
  },

  selectedChip: {
    backgroundColor: "#F3EAFF",
    borderColor: "#8A38F5",
  },

  chipText: {
    color: "#636363",
    fontSize: 13,
    fontWeight: "500",
    fontFamily: "PlusJakartaSans-Regular",
  },

  selectedChipText: {
    color: "#6B21A8",
    fontWeight: "700",
    fontFamily: "PlusJakartaSans-Bold",
  },

  // FALLBACK
  fallbackText: {
    fontSize: 15,
    color: "#636363",
    lineHeight: 22,
    fontFamily: "PlusJakartaSans-Regular",
  },

  // FOOTNOTE
  footnote: {
    fontSize: 12,
    color: "#A89BB0",
    textAlign: "center",
    fontStyle: "italic",
    fontFamily: "PlusJakartaSans-Regular",
  },

  // FOOTER
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingBottom: 32,
    paddingTop: 12,
    backgroundColor: "rgba(250,248,255,0.95)",
    borderTopWidth: 1,
    borderTopColor: "rgba(207,194,212,0.15)",
  },

  buttonWrapper: {
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#FEA619",
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },

  button: {
    height: 58,
    borderRadius: 16,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },

  buttonText: {
    fontSize: 17,
    fontWeight: "700",
    color: "#000000",
    fontFamily: "Nunito-Bold",
  },

  buttonArrow: {
    fontSize: 20,
    color: "#000000",
    fontWeight: "700",
  },
});
