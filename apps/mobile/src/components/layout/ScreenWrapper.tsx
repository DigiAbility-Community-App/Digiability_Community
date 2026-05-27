import React from "react";
import {
  StyleSheet,
  View,
  Platform,
  ViewStyle,
  StyleProp,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
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
   * If true, wraps the children in KeyboardAwareScrollView. Defaults to false.
   */
  keyboardAvoiding?: boolean;
  /**
   * If true, applies bottom safe area padding. Defaults to true.
   */
  withBottomSafeArea?: boolean;
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
  withBottomSafeArea = true,
}) => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const containerStyle = [
    styles.container,
    { 
      backgroundColor: colors.background,
      paddingBottom: withBottomSafeArea ? insets.bottom : 0 
    },
    style,
  ];

  const content = <View style={containerStyle}>{children}</View>;

  return (
    <View style={styles.flex}>
      <StatusBar style={statusBarStyle} translucent backgroundColor="transparent" />
      {keyboardAvoiding ? (
        <KeyboardAwareScrollView
          style={styles.flex}
          contentContainerStyle={{ flexGrow: 1 }}
          enableOnAndroid={true}
          keyboardOpeningTime={0}
          extraScrollHeight={Platform.OS === 'ios' ? 20 : 0}
        >
          {content}
        </KeyboardAwareScrollView>
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
