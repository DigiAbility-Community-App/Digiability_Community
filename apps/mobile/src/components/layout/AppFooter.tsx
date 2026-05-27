import React, { useState, useRef, useEffect } from "react";
import { View, StyleSheet, TouchableOpacity, Platform, Animated } from "react-native";
import { useNavigation } from "@react-navigation/native";
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
  activeTab?: "Home" | "Community" | "Services" | "Learn" | "Profile";
  // React Navigation Custom Tab Bar Props
  state?: any;
  descriptors?: any;
  navigation?: any;
}

/**
 * AppFooter - A unified simulated bottom tab navigation bar.
 * Replaces duplicate tab code on all core screens with standard, premium accessibility features.
 * Supports smooth spring-animated active tab indicators.
 */
export const AppFooter: React.FC<AppFooterProps> = ({
  activeTab,
  state,
  descriptors,
  navigation,
}) => {
  const standaloneNavigation = useNavigation<any>();
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
      route: "Services",
      accessibilityLabel: "Services tab",
      accessibilityHint: "Navigates to professional services listings",
    },
    {
      id: "Learn" as const,
      icon: BookOpen,
      label: "Learn",
      route: "Learn",
      accessibilityLabel: "Learn tab",
      accessibilityHint: "Navigates to the learning academy resources",
    },
    {
      id: "Profile" as const,
      icon: User,
      label: "Profile",
      route: "HomeProfile",
      accessibilityLabel: "Profile tab",
      accessibilityHint: "Navigates to your profile and care settings",
    },
  ];

  // Resolve current active tab
  const getActiveTabName = () => {
    if (state && state.routes && state.routes[state.index]) {
      const routeName = state.routes[state.index].name;
      if (routeName === "Home") return "Home";
      if (routeName === "CommunityDetail") return "Community";
      if (routeName === "Services") return "Services";
      if (routeName === "Learn") return "Learn";
      if (routeName === "HomeProfile") return "Profile";
    }
    return activeTab || "Home";
  };

  const activeTabName = getActiveTabName();
  const activeIndex = tabs.findIndex((t) => t.id === activeTabName);

  // Dynamic layout measurement for sliding pill width
  const [containerWidth, setContainerWidth] = useState(0);
  const padding = 20; // 10 padding on left and right of navbar container
  const tabWidth = containerWidth ? (containerWidth - padding) / 5 : 0;

  const animX = useRef(new Animated.Value(activeIndex >= 0 ? activeIndex : 0)).current;

  useEffect(() => {
    if (activeIndex >= 0) {
      Animated.spring(animX, {
        toValue: activeIndex,
        useNativeDriver: true,
        tension: 40,
        friction: 8,
      }).start();
    }
  }, [activeIndex]);

  const handlePress = (tab: (typeof tabs)[number]) => {
    if (tab.id === activeTabName) return;

    if (state && navigation) {
      const event = navigation.emit({
        type: "tabPress",
        target: tab.route,
        canPreventDefault: true,
      });

      if (!event.defaultPrevented) {
        navigation.navigate({ name: tab.route, merge: true });
      }
    } else {
      try {
        standaloneNavigation.navigate(tab.route);
      } catch (e) {
        console.warn(`Failed to navigate to route: ${tab.route}. Details:`, e);
      }
    }
  };

  const footerBg = highContrast ? "#FFFFFF" : "rgba(249, 248, 255, 0.95)";
  const activeColor = highContrast ? "#000000" : colors.primary;
  const inactiveColor = highContrast ? "#555555" : "#64748B";

  const translateX = animX.interpolate({
    inputRange: [0, 1, 2, 3, 4],
    outputRange: [0, tabWidth, tabWidth * 2, tabWidth * 3, tabWidth * 4],
  });

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
      onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
    >
      {/* Sliding Active Pill Background (Standard mode only) */}
      {tabWidth > 0 && !highContrast && (
        <Animated.View
          style={[
            styles.activePill,
            {
              width: tabWidth + 4,
              transform: [{ translateX }],
            },
          ]}
        />
      )}

      {tabs.map((tab) => {
        const isSelected = tab.id === activeTabName;

        return (
          <TouchableOpacity
            key={tab.id}
            onPress={() => handlePress(tab)}
            style={[
              styles.navItem,
              isSelected && highContrast && styles.highContrastActiveNavItem,
            ]}
            accessible={true}
            accessibilityRole="tab"
            accessibilityState={{
              selected: isSelected,
            }}
            accessibilityLabel={tab.accessibilityLabel}
            accessibilityHint={tab.accessibilityHint}
            activeOpacity={0.85}
          >
            <tab.icon
              size={20}
              strokeWidth={2.4}
              color={
                isSelected && !highContrast
                  ? "#FFFFFF"
                  : isSelected && highContrast
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
                  color: isSelected && !highContrast
                    ? "#FFFFFF"
                    : isSelected && highContrast
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
  highContrastActiveNavItem: {
    backgroundColor: "#000000",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  activePill: {
    position: "absolute",
    left: 8,
    top: 10,
    bottom: Platform.OS === "ios" ? 25 : 10,
    backgroundColor: "#6B21A8",
    borderRadius: 20,
  },
  navText: {
    fontSize: 11,
    marginTop: 4,
    fontWeight: "700",
  },
});
