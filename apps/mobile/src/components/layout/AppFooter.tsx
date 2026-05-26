import React from "react";
import { View, StyleSheet, TouchableOpacity, Platform } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useTheme } from "../../theme/ThemeContext";
import { AccessibleText } from "../shared/AccessibleText";

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
      label: "Home",
      route: "Home",
      accessibilityLabel: "Home tab",
      accessibilityHint: "Navigates to home screen dashboard",
    },
    {
      id: "Community" as const,
      label: "Community",
      route: "CommunityDetail",
      accessibilityLabel: "Community tab",
      accessibilityHint: "Navigates to community forums and updates",
    },
    {
      id: "Services" as const,
      label: "Services",
      route: "Services",
      accessibilityLabel: "Services tab",
      accessibilityHint: "Navigates to professional services listings",
    },
    {
      id: "Learn" as const,
      label: "Learn",
      route: "Chats", // Labeled 'Learn', but maps to the ChatsStack per current codebase standard
      accessibilityLabel: "Learn tab",
      accessibilityHint: "Navigates to chat learning rooms and conversations",
    },
    {
      id: "Profile" as const,
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
            style={[styles.navItem, styles.touchTarget]}
            accessible={true}
            accessibilityRole="tab"
            accessibilityState={{ selected: isSelected }}
            accessibilityLabel={tab.accessibilityLabel}
            accessibilityHint={tab.accessibilityHint}
            activeOpacity={0.7}
          >
            <AccessibleText
              variant="caption"
              numberOfLines={1}
              adjustsFontSizeToFit={true}
              style={[
                styles.navText,
                {
                  color: isSelected ? activeColor : inactiveColor,
                  fontWeight: isSelected ? "800" : "500",
                },
                isSelected &&
                highContrast && {
                  borderBottomWidth: 2,
                  borderBottomColor: "#000000",
                  paddingBottom: 2,
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
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    zIndex: 999,
    // Add subtle iOS shadow
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 10,
  },
  navItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  touchTarget: {
    minHeight: 48,
    justifyContent: "center",
    alignItems: "center",
  },
  navText: {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.2,
  },
});
