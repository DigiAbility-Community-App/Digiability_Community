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

import React, { useState, useCallback } from "react";

import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
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

import {
  submitFullOnboarding,
  parseDateInput,
} from "@services/profileService";

// ─────────────────────────────────────────────────────────
// CONSTANTS
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

const CURRENT_YEAR =
  new Date().getFullYear();

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

  const pendingRole =
    useAuthStore(
      (s) => s.pendingRole
    );

  const pendingProfile =
    useAuthStore(
      (s) => s.pendingProfile
    );

  const insets = useSafeAreaInsets();

  const role =
    pendingRole ??
    user?.role ??
    "";

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

  // ───────────────── BACK HANDLER ─────────────────

  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        Alert.alert(
          "Go Back?",
          "Your onboarding progress will be saved.",
          [
            {
              text: "Stay",
              style: "cancel",
            },

            {
              text: "Go Back",
              style: "destructive",
              onPress: () =>
                navigation.goBack(),
            },
          ]
        );

        return true;
      };

      const subscription =
        BackHandler.addEventListener(
          "hardwareBackPress",
          onBackPress
        );

      return () =>
        subscription.remove();
    }, [navigation])
  );

  // ───────────────── VALIDATION ─────────────────

  const validateFields = () => {
    const newErrors: Record<
      string,
      string
    > = {};

    // PwD
    if (role === "pwd") {
      if (
        disabilitySince.trim()
      ) {
        const year = parseInt(
          disabilitySince.trim(),
          10
        );

        if (
          isNaN(year) ||
          year < 1900 ||
          year > CURRENT_YEAR
        ) {
          newErrors.disabilitySince =
            `Year must be between 1900 and ${CURRENT_YEAR}`;
        }
      }
    }

    // Caregiver
    if (
      role === "caregiver"
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
      role === "educator"
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
      role === "ngo_worker"
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
      switch (role) {
        case "pwd":
          return {
            disabilityType:
              selectedDisability,

            disabilitySince:
              disabilitySince.trim()
                ? parseInt(
                  disabilitySince.trim(),
                  10
                )
                : undefined,

            supportNeeded:
              selectedSupport,
          };

        case "caregiver":
          return {
            carePersonName:
              personName.trim(),

            careRelation:
              relation.trim(),

            careDob:
              careeDob.trim()
                ? parseDateInput(
                  careeDob.trim(),
                  "DMY"
                )
                : undefined,

            careDisabilityType:
              careDisability.trim(),
          };

        case "educator":
          return {
            speciality:
              speciality.trim(),

            organization:
              organization.trim(),

            yearsOfExperience:
              experience.trim()
                ? parseInt(
                  experience.trim(),
                  10
                )
                : undefined,
          };

        case "ngo_worker":
          return {
            ngoName:
              ngoName.trim(),

            ngoRole:
              ngoRole.trim(),

            district:
              district.trim(),
          };

        case "skill_trainer":
          return {
            roleType:
              "skill_trainer",
          };

        case "community_member":
          return {
            roleType:
              "community_member",
          };

        default:
          return {};
      }
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

            role,

            basicProfile:
              pendingProfile ??
              {},

            roleDetails:
              buildRolePayload(),
          }
        );

        setUser({
          ...user,
          role,
          profileComplete:
            true,
        });

        clearPending();

        navigation.navigate(
          "CareCircle"
        );
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

  const hasRoleSection =
    [
      "pwd",
      "caregiver",
      "educator",
      "ngo_worker",
    ].includes(role);

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
          onPress={() =>
            navigation.goBack()
          }
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
        {role === "pwd" && (
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

            <Text
              style={
                styles.label
              }
            >
              Disability Type
            </Text>

            <View
              style={
                styles.chipsContainer
              }
            >
              {disabilityOptions.map(
                (item) => {
                  const selected =
                    selectedDisability ===
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
                        setSelectedDisability(
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

            <Text
              style={[
                styles.label,
                {
                  marginTop: 20,
                },
              ]}
            >
              Disability Since
            </Text>

            <TextInput
              placeholder="Year"
              placeholderTextColor="rgba(126,115,131,0.6)"
              style={
                styles.input
              }
              value={
                disabilitySince
              }
              onChangeText={
                setDisabilitySince
              }
              keyboardType="number-pad"
            />

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
        {role ===
          "caregiver" && (
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

              <Text
                style={[
                  styles.label,
                  {
                    marginTop: 18,
                  },
                ]}
              >
                Disability Type
              </Text>

              <TextInput
                placeholder="Specify disability type"
                placeholderTextColor="rgba(126,115,131,0.6)"
                style={
                  styles.input
                }
                value={
                  careDisability
                }
                onChangeText={
                  setCareDisability
                }
              />
            </View>
          )}

        {/* ───────── EDUCATOR ───────── */}
        {role ===
          "educator" && (
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
        {role ===
          "ngo_worker" && (
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
        {(role ===
          "skill_trainer" ||
          role ===
          "community_member") && (
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
                  {role ===
                    "skill_trainer"
                    ? "Skill Trainer"
                    : "Community Member"}
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
              "#FEC800",
              "#FEA619",
            ]}
            style={
              styles.button
            }
          >
            {loading ? (
              <ActivityIndicator color="#000" />
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
      color: "#1A1A1A",
      fontSize: 16,
      fontWeight: "700",
    },

    buttonArrow: {
      color: "#1A1A1A",
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
  });