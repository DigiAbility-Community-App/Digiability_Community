import React, { useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Alert,
  BackHandler,
  ScrollView,
} from "react-native";

import {
  useNavigation,
  useFocusEffect,
} from "@react-navigation/native";

import { useAuthStore } from "@store/authStore";
import { logout } from "@services/authService";
import SafeScreen from "../../components/layout/SafeScreen";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../theme/ThemeContext";
import { AccessibleText } from "../../components/shared/AccessibleText";
import { AccessibleButton } from "../../components/shared/AccessibleButton";

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
  const { colors, highContrast } = useTheme();
  // -------------------------
  // STATES
  // -------------------------

  const [selected, setSelected] =
    useState<RoleType[]>([]);


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

    setPendingRoles(selected);
    navigation.navigate("Profile");
  };

  const cardBorder = highContrast
    ? { borderWidth: 2, borderColor: "#000000" }
    : { borderWidth: 1, borderColor: "rgba(0,0,0,0.05)" };

  return (
    <SafeScreen
      bottom={false}
      statusBarStyle="dark"
      style={{ backgroundColor: colors.background }}
    >

      {/* HEADER */}
      <View style={[styles.header, { backgroundColor: colors.background }]}>
        {/* BACK */}
        <TouchableOpacity
          style={styles.backButton}
          onPress={handleBack}
          accessibilityRole="button"
          accessibilityLabel="Go Back"
          accessibilityHint="Returns to the previous screen"
        >
          <AccessibleText style={[styles.backIcon, { color: colors.secondary }]}>
            ←
          </AccessibleText>
        </TouchableOpacity>

        {/* PROGRESS */}
        <View
          style={
            styles.progressWrapper
          }
        >
          <View
            style={[
              styles.inactiveDot,
              highContrast && { backgroundColor: "#000000" },
            ]}
          />

          <View
            style={[styles.activeBar, { backgroundColor: colors.secondary }]}
          />

          <View
            style={[
              styles.inactiveDot,
              highContrast && { backgroundColor: "#000000" },
            ]}
          />

          <View
            style={[
              styles.inactiveDot,
              highContrast && { backgroundColor: "#000000" },
            ]}
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
          <AccessibleText variant="title" style={[styles.title, { color: colors.text }]}>
            I am a...
          </AccessibleText>

          <AccessibleText
            variant="body"
            style={[styles.subtitle, { color: colors.subtext }]}
          >
            Select the role that best describes you.
          </AccessibleText>
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
                  { backgroundColor: colors.card },
                  cardBorder,

                  isSelected &&
                  (highContrast
                    ? { backgroundColor: "#000000", borderWidth: 2, borderColor: colors.secondary }
                    : styles.selectedCard),
                ]}
                onPress={() =>
                  handleRoleSelect(
                    role.id as RoleType
                  )
                }
                accessibilityRole="checkbox"
                accessibilityState={{ checked: isSelected }}
                accessibilityLabel={role.title}
                accessibilityHint={`${role.subtitle}. Double tap to ${isSelected ? "deselect" : "select"} this role`}
              >
                {/* CHECK */}
                {isSelected && (
                  <View
                    style={[styles.checkCircle, { backgroundColor: colors.secondary }]}
                  >
                    <AccessibleText
                      style={
                        styles.checkText
                      }
                    >
                      ✓
                    </AccessibleText>
                  </View>
                )}

                {/* ICON */}
                <View
                  style={
                    styles.iconWrap
                  }
                >
                  <AccessibleText
                    style={[
                      styles.icon,
                      { color: highContrast && isSelected ? colors.white : colors.secondary },
                    ]}
                  >
                    {role.icon}
                  </AccessibleText>
                </View>

                {/* TITLE */}
                <AccessibleText
                  variant="title"
                  style={[
                    styles.cardTitle,
                    { color: highContrast && isSelected ? colors.white : colors.text },
                  ]}
                >
                  {role.title}
                </AccessibleText>

                {/* SUBTITLE */}
                <AccessibleText
                  variant="body"
                  style={[
                    styles.cardSubtitle,
                    { color: highContrast && isSelected ? colors.white : colors.subtext },
                  ]}
                >
                  {role.subtitle}
                </AccessibleText>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* NOTE */}
        <AccessibleText variant="body" style={[styles.note, { color: colors.subtext }]}>
          You can update your roles
          anytime in Profile
        </AccessibleText>

        <View
          style={{ height: 120 }}
        />
      </ScrollView>

      {/* FOOTER */}
      <View style={[styles.footer, { backgroundColor: colors.background, paddingBottom: Math.max(insets.bottom, 20) }]}>
        <AccessibleButton
          accessibilityLabel="Continue"
          accessibilityHint="Saves your selected roles and proceeds to the next step"
          style={styles.button}
          onPress={handleContinue}
        >
          Continue
        </AccessibleButton>
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
    // HEADER
    header: {
      height: 64,

      flexDirection: "row",
      justifyContent:
        "space-between",
      alignItems: "center",

      paddingHorizontal: 24,
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
      marginBottom: 6,
    },

    subtitle: {
      fontSize: 16,
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
    },

    cardTitle: {
      fontSize: 16,

      textAlign: "center",

      marginBottom: 6,
    },

    cardSubtitle: {
      fontSize: 13,
      lineHeight: 18,

      textAlign: "center",
    },

    // NOTE
    note: {
      marginTop: 26,

      textAlign: "center",

      fontSize: 14,
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
    },

    button: {
      minHeight: 60,
      borderRadius: 16,
    },
  });
