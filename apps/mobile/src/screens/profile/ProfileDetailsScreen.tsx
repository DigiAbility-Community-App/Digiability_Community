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
  Text,
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

import SafeScreen from "../../components/layout/SafeScreen";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";

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

const supportOptions = [
  "Mobility",
  "Communication",
  "Learning",
  "Daily Tasks",
];

const CURRENT_YEAR = new Date().getFullYear();
const MIN_YEAR = 1900;

// ─────────────────────────────────────────────────────────
// SCREEN
// ─────────────────────────────────────────────────────────

const ProfileDetailsScreen = () => {
  const navigation =
    useNavigation<any>();

  const user = useAuthStore(
    (s) => s.user
  );

  const setUser =
    useAuthStore(
      (s) => s.setUser
    );

  const clearPending =
    useAuthStore(
      (s) => s.clearPending
    );

  const pendingRoles =
    useAuthStore(
      (s) => s.pendingRoles
    );

  const pendingProfile =
    useAuthStore(
      (s) => s.pendingProfile
    );

  const insets = useSafeAreaInsets();

  const roles = pendingRoles && pendingRoles.length > 0
    ? pendingRoles
    : (user?.roles && user.roles.length > 0 ? user.roles : (user?.role ? [user.role] : []));

  const role = roles[0] || "";

  // ───────────────── PwD ─────────────────

  const [
    selectedDisability,
    setSelectedDisability,
  ] = useState("Hearing");

  const [
    disabilitySince,
    setDisabilitySince,
  ] = useState("");

  const [
    selectedSupport,
    setSelectedSupport,
  ] = useState("Communication");

  // ───────────────── Caregiver ─────────────────

  const [personName, setPersonName] =
    useState("");

  const [relation, setRelation] =
    useState("");

  const [careeDob, setCareeDob] =
    useState("");

  const [
    careDisability,
    setCareDisability,
  ] = useState("");

  // ───────────────── Educator ─────────────────

  const [speciality, setSpeciality] =
    useState("");

  const [organization, setOrganization] =
    useState("");

  const [experience, setExperience] =
    useState("");

  // ───────────────── NGO ─────────────────

  const [ngoName, setNgoName] =
    useState("");

  const [ngoRole, setNgoRole] =
    useState("");

  const [district, setDistrict] =
    useState("");

  // ───────────────── COMMON ─────────────────

  const [loading, setLoading] =
    useState(false);

  const [
    fieldErrors,
    setFieldErrors,
  ] = useState<
    Record<string, string>
  >({});

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
          {
            text: "Cancel",
            style: "cancel",
          },
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

      const subscription =
        BackHandler.addEventListener(
          "hardwareBackPress",
          onBackPress
        );

      return () =>
        subscription.remove();
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
    const newErrors: Record<
      string,
      string
    > = {};

    // PwD
    if (roles.includes("pwd")) {
      const yearErr = validateYear(disabilitySince);
      if (yearErr) newErrors.disabilitySince = yearErr;
    }

    // Caregiver
    if (
      roles.includes("caregiver")
    ) {
      if (
        !personName.trim()
      ) {
        newErrors.personName =
          "Person name is required";
      }

      if (
        careeDob.trim()
      ) {
        const parsed =
          parseDateInput(
            careeDob.trim(),
            "DMY"
          );

        if (!parsed) {
          newErrors.careeDob =
            "Invalid date";
        }
      }
    }

    // Educator
    if (
      roles.includes("educator")
    ) {
      if (
        !speciality.trim()
      ) {
        newErrors.speciality =
          "Speciality required";
      }
    }

    // NGO
    if (
      roles.includes("ngo_worker")
    ) {
      if (!ngoName.trim()) {
        newErrors.ngoName =
          "NGO name required";
      }
    }

    setFieldErrors(
      newErrors
    );

    return (
      Object.keys(newErrors)
        .length === 0
    );
  };

  // ───────────────── PAYLOAD ─────────────────

  const buildRolePayload =
    () => {
      const payload: any = {};

      if (roles.includes("pwd")) {
        payload.disabilityType = selectedDisability;
        payload.disabilitySince = disabilitySince.trim()
          ? parseInt(disabilitySince.trim(), 10)
          : undefined;
        payload.supportNeeded = selectedSupport;
      }

      if (roles.includes("caregiver")) {
        payload.carePersonName = personName.trim();
        payload.careRelation = relation.trim();
        payload.careDob = careeDob.trim()
          ? parseDateInput(careeDob.trim(), "DMY")
          : undefined;
        payload.careDisabilityType = careDisability.trim();
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

  const handleComplete =
    async () => {
      if (!user?.id) return;

      if (!validateFields())
        return;

      setLoading(true);

      try {
        await submitFullOnboarding(
          {
            userId: user.id,

            roles,

            basicProfile:
              pendingProfile ??
              {},

            roleDetails:
              buildRolePayload(),
          }
        );

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
        Alert.alert(
          "Error",
          "Unable to complete onboarding"
        );
      } finally {
        setLoading(false);
      }
    };

  // ───────────────── ROLE CHECK ─────────────────

  const hasRoleSection = roles.some(r =>
    [
      "pwd",
      "caregiver",
      "educator",
      "ngo_worker",
    ].includes(r)
  );

  // ───────────────── UI ─────────────────

  return (
    <SafeScreen
      bottom={false}
      statusBarStyle="dark"
      style={styles.container}
    >

      {/* BACKGROUND */}
      <View
        style={styles.topBlob}
      />

      <View
        style={styles.bottomBlob}
      />

      {/* HEADER */}
      <View
        style={styles.topHeader}
      >
        <TouchableOpacity
          style={
            styles.backButton
          }
          onPress={handleBack}
        >
          <Text
            style={
              styles.backArrow
            }
          >
            ←
          </Text>
        </TouchableOpacity>

        <View
          style={
            styles.progressWrapper
          }
        >
          <View
            style={
              styles.inactiveProgress
            }
          />

          <View
            style={
              styles.inactiveProgress
            }
          />

          <View
            style={
              styles.inactiveProgress
            }
          />

          <View
            style={
              styles.activeProgress
            }
          />
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={
          Platform.OS === "ios"
            ? "padding"
            : "height"
        }
        keyboardVerticalOffset={
          Platform.OS === "ios" ? 20 : 0
        }
      >
        {/* BODY */}
        <ScrollView
          showsVerticalScrollIndicator={
            false
          }
          contentContainerStyle={
            styles.scrollContent
          }
        >
          {/* HERO */}
          <View
            style={
              styles.heroSection
            }
          >
            <Text
              style={
                styles.heroTitle
              }
            >
              A little more
              about you
            </Text>

            <Text
              style={
                styles.heroSubtitle
              }
            >
              Help us personalize
              your experience
            </Text>
          </View>

          {/* ───────── PwD ───────── */}
          {roles.includes("pwd") && (
            <View
              style={
                styles.sectionCard
              }
            >
              <View
                style={
                  styles.sectionHeader
                }
              >
                <Text
                  style={
                    styles.sectionTitle
                  }
                >
                  My Disability
                </Text>

                <View
                  style={
                    styles.badge
                  }
                >
                  <Text
                    style={
                      styles.badgeText
                    }
                  >
                    OPTIONAL
                  </Text>
                </View>
              </View>

              <Text style={styles.label}>Disability Type</Text>

              <TouchableOpacity
                style={styles.dropdownTrigger}
                activeOpacity={0.8}
                onPress={() => {
                  setDisabilityDropdownOpen(!disabilityDropdownOpen);
                  setDisabilitySearch("");
                }}
              >
                <Text style={selectedDisability ? styles.dropdownValue : styles.dropdownPlaceholder}>
                  {selectedDisability || "Select disability type"}
                </Text>
                <Text style={styles.dropdownArrow}>{disabilityDropdownOpen ? "▲" : "▼"}</Text>
              </TouchableOpacity>

              {disabilityDropdownOpen && (
                <View style={styles.dropdownPanel}>
                  <View style={styles.dropdownSearch}>
                    <Text style={styles.searchIcon}>🔍</Text>
                    <TextInput
                      style={styles.searchInput}
                      placeholder="Search..."
                      placeholderTextColor="rgba(126,115,131,0.6)"
                      value={disabilitySearch}
                      onChangeText={setDisabilitySearch}
                      autoFocus
                    />
                  </View>
                  <ScrollView style={styles.dropdownList} nestedScrollEnabled keyboardShouldPersistTaps="handled">
                    {disabilityOptions
                      .filter((o) => o.toLowerCase().includes(disabilitySearch.toLowerCase()))
                      .map((item) => (
                        <TouchableOpacity
                          key={item}
                          style={[styles.dropdownOption, selectedDisability === item && styles.dropdownOptionSelected]}
                          onPress={() => {
                            setSelectedDisability(item);
                            setDisabilityDropdownOpen(false);
                            setDisabilitySearch("");
                          }}
                        >
                          <Text style={[styles.dropdownOptionText, selectedDisability === item && styles.dropdownOptionTextSelected]}>
                            {item}
                          </Text>
                          {selectedDisability === item && <Text style={styles.checkmark}>✓</Text>}
                        </TouchableOpacity>
                      ))}
                    {disabilityOptions.filter((o) => o.toLowerCase().includes(disabilitySearch.toLowerCase())).length === 0 && (
                      <Text style={styles.noResults}>No results</Text>
                    )}
                  </ScrollView>
                </View>
              )}

              <Text style={[styles.label, { marginTop: 20 }]}>Disability Since</Text>

              <TextInput
                placeholder="e.g. 2003"
                placeholderTextColor="rgba(126,115,131,0.6)"
                style={[styles.input, fieldErrors.disabilitySince ? styles.inputError : null]}
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
              />
              {fieldErrors.disabilitySince && (
                <Text style={styles.errorText}>{fieldErrors.disabilitySince}</Text>
              )}

              <Text
                style={[
                  styles.label,
                  {
                    marginTop: 20,
                  },
                ]}
              >
                Support Needed
              </Text>

              <View
                style={
                  styles.chipsContainer
                }
              >
                {supportOptions.map(
                  (item) => {
                    const selected =
                      selectedSupport ===
                      item;

                    return (
                      <TouchableOpacity
                        key={item}
                        style={[
                          styles.chip,

                          selected &&
                          styles.selectedChip,
                        ]}
                        onPress={() =>
                          setSelectedSupport(
                            item
                          )
                        }
                      >
                        <Text
                          style={[
                            styles.chipText,

                            selected &&
                            styles.selectedChipText,
                          ]}
                        >
                          {item}
                        </Text>
                      </TouchableOpacity>
                    );
                  }
                )}
              </View>
            </View>
          )}

          {/* ───────── CAREGIVER ───────── */}
          {roles.includes("caregiver") && (
            <View
              style={
                styles.sectionCard
              }
            >
              <View
                style={
                  styles.sectionHeader
                }
              >
                <Text
                  style={
                    styles.sectionTitle
                  }
                >
                  Person I Care For
                </Text>
              </View>

              <Text
                style={
                  styles.label
                }
              >
                Person Name
              </Text>

              <TextInput
                placeholder="Enter full name"
                placeholderTextColor="rgba(126,115,131,0.6)"
                style={
                  styles.input
                }
                value={personName}
                onChangeText={
                  setPersonName
                }
              />

              <View
                style={styles.row}
              >
                <View
                  style={
                    styles.halfField
                  }
                >
                  <Text
                    style={
                      styles.label
                    }
                  >
                    Relation
                  </Text>

                  <TextInput
                    placeholder="Relation"
                    placeholderTextColor="rgba(126,115,131,0.6)"
                    style={
                      styles.input
                    }
                    value={
                      relation
                    }
                    onChangeText={
                      setRelation
                    }
                  />
                </View>

                <View
                  style={
                    styles.halfField
                  }
                >
                  <Text
                    style={
                      styles.label
                    }
                  >
                    DOB
                  </Text>

                  <TextInput
                    placeholder="DD/MM/YYYY"
                    placeholderTextColor="rgba(126,115,131,0.6)"
                    style={
                      styles.input
                    }
                    value={
                      careeDob
                    }
                    onChangeText={
                      setCareeDob
                    }
                  />
                </View>
              </View>

              <Text style={[styles.label, { marginTop: 18 }]}>Disability Type</Text>

              <TouchableOpacity
                style={styles.dropdownTrigger}
                activeOpacity={0.8}
                onPress={() => {
                  setCareDropdownOpen(!careDropdownOpen);
                  setCareSearch("");
                }}
              >
                <Text style={careDisability ? styles.dropdownValue : styles.dropdownPlaceholder}>
                  {careDisability || "Select disability type"}
                </Text>
                <Text style={styles.dropdownArrow}>{careDropdownOpen ? "▲" : "▼"}</Text>
              </TouchableOpacity>

              {careDropdownOpen && (
                <View style={styles.dropdownPanel}>
                  <View style={styles.dropdownSearch}>
                    <Text style={styles.searchIcon}>🔍</Text>
                    <TextInput
                      style={styles.searchInput}
                      placeholder="Search..."
                      placeholderTextColor="rgba(126,115,131,0.6)"
                      value={careSearch}
                      onChangeText={setCareSearch}
                      autoFocus
                    />
                  </View>
                  <ScrollView style={styles.dropdownList} nestedScrollEnabled keyboardShouldPersistTaps="handled">
                    {disabilityOptions
                      .filter((o) => o.toLowerCase().includes(careSearch.toLowerCase()))
                      .map((item) => (
                        <TouchableOpacity
                          key={item}
                          style={[styles.dropdownOption, careDisability === item && styles.dropdownOptionSelected]}
                          onPress={() => {
                            setCareDisability(item);
                            setCareDropdownOpen(false);
                            setCareSearch("");
                          }}
                        >
                          <Text style={[styles.dropdownOptionText, careDisability === item && styles.dropdownOptionTextSelected]}>
                            {item}
                          </Text>
                          {careDisability === item && <Text style={styles.checkmark}>✓</Text>}
                        </TouchableOpacity>
                      ))}
                    {disabilityOptions.filter((o) => o.toLowerCase().includes(careSearch.toLowerCase())).length === 0 && (
                      <Text style={styles.noResults}>No results</Text>
                    )}
                  </ScrollView>
                </View>
              )}

            </View>
          )}

          {/* ───────── EDUCATOR ───────── */}
          {roles.includes("educator") && (
            <View
              style={
                styles.sectionCard
              }
            >
              <View
                style={
                  styles.sectionHeader
                }
              >
                <Text
                  style={
                    styles.sectionTitle
                  }
                >
                  Professional Info
                </Text>
              </View>

              <Text
                style={
                  styles.label
                }
              >
                Specialty
              </Text>

              <TextInput
                placeholder="Speciality"
                placeholderTextColor="rgba(126,115,131,0.6)"
                style={
                  styles.input
                }
                value={
                  speciality
                }
                onChangeText={
                  setSpeciality
                }
              />

              <Text
                style={[
                  styles.label,
                  {
                    marginTop: 18,
                  },
                ]}
              >
                Organization
              </Text>

              <TextInput
                placeholder="Company or School"
                placeholderTextColor="rgba(126,115,131,0.6)"
                style={
                  styles.input
                }
                value={
                  organization
                }
                onChangeText={
                  setOrganization
                }
              />

              <Text
                style={[
                  styles.label,
                  {
                    marginTop: 18,
                  },
                ]}
              >
                Experience
              </Text>

              <TextInput
                placeholder="Years"
                placeholderTextColor="rgba(126,115,131,0.6)"
                style={
                  styles.input
                }
                value={
                  experience
                }
                onChangeText={
                  setExperience
                }
                keyboardType="number-pad"
              />
            </View>
          )}

          {/* ───────── NGO ───────── */}
          {roles.includes("ngo_worker") && (
            <View
              style={
                styles.sectionCard
              }
            >
              <View
                style={
                  styles.sectionHeader
                }
              >
                <Text
                  style={
                    styles.sectionTitle
                  }
                >
                  NGO Info
                </Text>
              </View>

              <Text
                style={
                  styles.label
                }
              >
                Organization Name
              </Text>

              <TextInput
                placeholder="NGO Name"
                placeholderTextColor="rgba(126,115,131,0.6)"
                style={
                  styles.input
                }
                value={ngoName}
                onChangeText={
                  setNgoName
                }
              />

              <Text
                style={[
                  styles.label,
                  {
                    marginTop: 18,
                  },
                ]}
              >
                Your Role
              </Text>

              <TextInput
                placeholder="Designation"
                placeholderTextColor="rgba(126,115,131,0.6)"
                style={
                  styles.input
                }
                value={ngoRole}
                onChangeText={
                  setNgoRole
                }
              />

              <Text
                style={[
                  styles.label,
                  {
                    marginTop: 18,
                  },
                ]}
              >
                District
              </Text>

              <TextInput
                placeholder="District"
                placeholderTextColor="rgba(126,115,131,0.6)"
                style={
                  styles.input
                }
                value={
                  district
                }
                onChangeText={
                  setDistrict
                }
              />
            </View>
          )}

          {/* ───────── BASIC ROLES ───────── */}
          {!hasRoleSection && (
            <View
              style={
                styles.sectionCard
              }
            >
              <View
                style={
                  styles.sectionHeader
                }
              >
                <Text
                  style={
                    styles.sectionTitle
                  }
                >
                  You're all set!
                </Text>

                <View
                  style={
                    styles.badge
                  }
                >
                  <Text
                    style={
                      styles.badgeText
                    }
                  >
                    BASIC PROFILE
                  </Text>
                </View>
              </View>

              <Text
                style={
                  styles.fallbackText
                }
              >
                You only need
                basic details to
                continue using the
                platform.
              </Text>

              <View
                style={
                  styles.infoCard
                }
              >
                <Text
                  style={
                    styles.infoTitle
                  }
                >
                  Selected Role
                </Text>

                <Text
                  style={
                    styles.infoValue
                  }
                >
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
                </Text>
              </View>
            </View>
          )}
        </ScrollView>

        {/* FOOTER */}
        <View style={[styles.footer, { bottom: Math.max(insets.bottom, 24) }]}>
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={
              handleComplete
            }
            disabled={loading}
            style={
              styles.buttonWrapper
            }
          >
            <LinearGradient
              colors={[
                "#500088",
                "#6B21A8",
              ]}
              style={
                styles.button
              }
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Text
                    style={
                      styles.buttonText
                    }
                  >
                    Complete Profile
                  </Text>

                  <Text
                    style={
                      styles.buttonArrow
                    }
                  >
                    →
                  </Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeScreen>
  );
};

export default ProfileDetailsScreen;

// ─────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────

const styles =
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor:
        "#FAF8FF",
    },

    topBlob: {
      position: "absolute",
      width: 256,
      height: 256,
      borderRadius: 999,
      backgroundColor:
        "rgba(80,0,136,0.05)",
      right: -96,
      top: -96,
    },

    bottomBlob: {
      position: "absolute",
      width: 256,
      height: 256,
      borderRadius: 999,
      backgroundColor:
        "rgba(133,83,0,0.05)",
      left: -96,
      bottom: 200,
    },

    topHeader: {
      height: 64,
      paddingHorizontal: 24,
      flexDirection: "row",
      justifyContent:
        "space-between",
      alignItems: "center",
    },

    backButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      justifyContent:
        "center",
      alignItems: "center",
      backgroundColor:
        "rgba(80,0,136,0.08)",
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
      backgroundColor:
        "rgba(207,194,212,0.5)",
    },

    activeProgress: {
      width: 24,
      height: 8,
      borderRadius: 999,
      backgroundColor:
        "#6B21A8",
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
      fontWeight: "700",
      color: "#232222",
      marginBottom: 6,
    },

    heroSubtitle: {
      fontSize: 15,
      color: "#636363",
    },

    sectionCard: {
      backgroundColor:
        "#FFFFFF",
      borderRadius: 20,
      padding: 20,
      shadowColor:
        "#500088",
      shadowOpacity: 0.06,
      shadowRadius: 8,
      elevation: 3,
    },

    sectionHeader: {
      flexDirection: "row",
      justifyContent:
        "space-between",
      alignItems: "center",
      marginBottom: 20,
    },

    sectionTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: "#500088",
    },

    badge: {
      backgroundColor:
        "rgba(80,0,136,0.1)",
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderRadius: 999,
    },

    badgeText: {
      color: "#500088",
      fontSize: 10,
      fontWeight: "900",
      letterSpacing: 1,
    },

    label: {
      fontSize: 11,
      fontWeight: "700",
      letterSpacing: 0.6,
      textTransform:
        "uppercase",
      color: "#4C4452",
      marginBottom: 10,
    },

    input: {
      height: 52,
      backgroundColor:
        "#F4F3FA",
      borderRadius: 14,
      paddingHorizontal: 16,
      fontSize: 15,
      color: "#1A1B20",
    },

    chipsContainer: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },

    chip: {
      backgroundColor:
        "#F4F3FA",
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 12,
    },

    selectedChip: {
      backgroundColor:
        "#500088",
    },

    chipText: {
      color: "#4C4452",
      fontSize: 14,
    },

    selectedChipText: {
      color: "#FFFFFF",
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

    buttonWrapper: {
      borderRadius: 18,
      overflow: "hidden",
    },

    button: {
      height: 58,
      flexDirection: "row",
      justifyContent:
        "center",
      alignItems: "center",
      gap: 10,
    },

    buttonText: {
      color: "#FFFFFF",
      fontSize: 16,
      fontWeight: "700",
    },

    buttonArrow: {
      color: "#FFFFFF",
      fontSize: 18,
      fontWeight: "700",
    },

    fallbackText: {
      fontSize: 15,
      color: "#4C4452",
      lineHeight: 24,
      marginBottom: 20,
    },

    infoCard: {
      backgroundColor:
        "#F4F3FA",
      borderRadius: 16,
      padding: 16,
    },

    infoTitle: {
      fontSize: 11,
      fontWeight: "700",
      color: "#7E7383",
      textTransform:
        "uppercase",
      marginBottom: 6,
    },

    infoValue: {
      fontSize: 16,
      fontWeight: "600",
      color: "#1A1B20",
    },

    inputError: {
      borderWidth: 1,
      borderColor: "#DC2626",
    },

    errorText: {
      color: "#DC2626",
      fontSize: 12,
      marginTop: 4,
      marginBottom: 8,
      marginLeft: 4,
    },

    dropdownTrigger: {
      height: 52,
      backgroundColor: "#F4F3FA",
      borderRadius: 14,
      paddingHorizontal: 16,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },

    dropdownValue: {
      flex: 1,
      fontSize: 15,
      color: "#1A1B20",
      fontWeight: "500",
    },

    dropdownPlaceholder: {
      flex: 1,
      fontSize: 15,
      color: "rgba(126,115,131,0.6)",
    },

    dropdownArrow: {
      fontSize: 11,
      color: "#7E7383",
      marginLeft: 8,
    },

    dropdownPanel: {
      marginTop: 6,
      backgroundColor: "#F4F3FA",
      borderRadius: 14,
      overflow: "hidden",
      borderWidth: 1,
      borderColor: "#E5E0F0",
      marginBottom: 4,
    },

    dropdownSearch: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: "#E5E0F0",
    },

    searchIcon: {
      fontSize: 14,
      marginRight: 8,
    },

    searchInput: {
      flex: 1,
      fontSize: 14,
      color: "#1A1B20",
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
      borderBottomColor: "rgba(229,224,240,0.5)",
    },

    dropdownOptionSelected: {
      backgroundColor: "rgba(80,0,136,0.06)",
    },

    dropdownOptionText: {
      flex: 1,
      fontSize: 14,
      color: "#1A1B20",
    },

    dropdownOptionTextSelected: {
      color: "#500088",
      fontWeight: "700",
    },

    checkmark: {
      fontSize: 14,
      color: "#500088",
      fontWeight: "700",
    },

    noResults: {
      padding: 16,
      textAlign: "center",
      color: "#7E7383",
      fontSize: 13,
    },
  });