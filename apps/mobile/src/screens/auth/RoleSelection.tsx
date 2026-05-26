import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  BackHandler,
  ScrollView,
} from "react-native";

import { LinearGradient } from "expo-linear-gradient";
import {
  useNavigation,
  useFocusEffect,
} from "@react-navigation/native";

import { useAuthStore } from "@store/authStore";
import { logout } from "@services/authService";
import SafeScreen from "../../components/layout/SafeScreen";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// -------------------------
// ROLE TYPES
// -------------------------

type RoleType =
  | "pwd"
  | "caregiver"
  | "educator"
  | "ngo_worker"
  | "skill_trainer"
  | "community_member";

// -------------------------
// ROLE DATA
// -------------------------

const roles = [
  {
    id: "pwd",
    title: "PwD",
    subtitle: "I have a disability",
    icon: "♿",
  },

  {
    id: "caregiver",
    title: "Caregiver",
    subtitle: "I care for someone",
    icon: "♡",
  },

  {
    id: "educator",
    title: "Educator",
    subtitle: "I teach or do therapy",
    icon: "📖",
  },

  {
    id: "ngo_worker",
    title: "NGO Worker",
    subtitle: "I work with an NGO",
    icon: "🏢",
  },

  {
    id: "skill_trainer",
    title: "Skill Trainer",
    subtitle: "I train or hire PwDs",
    icon: "💼",
  },

  {
    id: "community_member",
    title: "Community Member",
    subtitle: "I want to support",
    icon: "👥",
  },
];

const RoleSelectionScreen = () => {
  const insets = useSafeAreaInsets();
  // -------------------------
  // STATES
  // -------------------------

  const [selected, setSelected] =
    useState<RoleType[]>([]);

  const [loading, setLoading] =
    useState(false);

  const navigation = useNavigation<any>();

  const setPendingRoles =
    useAuthStore(
      (s) => s.setPendingRoles
    );

  // -------------------------
  // BACK HANDLER
  // -------------------------

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

  // -------------------------
  // SELECT ROLE
  // -------------------------

  const handleRoleSelect = (
    roleId: RoleType
  ) => {
    setSelected((prev) =>
      prev.includes(roleId)
        ? prev.filter((r) => r !== roleId)
        : [...prev, roleId]
    );
  };

  // -------------------------
  // CONTINUE
  // -------------------------

  const handleContinue = () => {
    if (selected.length === 0) {
      Alert.alert(
        "Select Role",
        "Please select at least one role."
      );

      return;
    }

    setLoading(true);

    // SAVE ROLES
    setPendingRoles(selected);

    setTimeout(() => {
      setLoading(false);

      navigation.navigate(
        "Profile"
      );
    }, 700);
  };

  return (
    <SafeScreen
      bottom={false}
      statusBarStyle="dark"
    >

      {/* HEADER */}
      <View style={styles.header}>
        {/* BACK */}
        <TouchableOpacity
          style={styles.backButton}
          onPress={handleBack}
        >
          <Text style={styles.backIcon}>
            ←
          </Text>
        </TouchableOpacity>

        {/* PROGRESS */}
        <View
          style={
            styles.progressWrapper
          }
        >
          <View
            style={
              styles.inactiveDot
            }
          />

          <View
            style={
              styles.activeBar
            }
          />

          <View
            style={
              styles.inactiveDot
            }
          />

          <View
            style={
              styles.inactiveDot
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
        {/* TITLE */}
        <View
          style={
            styles.headingSection
          }
        >
          <Text style={styles.title}>
            I am a...
          </Text>

          <Text
            style={styles.subtitle}
          >
            Select the role that best describes you.
          </Text>
        </View>

        {/* ROLE GRID */}
        <View style={styles.grid}>
          {roles.map((role) => {
            const isSelected =
              selected.includes(role.id as RoleType);

            return (
              <TouchableOpacity
                key={role.id}
                activeOpacity={0.85}
                style={[
                  styles.card,

                  isSelected &&
                  styles.selectedCard,
                ]}
                onPress={() =>
                  handleRoleSelect(
                    role.id as RoleType
                  )
                }
              >
                {/* CHECK */}
                {isSelected && (
                  <View
                    style={
                      styles.checkCircle
                    }
                  >
                    <Text
                      style={
                        styles.checkText
                      }
                    >
                      ✓
                    </Text>
                  </View>
                )}

                {/* ICON */}
                <View
                  style={
                    styles.iconWrap
                  }
                >
                  <Text
                    style={
                      styles.icon
                    }
                  >
                    {role.icon}
                  </Text>
                </View>

                {/* TITLE */}
                <Text
                  style={
                    styles.cardTitle
                  }
                >
                  {role.title}
                </Text>

                {/* SUBTITLE */}
                <Text
                  style={
                    styles.cardSubtitle
                  }
                >
                  {role.subtitle}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* NOTE */}
        <Text style={styles.note}>
          You can update your roles
          anytime in Profile
        </Text>

        <View
          style={{ height: 120 }}
        />
      </ScrollView>

      {/* FOOTER */}
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 20) }]}>
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={handleContinue}
          disabled={loading}
        >
          <LinearGradient
            colors={[
              "#6B21A8",
              "#7E22CE",
            ]}
            style={styles.button}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text
                style={
                  styles.buttonText
                }
              >
                Continue
              </Text>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </SafeScreen>
  );
};

export default RoleSelectionScreen;

// -------------------------
// STYLES
// -------------------------

const styles =
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor:
        "#F5F5F5",
    },

    // HEADER
    header: {
      height: 64,

      flexDirection: "row",
      justifyContent:
        "space-between",
      alignItems: "center",

      paddingHorizontal: 24,
      backgroundColor:
        "#F5F5F5",
    },

    backButton: {
      width: 32,
      height: 32,

      justifyContent:
        "center",
      alignItems: "center",
    },

    backIcon: {
      fontSize: 24,
      color: "#6B21A8",
      fontWeight: "700",
    },

    progressWrapper: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },

    activeBar: {
      width: 24,
      height: 8,
      borderRadius: 999,
      backgroundColor:
        "#7E22CE",
    },

    inactiveDot: {
      width: 8,
      height: 8,
      borderRadius: 999,
      backgroundColor:
        "#E5DDED",
    },

    // BODY
    scrollContent: {
      paddingHorizontal: 24,
      paddingTop: 24,
      paddingBottom: 140,
    },

    headingSection: {
      marginBottom: 32,
    },

    title: {
      fontSize: 24,
      fontWeight: "700",
      color: "#1A1B20",
      marginBottom: 6,
    },

    subtitle: {
      fontSize: 16,
      color: "#666",
      lineHeight: 24,
    },

    // GRID
    grid: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent:
        "space-between",
    },

    card: {
      width: "47%",

      minHeight: 132,

      backgroundColor:
        "#FFFFFF",

      borderRadius: 20,

      padding: 18,

      marginBottom: 18,

      justifyContent:
        "center",
      alignItems: "center",

      position: "relative",

      shadowColor: "#000",
      shadowOpacity: 0.04,
      shadowRadius: 8,
      shadowOffset: {
        width: 0,
        height: 2,
      },

      elevation: 2,
    },

    selectedCard: {
      backgroundColor: "#F3EAFF",

      transform: [{ scale: 1.03 }],

      shadowColor: "#8A38F5",
      shadowOpacity: 0.15,
      shadowRadius: 12,
      shadowOffset: {
        width: 0,
        height: 4,
      },

      elevation: 6,
    },

    checkCircle: {
      position: "absolute",
      top: 10,
      right: 10,

      width: 28,
      height: 28,

      borderRadius: 999,

      backgroundColor:
        "#8A38F5",

      justifyContent:
        "center",
      alignItems: "center",
    },

    checkText: {
      color: "#FFFFFF",
      fontSize: 14,
      fontWeight: "700",
    },

    iconWrap: {
      marginBottom: 14,
    },

    icon: {
      fontSize: 34,
      color: "#8A38F5",
    },

    cardTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: "#1A1B20",

      textAlign: "center",

      marginBottom: 6,
    },

    cardSubtitle: {
      fontSize: 13,
      lineHeight: 18,

      textAlign: "center",

      color: "#666",
    },

    // NOTE
    note: {
      marginTop: 26,

      textAlign: "center",

      fontSize: 14,
      color: "#666",
    },

    // FOOTER
    footer: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,

      paddingHorizontal: 24,
      paddingBottom: 30,
      paddingTop: 20,

      backgroundColor:
        "#F5F5F5",
    },

    button: {
      height: 60,

      borderRadius: 16,

      justifyContent:
        "center",
      alignItems: "center",

      shadowColor: "#6B21A8",
      shadowOpacity: 0.3,
      shadowRadius: 12,
      shadowOffset: {
        width: 0,
        height: 6,
      },

      elevation: 8,
    },

    buttonText: {
      color: "#FFFFFF",
      fontSize: 20,
      fontWeight: "700",
    },
  });