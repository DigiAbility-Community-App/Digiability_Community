import React from "react";
import { StyleSheet, View, ViewStyle, StyleProp } from "react-native";
import { useTheme } from "../../theme/ThemeContext";

export interface AppContainerProps {
  children: React.ReactNode;
  /**
   * Optional custom styling for the container view.
   */
  style?: StyleProp<ViewStyle>;
  /**
   * If true, removes the horizontal padding. Defaults to false.
   */
  fluid?: boolean;
}

/**
 * AppContainer - Standardizes layout grids and horizontal padding across screens.
 * Maintains design consistency and readability limits.
 */
export const AppContainer: React.FC<AppContainerProps> = ({
  children,
  style,
  fluid = false,
}) => {
  const { spacing } = useTheme();

  return (
    <View
      style={[
        styles.container,
        {
          paddingHorizontal: fluid ? 0 : spacing.md,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: "100%",
  },
});

export default AppContainer;
