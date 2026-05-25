import React from "react";
import { StyleSheet, View, ViewStyle, StyleProp } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../theme/ThemeContext";
import ScreenWrapper from "./ScreenWrapper";

export interface SafeScreenProps {
  children: React.ReactNode;
  /**
   * Apply safe area inset to the top. Defaults to true.
   */
  top?: boolean;
  /**
   * Apply safe area inset to the bottom. Defaults to true.
   */
  bottom?: boolean;
  /**
   * Optional custom styling.
   */
  style?: StyleProp<ViewStyle>;
  /**
   * Status bar icon colour. Defaults to "dark" since SafeScreen is
   * typically used on light-background screens without a coloured header.
   */
  statusBarStyle?: "light" | "dark" | "auto";
}

/**
 * SafeScreen - A convenient wrapper that applies safe area insets directly to
 * layout margins, protecting content from notches, home indicators, and system overlays.
 */
export const SafeScreen: React.FC<SafeScreenProps> = ({
  children,
  top = true,
  bottom = true,
  style,
  statusBarStyle = "dark",
}) => {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  return (
    <ScreenWrapper statusBarStyle={statusBarStyle}>
      <View
        style={[
          styles.container,
          {
            paddingTop: top ? insets.top : 0,
            paddingBottom: bottom ? insets.bottom : 0,
            backgroundColor: colors.background,
          },
          style,
        ]}
      >
        {children}
      </View>
    </ScreenWrapper>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default SafeScreen;
