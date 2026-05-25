import React from "react";
import {
  StyleSheet,
  View,
  KeyboardAvoidingView,
  Platform,
  ViewStyle,
  StyleProp,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { useTheme } from "../../theme/ThemeContext";

export interface ScreenWrapperProps {
  children: React.ReactNode;
  /**
   * Optional custom style for the outer container.
   */
  style?: StyleProp<ViewStyle>;
  /**
   * Optional custom status bar style. Defaults to "light" when using headers, or switches based on theme.
   */
  statusBarStyle?: "light" | "dark" | "auto";
  /**
   * If true, wraps the children in KeyboardAvoidingView. Defaults to false.
   */
  keyboardAvoiding?: boolean;
}

/**
 * ScreenWrapper - The primary high-level layout component for every screen.
 * Standardizes background colors, wraps keyboard behavior, and aligns status bars.
 */
export const ScreenWrapper: React.FC<ScreenWrapperProps> = ({
  children,
  style,
  statusBarStyle = "light",
  keyboardAvoiding = false,
}) => {
  const { colors } = useTheme();

  const containerStyle = [
    styles.container,
    { backgroundColor: colors.background },
    style,
  ];

  const content = <View style={containerStyle}>{children}</View>;

  return (
    <View style={styles.flex}>
      <StatusBar style={statusBarStyle} translucent backgroundColor="transparent" />
      {keyboardAvoiding ? (
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.flex}
        >
          {content}
        </KeyboardAvoidingView>
      ) : (
        content
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
});

export default ScreenWrapper;
