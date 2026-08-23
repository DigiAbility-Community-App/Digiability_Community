// ─────────────────────────────────────────────────────────
// ProfileDetailsScreen.tsx
// Updated for ALL 6 ROLES
// PwD
// Caregiver
// Educator
// NGO Worker
// Skill Trainer
// Community Member
// ─────────────────────────────────────────────────────────

import React, { useState, useCallback, useEffect } from "react";

import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
  BackHandler,
} from "react-native";

import DateTimePickerModal from "react-native-modal-datetime-picker";
import SafeScreen from "../../components/layout/SafeScreen";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  useNavigation,
  useFocusEffect,
} from "@react-navigation/native";

import { useAuthStore } from "@store/authStore";
import { logout } from "@services/authService";

import {
  submitFullOnboarding,
  parseDateInput,
} from "@services/profileService";
import apiClient from "@services/apiClient";
import { useTheme } from "../../theme/ThemeContext";
import { AccessibleText } from "../../components/shared/AccessibleText";
import { AccessibleButton } from "../../components/shared/AccessibleButton";

// ─────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────

const FALLBACK_DISABILITY_OPTIONS = [
  "Visual Impairment",
  "Locomotor Disability",
  "Hearing Impairment",
  "Intellectual Disability",
  "Autism Spectrum",
  "Speech & Language",
  "Physical Disability",
  "Mental Health",
  "Learning Disability",
  "Multiple Disabilities",
];

const CURRENT_YEAR = new Date().getFullYear();
const MIN_YEAR = 1900;

// ─────────────────────────────────────────────────────────
// SCREEN
// ─────────────────────────────────────────────────────────

const ProfileDetailsScreen = () => {
  const navigation = useNavigation<any>();
  const { colors, highContrast } = useTheme();

  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const clearPending = useAuthStore((s) => s.clearPending);
  const pendingRoles = useAuthStore((s) => s.pendingRoles);
  const pendingProfile = useAuthStore((s) => s.pendingProfile);

  const insets = useSafeAreaInsets();

  const roles = pendingRoles && pendingRoles.length > 0
    ? pendingRoles
    : (user?.roles && user.roles.length > 0 ? user.roles : (user?.role ? [user.role] : []));

  const role = roles[0] || "";

  // ───────────────── PwD ─────────────────

  const [selectedDisabilities, setSelectedDisabilities] = useState<string[]>([]);
  const [disabilitySince, setDisabilitySince] = useState("");

  const toggleDisability = (item: string) => {
    setSelectedDisabilities((prev) =>
      prev.includes(item) ? prev.filter((d) => d !== item) : [...prev, item]
    );
  };

  // ───────────────── Caregiver ─────────────────

  const [personName, setPersonName] = useState("");
  const [relation, setRelation] = useState("");
  const [careeDob, setCareeDob] = useState("");
  const [showDobPicker, setShowDobPicker] = useState(false);
  const [careDisabilities, setCareDisabilities] = useState<string[]>([]);

  const toggleCareDisability = (item: string) => {
    setCareDisabilities((prev) =>
      prev.includes(item) ? prev.filter((d) => d !== item) : [...prev, item]
    );
  };

  // ───────────────── Educator ─────────────────

  const [speciality, setSpeciality] = useState("");
  const [organization, setOrganization] = useState("");
  const [experience, setExperience] = useState("");

  // ───────────────── NGO ─────────────────

  const [ngoName, setNgoName] = useState("");
  const [ngoRole, setNgoRole] = useState("");
  const [district, setDistrict] = useState("");

  // ───────────────── COMMON ─────────────────

  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // ───────────────── Disability Types (from API) ─────────────────

  const [disabilityOptions, setDisabilityOptions] = useState<string[]>(FALLBACK_DISABILITY_OPTIONS);
  const [disabilityDropdownOpen, setDisabilityDropdownOpen] = useState(false);
  const [disabilitySearch, setDisabilitySearch] = useState("");
  const [careDropdownOpen, setCareDropdownOpen] = useState(false);
  const [careSearch, setCareSearch] = useState("");

  // ───────────────── BACK HANDLER ─────────────────

  const handleBack = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      Alert.alert(
        "Exit Onboarding?",
        "Are you sure you want to go back to the signup/login screen? This will sign you out.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Exit",
            style: "destructive",
            onPress: async () => {
              try {
                await logout();
              } catch (err) {
                Alert.alert("Error", "Failed to log out");
              }
            },
          },
        ]
      );
    }
  }, [navigation]);

  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        handleBack();
        return true;
      };

      const subscription = BackHandler.addEventListener("hardwareBackPress", onBackPress);
      return () => subscription.remove();
    }, [handleBack])
  );

  // ───────────────── FETCH DISABILITY TYPES ─────────────────

  useEffect(() => {
    apiClient.get<{ success: boolean; data: { name: string }[] }>("/api/master/disability-types")
      .then(({ data }) => {
        if (data.success && data.data.length > 0) {
          setDisabilityOptions(data.data.map((t) => t.name));
        }
      })
      .catch(() => {
        // silently fall back to FALLBACK_DISABILITY_OPTIONS already set
      });
  }, []);

  // ───────────────── YEAR VALIDATION ─────────────────

  const validateYear = (value: string): string | undefined => {
    if (!value.trim()) return undefined;
    if (!/^\d{4}$/.test(value.trim())) return "Enter a valid 4-digit year";
    const y = parseInt(value.trim(), 10);
    if (y < MIN_YEAR || y > CURRENT_YEAR) return `Year must be between ${MIN_YEAR} and ${CURRENT_YEAR}`;
    return undefined;
  };

  // ───────────────── VALIDATION ─────────────────

  const validateFields = () => {
    const newErrors: Record<string, string> = {};

    // PwD — at least one disability is required (backend gates profile
    // completion on disabilityType being present).
    if (roles.includes("pwd")) {
      if (selectedDisabilities.length === 0) {
        newErrors.disabilityType = "Please select at least one disability type";
      }
      const yearErr = validateYear(disabilitySince);
      if (yearErr) newErrors.disabilitySince = yearErr;
    }

    // Caregiver
    if (roles.includes("caregiver")) {
      if (!personName.trim()) {
        newErrors.personName = "Person name is required";
      }

      if (careeDob.trim()) {
        const parsed = parseDateInput(careeDob.trim(), "DMY");
        if (!parsed) {
          newErrors.careeDob = "Invalid date";
        }
      }
    }

    // Educator
    if (roles.includes("educator")) {
      if (!speciality.trim()) {
        newErrors.speciality = "Speciality required";
      }
    }

    // NGO
    if (roles.includes("ngo_worker")) {
      if (!ngoName.trim()) {
        newErrors.ngoName = "NGO name required";
      }
    }

    setFieldErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ───────────────── PAYLOAD ─────────────────

  const buildRolePayload = () => {
    const payload: any = {};

    if (roles.includes("pwd")) {
      // Multiple disabilities are stored as a comma-separated string.
      payload.disabilityType = selectedDisabilities.join(", ");
      payload.disabilitySince = disabilitySince.trim()
        ? parseInt(disabilitySince.trim(), 10)
        : undefined;
    }

    if (roles.includes("caregiver")) {
      payload.carePersonName = personName.trim();
      payload.careRelation = relation.trim();
      payload.careDob = careeDob.trim()
        ? parseDateInput(careeDob.trim(), "DMY")
        : undefined;
      payload.careDisabilityType = careDisabilities.join(", ");
    }

    if (roles.includes("educator")) {
      payload.speciality = speciality.trim();
      payload.organization = organization.trim();
      payload.yearsOfExperience = experience.trim()
        ? parseInt(experience.trim(), 10)
        : undefined;
    }

    if (roles.includes("ngo_worker")) {
      payload.ngoName = ngoName.trim();
      payload.ngoRole = ngoRole.trim();
      payload.district = district.trim();
    }

    return payload;
  };

  // ───────────────── SUBMIT ─────────────────

  const handleComplete = async () => {
    if (!user?.id) return;
    if (!validateFields()) return;

    setLoading(true);

    try {
      await submitFullOnboarding({
        userId: user.id,
        roles,
        basicProfile: pendingProfile ?? {},
        roleDetails: buildRolePayload(),
      });

      setUser({
        ...user,
        fullName: pendingProfile?.fullName ?? user.fullName,
        username: pendingProfile?.username ?? user.username,
        role: roles[0] ?? null,
        roles,
        profileComplete: true,
      });

      clearPending();

      navigation.reset({
        index: 0,
        routes: [{ name: "CareCircle" }],
      });
    } catch (error) {
      Alert.alert("Error", "Unable to complete onboarding");
    } finally {
      setLoading(false);
    }
  };

  // ───────────────── ROLE CHECK ─────────────────

  const hasRoleSection = roles.some(r =>
    ["pwd", "caregiver", "educator", "ngo_worker"].includes(r)
  );

  const cardBorder = highContrast
    ? { borderWidth: 2, borderColor: "#000000" }
    : { borderWidth: 1, borderColor: "rgba(0,0,0,0.05)" };

  const fieldBorder = (hasError?: boolean) => {
    if (hasError) return { borderWidth: 1, borderColor: colors.error };
    return highContrast ? { borderWidth: 2, borderColor: "#000000" } : {};
  };

  // ───────────────── DISABILITY DROPDOWN (shared render) ─────────────────
  // Supports single-select (caregiver — one care recipient) and multi-select
  // (PwD — a person may have multiple disabilities). In multi mode the panel
  // stays open on tap and each row is a checkbox.

  const renderDisabilityDropdown = (
    selected: string[],
    open: boolean,
    setOpen: (v: boolean) => void,
    search: string,
    setSearch: (v: string) => void,
    onChoose: (v: string) => void,
    label: string,
    multi: boolean
  ) => {
    const triggerText =
      selected.length === 0
        ? (multi ? "Select disability type(s)" : "Select disability type")
        : multi
          ? `${selected.length} selected`
          : selected.join(", ");

    return (
      <>
        <TouchableOpacity
          style={[styles.dropdownTrigger, { backgroundColor: colors.surface }, highContrast && { borderWidth: 2, borderColor: "#000000" }]}
          activeOpacity={0.8}
          onPress={() => {
            setOpen(!open);
            setSearch("");
          }}
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityHint={
            selected.length > 0
              ? `Currently ${selected.join(", ")}. Double tap to change your ${multi ? "disability types" : "disability type"}`
              : `Double tap to choose ${multi ? "one or more disability types" : "a disability type"}`
          }
          accessibilityState={{ expanded: open }}
        >
          <AccessibleText style={[styles.dropdownValue, { color: selected.length ? colors.text : colors.subtext }]}>
            {triggerText}
          </AccessibleText>
          <AccessibleText style={[styles.dropdownArrow, { color: colors.subtext }]}>{open ? "▲" : "▼"}</AccessibleText>
        </TouchableOpacity>

        {/* Selected chips: clear visual confirmation of multi-select picks,
            each removable directly without reopening the panel. */}
        {multi && selected.length > 0 && (
          <View style={styles.selectedChipsRow}>
            {selected.map((item) => (
              <View
                key={item}
                style={[
                  styles.selectedChip,
                  { backgroundColor: highContrast ? "#000000" : "rgba(80,0,136,0.1)" },
                ]}
              >
                <AccessibleText
                  style={[styles.selectedChipText, { color: highContrast ? "#FFFFFF" : colors.primary }]}
                >
                  {item}
                </AccessibleText>
                <TouchableOpacity
                  onPress={() => onChoose(item)}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${item}`}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <AccessibleText
                    style={[styles.selectedChipRemove, { color: highContrast ? "#FFFFFF" : colors.primary }]}
                  >
                    ✕
                  </AccessibleText>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {open && (
          <View style={[styles.dropdownPanel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.dropdownSearch, { borderBottomColor: colors.border }]}>
              <AccessibleText style={styles.searchIcon}>🔍</AccessibleText>
              <TextInput
                style={[styles.searchInput, { color: colors.text }]}
                placeholder="Search..."
                placeholderTextColor={colors.subtext}
                value={search}
                onChangeText={setSearch}
                autoFocus
                accessibilityLabel="Search disability types"
              />
            </View>
            <ScrollView style={styles.dropdownList} nestedScrollEnabled keyboardShouldPersistTaps="handled">
              {disabilityOptions
                .filter((o) => o.toLowerCase().includes(search.toLowerCase()))
                .map((item) => {
                  const isSelected = selected.includes(item);
                  return (
                    <TouchableOpacity
                      key={item}
                      style={[
                        styles.dropdownOption,
                        { borderBottomColor: colors.border },
                        isSelected && { backgroundColor: highContrast ? "#000000" : "rgba(80,0,136,0.06)" },
                      ]}
                      onPress={() => {
                        onChoose(item);
                        if (!multi) {
                          setOpen(false);
                          setSearch("");
                        }
                      }}
                      accessibilityRole={multi ? "checkbox" : "radio"}
                      accessibilityState={{ checked: isSelected }}
                      accessibilityLabel={item}
                    >
                      <AccessibleText
                        style={[
                          styles.dropdownOptionText,
                          { color: isSelected ? colors.primary : colors.text },
                          isSelected && highContrast && { color: "#FFFFFF", fontWeight: "700" },
                        ]}
                      >
                        {item}
                      </AccessibleText>
                      {isSelected && (
                        <AccessibleText style={[styles.checkmark, { color: highContrast ? "#FFFFFF" : colors.primary }]}>✓</AccessibleText>
                      )}
                    </TouchableOpacity>
                  );
                })}
              {disabilityOptions.filter((o) => o.toLowerCase().includes(search.toLowerCase())).length === 0 && (
                <AccessibleText style={[styles.noResults, { color: colors.subtext }]}>No results</AccessibleText>
              )}
            </ScrollView>

            {/* Multi-select never auto-closes on tap (so multiple picks are
                easy) — give it an explicit, obvious way to close instead. */}
            {multi && (
              <TouchableOpacity
                style={[styles.dropdownDoneBtn, { backgroundColor: highContrast ? "#000000" : colors.primary }]}
                onPress={() => {
                  setOpen(false);
                  setSearch("");
                }}
                accessibilityRole="button"
                accessibilityLabel="Done selecting"
              >
                <AccessibleText style={styles.dropdownDoneBtnText}>
                  Done{selected.length > 0 ? ` (${selected.length} selected)` : ""}
                </AccessibleText>
              </TouchableOpacity>
            )}
          </View>
        )}
      </>
    );
  };

  // ───────────────── UI ─────────────────

  return (
    <SafeScreen bottom={false} statusBarStyle="dark" style={[styles.container, { backgroundColor: colors.background }]}>

      {/* BACKGROUND */}
      <View style={styles.topBlob} />
      <View style={styles.bottomBlob} />

      {/* HEADER */}
      <View style={styles.topHeader}>
        <TouchableOpacity
          style={[styles.backButton, highContrast && { borderWidth: 2, borderColor: "#000000" }]}
          onPress={handleBack}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          accessibilityHint="Returns to the previous screen"
        >
          <AccessibleText style={[styles.backArrow, { color: colors.secondary }]}>←</AccessibleText>
        </TouchableOpacity>

        <View style={styles.progressWrapper}>
          <View style={[styles.inactiveProgress, highContrast && { backgroundColor: "#000000" }]} />
          <View style={[styles.inactiveProgress, highContrast && { backgroundColor: "#000000" }]} />
          <View style={[styles.inactiveProgress, highContrast && { backgroundColor: "#000000" }]} />
          <View style={[styles.activeProgress, { backgroundColor: colors.secondary }]} />
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 20 : 0}
      >
        {/* BODY */}
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          {/* HERO */}
          <View style={styles.heroSection}>
            <AccessibleText variant="heroTitle" style={[styles.heroTitle, { color: colors.text }]}>
              A little more about you
            </AccessibleText>
            <AccessibleText variant="subtitle" style={[styles.heroSubtitle, { color: colors.subtext }]}>
              Help us personalize your experience
            </AccessibleText>
          </View>

          {/* ───────── PwD ───────── */}
          {roles.includes("pwd") && (
            <View style={[styles.sectionCard, { backgroundColor: colors.card }, cardBorder]}>
              <View style={styles.sectionHeader}>
                <AccessibleText variant="title" style={[styles.sectionTitle, { color: colors.primary }]}>
                  My Disability
                </AccessibleText>
                <View style={[styles.badge, { backgroundColor: highContrast ? "#FFFFFF" : "rgba(80,0,136,0.1)" }, highContrast && { borderWidth: 1, borderColor: "#000000" }]}>
                  <AccessibleText style={[styles.badgeText, { color: colors.primary }]}>REQUIRED</AccessibleText>
                </View>
              </View>

              <AccessibleText variant="label" style={[styles.label, { color: colors.subtext }]}>Disability Type(s) *</AccessibleText>

              {renderDisabilityDropdown(
                selectedDisabilities,
                disabilityDropdownOpen,
                setDisabilityDropdownOpen,
                disabilitySearch,
                setDisabilitySearch,
                (item) => {
                  toggleDisability(item);
                  if (fieldErrors.disabilityType) {
                    setFieldErrors((e) => ({ ...e, disabilityType: undefined as any }));
                  }
                },
                "Disability types",
                true
              )}
              {fieldErrors.disabilityType && (
                <AccessibleText style={[styles.errorText, { color: colors.error }]} accessibilityRole="alert">
                  {fieldErrors.disabilityType}
                </AccessibleText>
              )}

              <AccessibleText variant="label" style={[styles.label, { color: colors.subtext, marginTop: 20 }]}>Disability Since</AccessibleText>

              <TextInput
                placeholder="e.g. 2003"
                placeholderTextColor={colors.subtext}
                style={[styles.input, { backgroundColor: colors.surface, color: colors.text }, fieldBorder(!!fieldErrors.disabilitySince)]}
                value={disabilitySince}
                onChangeText={(v) => {
                  if (/^\d{0,4}$/.test(v)) {
                    setDisabilitySince(v);
                    if (fieldErrors.disabilitySince) {
                      setFieldErrors((e) => ({ ...e, disabilitySince: undefined as any }));
                    }
                  }
                }}
                keyboardType="number-pad"
                maxLength={4}
                accessibilityLabel="Disability since year"
                accessibilityHint="4-digit year"
              />
              {fieldErrors.disabilitySince && (
                <AccessibleText style={[styles.errorText, { color: colors.error }]} accessibilityRole="alert">
                  {fieldErrors.disabilitySince}
                </AccessibleText>
              )}
            </View>
          )}

          {/* ───────── CAREGIVER ───────── */}
          {roles.includes("caregiver") && (
            <View style={[styles.sectionCard, { backgroundColor: colors.card }, cardBorder]}>
              <View style={styles.sectionHeader}>
                <AccessibleText variant="title" style={[styles.sectionTitle, { color: colors.primary }]}>
                  Person I Care For
                </AccessibleText>
              </View>

              <AccessibleText variant="label" style={[styles.label, { color: colors.subtext }]}>Person Name</AccessibleText>
              <TextInput
                placeholder="Enter full name (letters only)"
                placeholderTextColor={colors.subtext}
                style={[styles.input, { backgroundColor: colors.surface, color: colors.text }, fieldBorder(!!fieldErrors.personName)]}
                value={personName}
                onChangeText={(v) => setPersonName(v.replace(/[0-9]/g, ''))}
                accessibilityLabel="Person name"
                accessibilityHint="Letters only"
              />
              {fieldErrors.personName && (
                <AccessibleText style={[styles.errorText, { color: colors.error }]} accessibilityRole="alert">
                  {fieldErrors.personName}
                </AccessibleText>
              )}

              <View style={styles.row}>
                <View style={styles.halfField}>
                  <AccessibleText variant="label" style={[styles.label, { color: colors.subtext }]}>Relation</AccessibleText>
                  <TextInput
                    placeholder="Relation"
                    placeholderTextColor={colors.subtext}
                    style={[styles.input, { backgroundColor: colors.surface, color: colors.text }, fieldBorder()]}
                    value={relation}
                    onChangeText={setRelation}
                    accessibilityLabel="Relation to the person you care for"
                  />
                </View>

                <View style={styles.halfField}>
                  <AccessibleText variant="label" style={[styles.label, { color: colors.subtext }]}>DOB</AccessibleText>
                  <TouchableOpacity
                    onPress={() => setShowDobPicker(true)}
                    accessibilityRole="button"
                    accessibilityLabel="Date of birth"
                    accessibilityHint="Opens a calendar picker"
                    style={[styles.input, { backgroundColor: colors.surface, justifyContent: 'center' }, fieldBorder(!!fieldErrors.careeDob)]}
                  >
                    <AccessibleText style={{ color: careeDob ? colors.text : colors.subtext }}>
                      {careeDob || 'Pick date (DD/MM/YYYY)'}
                    </AccessibleText>
                  </TouchableOpacity>
                  <DateTimePickerModal
                    isVisible={showDobPicker}
                    mode="date"
                    maximumDate={new Date()}
                    onConfirm={(date) => {
                      const day = String(date.getDate()).padStart(2, '0');
                      const month = String(date.getMonth() + 1).padStart(2, '0');
                      const year = date.getFullYear();
                      setCareeDob(`${day}/${month}/${year}`);
                      if (fieldErrors.careeDob) setFieldErrors(e => ({ ...e, careeDob: undefined as any }));
                      setShowDobPicker(false);
                    }}
                    onCancel={() => setShowDobPicker(false)}
                  />
                </View>
              </View>
              {fieldErrors.careeDob && (
                <AccessibleText style={[styles.errorText, { color: colors.error }]} accessibilityRole="alert">
                  {fieldErrors.careeDob}
                </AccessibleText>
              )}

              <AccessibleText variant="label" style={[styles.label, { color: colors.subtext, marginTop: 18 }]}>Disability Type(s)</AccessibleText>

              {renderDisabilityDropdown(
                careDisabilities,
                careDropdownOpen,
                setCareDropdownOpen,
                careSearch,
                setCareSearch,
                toggleCareDisability,
                "Disability types",
                true
              )}
            </View>
          )}

          {/* ───────── EDUCATOR ───────── */}
          {roles.includes("educator") && (
            <View style={[styles.sectionCard, { backgroundColor: colors.card }, cardBorder]}>
              <View style={styles.sectionHeader}>
                <AccessibleText variant="title" style={[styles.sectionTitle, { color: colors.primary }]}>
                  Professional Info
                </AccessibleText>
              </View>

              <AccessibleText variant="label" style={[styles.label, { color: colors.subtext }]}>Specialty</AccessibleText>
              <TextInput
                placeholder="Speciality"
                placeholderTextColor={colors.subtext}
                style={[styles.input, { backgroundColor: colors.surface, color: colors.text }, fieldBorder(!!fieldErrors.speciality)]}
                value={speciality}
                onChangeText={setSpeciality}
                accessibilityLabel="Speciality"
              />
              {fieldErrors.speciality && (
                <AccessibleText style={[styles.errorText, { color: colors.error }]} accessibilityRole="alert">
                  {fieldErrors.speciality}
                </AccessibleText>
              )}

              <AccessibleText variant="label" style={[styles.label, { color: colors.subtext, marginTop: 18 }]}>Organization</AccessibleText>
              <TextInput
                placeholder="Company or School"
                placeholderTextColor={colors.subtext}
                style={[styles.input, { backgroundColor: colors.surface, color: colors.text }, fieldBorder()]}
                value={organization}
                onChangeText={setOrganization}
                accessibilityLabel="Organization"
              />

              <AccessibleText variant="label" style={[styles.label, { color: colors.subtext, marginTop: 18 }]}>Experience</AccessibleText>
              <TextInput
                placeholder="Years"
                placeholderTextColor={colors.subtext}
                style={[styles.input, { backgroundColor: colors.surface, color: colors.text }, fieldBorder()]}
                value={experience}
                onChangeText={setExperience}
                keyboardType="number-pad"
                accessibilityLabel="Years of experience"
              />
            </View>
          )}

          {/* ───────── NGO ───────── */}
          {roles.includes("ngo_worker") && (
            <View style={[styles.sectionCard, { backgroundColor: colors.card }, cardBorder]}>
              <View style={styles.sectionHeader}>
                <AccessibleText variant="title" style={[styles.sectionTitle, { color: colors.primary }]}>
                  NGO Info
                </AccessibleText>
              </View>

              <AccessibleText variant="label" style={[styles.label, { color: colors.subtext }]}>Organization Name</AccessibleText>
              <TextInput
                placeholder="NGO Name"
                placeholderTextColor={colors.subtext}
                style={[styles.input, { backgroundColor: colors.surface, color: colors.text }, fieldBorder(!!fieldErrors.ngoName)]}
                value={ngoName}
                onChangeText={setNgoName}
                accessibilityLabel="NGO name"
              />
              {fieldErrors.ngoName && (
                <AccessibleText style={[styles.errorText, { color: colors.error }]} accessibilityRole="alert">
                  {fieldErrors.ngoName}
                </AccessibleText>
              )}

              <AccessibleText variant="label" style={[styles.label, { color: colors.subtext, marginTop: 18 }]}>Your Role</AccessibleText>
              <TextInput
                placeholder="Designation"
                placeholderTextColor={colors.subtext}
                style={[styles.input, { backgroundColor: colors.surface, color: colors.text }, fieldBorder()]}
                value={ngoRole}
                onChangeText={setNgoRole}
                accessibilityLabel="Your role at the NGO"
              />

              <AccessibleText variant="label" style={[styles.label, { color: colors.subtext, marginTop: 18 }]}>District</AccessibleText>
              <TextInput
                placeholder="District"
                placeholderTextColor={colors.subtext}
                style={[styles.input, { backgroundColor: colors.surface, color: colors.text }, fieldBorder()]}
                value={district}
                onChangeText={setDistrict}
                accessibilityLabel="District"
              />
            </View>
          )}

          {/* ───────── BASIC ROLES ───────── */}
          {!hasRoleSection && (
            <View style={[styles.sectionCard, { backgroundColor: colors.card }, cardBorder]}>
              <View style={styles.sectionHeader}>
                <AccessibleText variant="title" style={[styles.sectionTitle, { color: colors.primary }]}>
                  You're all set!
                </AccessibleText>
                <View style={[styles.badge, { backgroundColor: highContrast ? "#FFFFFF" : "rgba(80,0,136,0.1)" }, highContrast && { borderWidth: 1, borderColor: "#000000" }]}>
                  <AccessibleText style={[styles.badgeText, { color: colors.primary }]}>BASIC PROFILE</AccessibleText>
                </View>
              </View>

              <AccessibleText variant="body" style={[styles.fallbackText, { color: colors.subtext }]}>
                You only need basic details to continue using the platform.
              </AccessibleText>

              <View style={[styles.infoCard, { backgroundColor: colors.surface }]}>
                <AccessibleText style={[styles.infoTitle, { color: colors.subtext }]}>Selected Role</AccessibleText>
                <AccessibleText style={[styles.infoValue, { color: colors.text }]}>
                  {roles.map(r => ({
                    pwd: 'Person with Disability',
                    caregiver: 'Caregiver',
                    educator: 'Educator',
                    ngo_worker: 'NGO Worker',
                    skill_trainer: 'Skill Trainer',
                    community_member: 'Community Member',
                    therapist: 'Therapist',
                    volunteer: 'Volunteer',
                    student: 'Student',
                  } as Record<string, string>)[r] ?? r).join(", ")}
                </AccessibleText>
              </View>
            </View>
          )}
        </ScrollView>

        {/* FOOTER */}
        <View style={[styles.footer, { bottom: Math.max(insets.bottom, 24) }]}>
          <AccessibleButton
            style={styles.button}
            onPress={handleComplete}
            disabled={loading}
            accessibilityLabel="Complete Profile"
            accessibilityHint="Saves your profile details and continues to the next step"
          >
            {loading ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <>
                <AccessibleText style={styles.buttonText}>Complete Profile</AccessibleText>
                <AccessibleText style={styles.buttonArrow}>→</AccessibleText>
              </>
            )}
          </AccessibleButton>
        </View>
      </KeyboardAvoidingView>
    </SafeScreen>
  );
};

export default ProfileDetailsScreen;

// ─────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
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

  topHeader: {
    height: 64,
    paddingHorizontal: 24,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
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
  },

  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 140,
    gap: 20,
  },

  heroSection: {
    marginBottom: 4,
  },

  heroTitle: {
    fontSize: 30,
    marginBottom: 6,
  },

  heroSubtitle: {
    fontSize: 15,
  },

  sectionCard: {
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
  },

  badge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
  },

  badgeText: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1,
  },

  label: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginBottom: 10,
  },

  input: {
    minHeight: 52,
    borderRadius: 14,
    paddingHorizontal: 16,
    fontSize: 15,
  },

  selectedChipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
  },

  selectedChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 12,
    paddingRight: 8,
    paddingVertical: 7,
    borderRadius: 16,
    gap: 6,
  },

  selectedChipText: {
    fontSize: 13,
    fontWeight: "600",
  },

  selectedChipRemove: {
    fontSize: 13,
    fontWeight: "700",
    paddingHorizontal: 2,
  },

  dropdownDoneBtn: {
    marginTop: 10,
    marginHorizontal: 12,
    marginBottom: 12,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },

  dropdownDoneBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },

  row: {
    flexDirection: "row",
    gap: 12,
  },

  halfField: {
    flex: 1,
  },

  footer: {
    position: "absolute",
    bottom: 24,
    left: 20,
    right: 20,
  },

  button: {
    minHeight: 58,
    borderRadius: 18,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
  },

  buttonText: {
    color: "#FFFFFF",
    fontWeight: "700",
    flexShrink: 1,
  },

  buttonArrow: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
  },

  fallbackText: {
    fontSize: 15,
    lineHeight: 24,
    marginBottom: 20,
  },

  infoCard: {
    borderRadius: 16,
    padding: 16,
  },

  infoTitle: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    marginBottom: 6,
  },

  infoValue: {
    fontSize: 16,
    fontWeight: "600",
  },

  errorText: {
    fontSize: 12,
    marginTop: 4,
    marginBottom: 8,
    marginLeft: 4,
  },

  dropdownTrigger: {
    minHeight: 52,
    borderRadius: 14,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  dropdownValue: {
    flex: 1,
    fontSize: 15,
    fontWeight: "500",
  },

  dropdownArrow: {
    fontSize: 11,
    marginLeft: 8,
  },

  dropdownPanel: {
    marginTop: 6,
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    marginBottom: 4,
  },

  dropdownSearch: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },

  searchIcon: {
    fontSize: 14,
    marginRight: 8,
  },

  searchInput: {
    flex: 1,
    fontSize: 14,
  },

  dropdownList: {
    maxHeight: 200,
  },

  dropdownOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },

  dropdownOptionText: {
    flex: 1,
    fontSize: 14,
  },

  checkmark: {
    fontSize: 14,
    fontWeight: "700",
  },

  noResults: {
    padding: 16,
    textAlign: "center",
    fontSize: 13,
  },
});
