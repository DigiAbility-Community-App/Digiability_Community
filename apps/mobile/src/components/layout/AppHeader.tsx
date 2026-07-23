import React, { useEffect } from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Image,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { ArrowLeft, Bell } from "lucide-react-native";
import { useNavigation } from "@react-navigation/native";
import { useTheme } from "../../theme/ThemeContext";
import { AccessibleText } from "../shared/AccessibleText";
import { useScreenReaderAnnounce } from "../../hooks/useScreenReaderAnnounce";

export interface AppHeaderProps {
  /**
   * String title to show in the header.
   */
  title?: string;
  /**
   * If true, displays the DigiAbility brand logo next to the title.
   */
  showLogo?: boolean;
  /**
   * Optional callback when back button is pressed. If omitted, no back button is rendered.
   * If provided and back button is pressed, this is executed.
   */
  onBackPress?: () => void;
  /**
   * Optional custom ReactNode elements to display on the right side of the header.
   */
  rightActions?: React.ReactNode;
  /**
   * If true, renders the notification bell with an optional notification badge.
   */
  showNotification?: boolean;
  /**
   * If true, renders the user profile avatar button.
   */
  showProfile?: boolean;
  /**
   * Optional custom callback for when notifications bell is clicked.
   */
  onNotificationPress?: () => void;
  /**
   * Optional custom callback for profile avatar click.
   */
  onProfilePress?: () => void;
  /**
   * If true, shows the orange notification badge over the notification bell.
   */
  hasUnreadNotifications?: boolean;
  /**
   * If true, hides the back button even if navigation history is present.
   */
  hideBackButton?: boolean;
}

/**
 * AppHeader - A centralized, highly reusable premium header component.
 * Automatically resolves top status bar overlaps using safe-area insets,
 * configures status bars dynamically, integrates theme variables, and supports VoiceOver/TalkBack.
 */
export const AppHeader: React.FC<AppHeaderProps> = ({
  title,
  showLogo = false,
  onBackPress,
  rightActions,
  showNotification = false,
  showProfile = false,
  onNotificationPress,
  onProfilePress,
  hasUnreadNotifications = false,
  hideBackButton = false,
}) => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { colors, spacing, highContrast, reduceMotion } = useTheme();
  const announce = useScreenReaderAnnounce();

  // Speaks the screen title on mount/change — a spoken screen-transition
  // cue, gated behind the Screen Reader accessibility preference.
  useEffect(() => {
    if (title) {
      announce(title);
    }
  }, [title, announce]);

  // Dynamic Theme Styling
  const headerBgColor = highContrast ? "#000000" : colors.primary;
  const headerTextColor = "#FFFFFF";
  const iconColor = "#FFFFFF";

  // Determine standard height of the header contents (excluding status bar inset)
  const headerContentHeight = Platform.OS === "ios" ? 56 : 60;

  // Handles standard back navigation if onBackPress is not customized
  const handleBack = () => {
    if (onBackPress) {
      onBackPress();
    } else if (navigation.canGoBack()) {
      navigation.goBack();
    }
  };

  return (
    <View
      style={[
        styles.headerOuter,
        {
          backgroundColor: headerBgColor,
          paddingTop: insets.top,
          height: headerContentHeight + insets.top,
        },
        highContrast
          ? styles.highContrastHeader
          : {
              borderBottomLeftRadius: 24,
              borderBottomRightRadius: 24,
              shadowColor: "#000",
              shadowOpacity: 0.08,
              shadowRadius: 8,
              elevation: 4,
            },
      ]}
      accessibilityRole="header"
    >
      {/* Translucent status bar integration matching current theme state */}
      <StatusBar
        style={highContrast ? "light" : "light"}
        translucent
        backgroundColor="transparent"
      />

      <View style={[styles.headerInner, { height: headerContentHeight }]}>
        {/* LEFT SECTION */}
        <View style={styles.leftSection}>
          {!hideBackButton && (onBackPress !== undefined || navigation.canGoBack()) ? (
            <TouchableOpacity
              style={[styles.actionButton, styles.touchTarget]}
              onPress={handleBack}
              accessibilityRole="button"
              accessibilityLabel="Go Back"
              accessibilityHint="Navigates to the previous screen"
              activeOpacity={0.7}
            >
              <ArrowLeft color={iconColor} size={24} />
            </TouchableOpacity>
          ) : null}

          {showLogo && (
            <Image
              source={require("../../../assets/logo.png")}
              style={[styles.logoImage, { marginRight: spacing.sm }]}
              resizeMode="contain"
              accessible={true}
              accessibilityLabel="DigiAbility Logo"
            />
          )}

          {title ? (
            <AccessibleText
              variant="title"
              style={[styles.headerTitle, { color: headerTextColor }]}
              numberOfLines={1}
            >
              {title}
            </AccessibleText>
          ) : null}
        </View>

        {/* RIGHT SECTION */}
        <View style={styles.rightSection}>
          {rightActions}

          {showNotification && (
            <TouchableOpacity
              style={[styles.actionButton, styles.touchTarget]}
              onPress={() => {
                if (onNotificationPress) {
                  onNotificationPress();
                } else {
                  navigation.navigate("Notifications");
                }
              }}
              accessibilityRole="button"
              accessibilityLabel="Notifications"
              accessibilityHint="Navigates to notifications list"
              activeOpacity={0.7}
            >
              <Bell color={iconColor} size={22} />
              {hasUnreadNotifications && (
                <View
                  style={[
                    styles.notificationBadge,
                    highContrast && { backgroundColor: "#FFFFFF" },
                  ]}
                />
              )}
            </TouchableOpacity>
          )}

          {showProfile && (
            <TouchableOpacity
              style={[styles.profileButton, styles.touchTarget]}
              onPress={() => {
                if (onProfilePress) {
                  onProfilePress();
                } else {
                  navigation.navigate("HomeProfile");
                }
              }}
              accessibilityRole="button"
              accessibilityLabel="Profile settings"
              accessibilityHint="Navigates to profile setup options"
              activeOpacity={0.7}
            >
              <Image
                source={require("../../../assets/user icon.png")}
                style={styles.avatarImage}
                resizeMode="cover"
              />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
};

export default AppHeader;

const styles = StyleSheet.create({
  headerOuter: {
    width: "100%",
    justifyContent: "flex-end",
    zIndex: 1000,
  },
  highContrastHeader: {
    borderBottomWidth: 2,
    borderBottomColor: "#FFFFFF",
  },
  headerInner: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  leftSection: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    height: "100%",
  },
  rightSection: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    height: "100%",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
  },
  logoImage: {
    width: 24,
    height: 24,
  },
  touchTarget: {
    minWidth: 48,
    minHeight: 48,
    justifyContent: "center",
    alignItems: "center",
  },
  actionButton: {
    padding: 6,
    borderRadius: 8,
  },
  profileButton: {
    borderRadius: 999,
    padding: 2,
    marginLeft: 6,
  },
  avatarImage: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
  },
  notificationBadge: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#F59E0B",
  },
});
