import React from "react";
import { View, StyleSheet, TouchableOpacity, Platform } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useTheme } from "../../theme/ThemeContext";
import { AccessibleText } from "../shared/AccessibleText";
import {
  House,
  Users,
  LayoutGrid,
  BookOpen,
  User,
} from "lucide-react-native";

export interface AppFooterProps {
  /**
   * The currently active tab name.
   * Values: "Home" | "Community" | "Services" | "Learn" | "Profile"
   */
  activeTab: "Home" | "Community" | "Services" | "Learn" | "Profile";
}

/**
 * AppFooter - A unified simulated bottom tab navigation bar.
 * Replaces duplicate tab code on all core screens with standard, premium accessibility features.
 */
export const AppFooter: React.FC<AppFooterProps> = ({ activeTab }) => {
  const navigation = useNavigation<any>();
  const { colors, highContrast, spacing } = useTheme();

  // Tab definitions
  const tabs = [
    {
      id: "Home" as const,
      icon: House,
      label: "Home",
      route: "Home",
      accessibilityLabel: "Home tab",
      accessibilityHint: "Navigates to home screen dashboard",
    },
    {
      id: "Community" as const,
      icon: Users,
      label: "Community",
      route: "CommunityDetail",
      accessibilityLabel: "Community tab",
      accessibilityHint: "Navigates to community forums and updates",
    },
    {
      id: "Services" as const,
      icon: LayoutGrid,
      label: "Services",
      route: "Home",
      accessibilityLabel: "Services tab",
      accessibilityHint: "Navigates to professional services listings",
    },
    {
      id: "Learn" as const,
      icon: BookOpen,
      label: "Learn",
      route: "Home", // Labeled 'Learn', but maps to the ChatsStack per current codebase standard
      accessibilityLabel: "Learn tab",
      accessibilityHint: "Navigates to chat learning rooms and conversations",
    },
    {
      id: "Profile" as const,
      icon: User,
      label: "Profile",
      route: "HomeProfile", // Maps to the profile tab details screen
      accessibilityLabel: "Profile tab",
      accessibilityHint: "Navigates to your profile and care settings",
    },
  ];

  const handlePress = (tab: (typeof tabs)[number]) => {
    if (tab.id === activeTab) return;

    try {
      navigation.navigate(tab.route);
    } catch (e) {
      console.warn(`Failed to navigate to route: ${tab.route}. Details:`, e);
      // Fallback navigation or alerts if routes are undefined in navigator
    }
  };

  const footerBg = highContrast ? "#FFFFFF" : "rgba(249, 248, 255, 0.95)";
  const activeColor = highContrast ? "#000000" : colors.primary;
  const inactiveColor = highContrast ? "#555555" : "#64748B";

  return (
    <View
      style={[
        styles.navbar,
        {
          backgroundColor: footerBg,
          borderTopColor: highContrast ? "#000000" : "rgba(0,0,0,0.05)",
          borderTopWidth: highContrast ? 2 : 1,
          paddingBottom: Platform.OS === "ios" ? 20 : 8,
          height: Platform.OS === "ios" ? 85 : 70,
        },
      ]}
      accessibilityRole="tablist"
    >
      {tabs.map((tab) => {
        const isSelected = tab.id === activeTab;

        return (
          <TouchableOpacity
            key={tab.id}
            onPress={() => handlePress(tab)}
            style={[
              styles.navItem,
              isSelected &&
              styles.activeNavItem,
            ]}
            accessible={true}
            accessibilityRole="tab"
            accessibilityState={{
              selected: isSelected,
            }}
            accessibilityLabel={
              tab.accessibilityLabel
            }
            accessibilityHint={
              tab.accessibilityHint
            }
            activeOpacity={0.85}
          >
            <tab.icon
              size={20}
              strokeWidth={2.4}
              color={
                isSelected
                  ? "#FFFFFF"
                  : inactiveColor
              }
            />

            <AccessibleText
              variant="caption"
              numberOfLines={1}
              adjustsFontSizeToFit={true}
              style={[
                styles.navText,
                {
                  color: isSelected
                    ? "#FFFFFF"
                    : inactiveColor,
                },
              ]}
            >
              {tab.label}
            </AccessibleText>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

export default AppFooter;

const styles = StyleSheet.create({
  navbar: {
    position: "absolute",
    bottom: 16,
    left: 16,
    right: 16,

    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",

    backgroundColor: "#FFFFFF",

    borderRadius: 28,

    paddingHorizontal: 10,
    paddingVertical: 10,

    shadowColor: "#500088",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.08,
    shadowRadius: 14,

    elevation: 6,

    zIndex: 999,
  },
  navItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",

    paddingVertical: 10,
    borderRadius: 20,
  },
  activeNavItem: {
    backgroundColor: "#6B21A8",
  },

  navText: {
    fontSize: 11,
    marginTop: 4,
    fontWeight: "700",
  },
});
