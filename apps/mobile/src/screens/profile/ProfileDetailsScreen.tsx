import React, { useState, useCallback } from "react";
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
  BackHandler,
} from "react-native";

import { LinearGradient } from "expo-linear-gradient";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { useAuthStore } from "@store/authStore";
import { submitFullOnboarding, parseDateInput } from "@services/profileService";

// ─────────────────────────────────────────────────────────
// ProfileDetailsScreen
//
// Step 4 of profile onboarding — role-specific details.
// This is the ONLY screen that writes to the database.
// It atomically commits: role → basic profile → role details.
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

const CURRENT_YEAR = new Date().getFullYear();

const ProfileDetailsScreen = () => {
  const navigation = useNavigation<any>();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const clearPending = useAuthStore((s) => s.clearPending);
  const pendingRole = useAuthStore((s) => s.pendingRole);
  const pendingProfile = useAuthStore((s) => s.pendingProfile);

  // Use pending role (from onboarding) — fall back to DB role for returning users
  const role = pendingRole ?? user?.role ?? "";

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
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // ── Back Guard ─────────────────────────────────────────────
  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        Alert.alert(
          "Go Back?",
          "Your role selection and basic info will be kept. Do you want to go back?",
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

  // ── Field validation per role ──────────────────────────────
  const validateFields = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (role === "pwd") {
      if (disabilitySince.trim()) {
        const year = parseInt(disabilitySince.trim(), 10);
        if (isNaN(year) || year < 1900 || year > CURRENT_YEAR) {
          newErrors.disabilitySince = `Year must be between 1900 and ${CURRENT_YEAR}.`;
        }
      }
    }

    if (role === "caregiver") {
      if (!personName.trim()) {
        newErrors.personName = "Person's name is required.";
      }
      if (careeDob.trim()) {
        const parsed = parseDateInput(careeDob.trim(), "DMY");
        if (!parsed) {
          newErrors.careeDob = "Invalid date. Use DD/MM/YYYY format.";
        } else if (new Date(parsed) > new Date()) {
          newErrors.careeDob = "Date of birth cannot be in the future.";
        }
      }
    }

    if (role === "therapist") {
      if (!speciality.trim()) {
        newErrors.speciality = "Specialty is required.";
      }
      if (experience.trim()) {
        const years = parseInt(experience.trim(), 10);
        if (isNaN(years) || years < 0 || years > 60) {
          newErrors.experience = "Years of experience must be between 0 and 60.";
        }
      }
    }

    if (role === "ngo") {
      if (!ngoName.trim()) {
        newErrors.ngoName = "Organization name is required.";
      }
    }

    setFieldErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ── Build role-specific payload ───────────────────────────
  const buildRolePayload = () => {
    switch (role) {
      case "pwd":
        return {
          disabilityType: selectedDisability,
          disabilitySince: disabilitySince.trim()
            ? parseInt(disabilitySince.trim(), 10)
            : undefined,
          supportNeeded: selectedSupport,
        };
      case "caregiver":
        return {
          carePersonName: personName.trim() || undefined,
          careRelation: relation.trim() || undefined,
          careDob: careeDob.trim()
            ? parseDateInput(careeDob.trim(), "DMY")
            : undefined,
          careDisabilityType: careDisability.trim() || undefined,
        };
      case "therapist":
        return {
          speciality: speciality.trim() || undefined,
          organization: organization.trim() || undefined,
          yearsOfExperience: experience.trim()
            ? parseInt(experience.trim(), 10)
            : undefined,
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

  // ── Final Submit — only DB write in the entire onboarding ──
  const handleComplete = async () => {
    if (!user?.id) return;
    if (!validateFields()) return;

    setLoading(true);
    try {
      await submitFullOnboarding({
        userId: user.id,
        role,
        basicProfile: pendingProfile ?? {},
        roleDetails: buildRolePayload(),
      });

      // Update local user state
      setUser({ ...user, role, profileComplete: true });
      clearPending();

      navigation.navigate("CareCircle");
    } catch (error: unknown) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response
          ?.data?.message ??
        "We could not save your details. Please try again.";
      Alert.alert("Unable to Complete Profile", message, [
        { text: "Retry", style: "cancel" },
      ]);
    } finally {
      setLoading(false);
    }
  };

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
          onPress={() =>
            Alert.alert(
              "Go Back?",
              "Your role and basic info will be kept. Do you want to go back?",
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
              <Text style={styles.label}>Disability Since (Year)</Text>
              <TextInput
                placeholder={`Year (e.g. ${CURRENT_YEAR - 10})`}
                placeholderTextColor="rgba(126,115,131,0.6)"
                style={[
                  styles.input,
                  fieldErrors.disabilitySince ? styles.inputError : null,
                ]}
                value={disabilitySince}
                onChangeText={(v) => {
                  setDisabilitySince(v);
                  setFieldErrors((e) => ({ ...e, disabilitySince: "" }));
                }}
                keyboardType="number-pad"
                maxLength={4}
              />
              {fieldErrors.disabilitySince ? (
                <Text style={styles.inlineError}>{fieldErrors.disabilitySince}</Text>
              ) : null}
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
              <Text style={styles.label}>Person Name *</Text>
              <TextInput
                placeholder="Enter full name"
                placeholderTextColor="rgba(126,115,131,0.6)"
                style={[
                  styles.input,
                  fieldErrors.personName ? styles.inputError : null,
                ]}
                value={personName}
                onChangeText={(v) => {
                  setPersonName(v);
                  setFieldErrors((e) => ({ ...e, personName: "" }));
                }}
              />
              {fieldErrors.personName ? (
                <Text style={styles.inlineError}>{fieldErrors.personName}</Text>
              ) : null}
            </View>

            <View style={styles.row}>
              <View style={styles.halfField}>
                <Text style={styles.label}>Relation</Text>
                <TextInput
                  placeholder="e.g. Parent"
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
                  style={[
                    styles.input,
                    fieldErrors.careeDob ? styles.inputError : null,
                  ]}
                  value={careeDob}
                  onChangeText={(v) => {
                    setCareeDob(v);
                    setFieldErrors((e) => ({ ...e, careeDob: "" }));
                  }}
                  keyboardType="numbers-and-punctuation"
                />
              </View>
            </View>
            {fieldErrors.careeDob ? (
              <Text style={styles.inlineError}>{fieldErrors.careeDob}</Text>
            ) : null}

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
                <Text style={styles.badgeText}>THERAPIST</Text>
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Specialty *</Text>
              <TextInput
                placeholder="e.g. Occupational Therapy"
                placeholderTextColor="rgba(126,115,131,0.6)"
                style={[
                  styles.input,
                  fieldErrors.speciality ? styles.inputError : null,
                ]}
                value={speciality}
                onChangeText={(v) => {
                  setSpeciality(v);
                  setFieldErrors((e) => ({ ...e, speciality: "" }));
                }}
              />
              {fieldErrors.speciality ? (
                <Text style={styles.inlineError}>{fieldErrors.speciality}</Text>
              ) : null}
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
                placeholder="e.g. 5"
                placeholderTextColor="rgba(126,115,131,0.6)"
                style={[
                  styles.input,
                  fieldErrors.experience ? styles.inputError : null,
                ]}
                value={experience}
                onChangeText={(v) => {
                  setExperience(v);
                  setFieldErrors((e) => ({ ...e, experience: "" }));
                }}
                keyboardType="number-pad"
              />
              {fieldErrors.experience ? (
                <Text style={styles.inlineError}>{fieldErrors.experience}</Text>
              ) : null}
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
              <Text style={styles.label}>Organization Name *</Text>
              <TextInput
                placeholder="Full NGO Name"
                placeholderTextColor="rgba(126,115,131,0.6)"
                style={[
                  styles.input,
                  fieldErrors.ngoName ? styles.inputError : null,
                ]}
                value={ngoName}
                onChangeText={(v) => {
                  setNgoName(v);
                  setFieldErrors((e) => ({ ...e, ngoName: "" }));
                }}
              />
              {fieldErrors.ngoName ? (
                <Text style={styles.inlineError}>{fieldErrors.ngoName}</Text>
              ) : null}
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Your Role</Text>
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

        {/* ── Fallback for volunteer / student ─────────────── */}
        {!hasRoleSection && (
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>You're all set!</Text>
            </View>
            <Text style={styles.fallbackText}>
              Your profile is ready to be saved. Tap "Complete Profile" to
              finish.
            </Text>
          </View>
        )}

        <Text style={styles.footnote}>
          {hasRoleSection
            ? "Fields marked * are required. Others are optional."
            : "You can add more details anytime from Settings."}
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
    borderWidth: 1.5,
    borderColor: "transparent",
  },

  inputError: {
    borderColor: "#DC2626",
    backgroundColor: "#FEF2F2",
  },

  inlineError: {
    fontSize: 12,
    color: "#DC2626",
    marginTop: 4,
    marginLeft: 4,
    fontFamily: "PlusJakartaSans-Regular",
  },

  // ROW (caregiver half-fields)
  row: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 4,
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
