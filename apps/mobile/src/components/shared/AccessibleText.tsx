import React from 'react';
import { Text as RNText, TextProps as RNTextProps, StyleSheet } from 'react-native';
import { useTheme, TypographyStyle } from '../../theme/ThemeContext';

export interface AccessibleTextProps extends RNTextProps {
  variant?: 'heroTitle' | 'title' | 'subtitle' | 'body' | 'label' | 'caption' | 'button' | 'input' | 'overline';
  color?: string;
}

export const AccessibleText: React.FC<AccessibleTextProps> = ({
  children,
  variant = 'body',
  style,
  color,
  maxFontSizeMultiplier,
  ...rest
}) => {
  const { typography, maxFontSizeMultiplier: themeMaxMultiplier } = useTheme();

  // Get active variant preset from theme context
  const variantStyle: TypographyStyle = typography[variant] || typography.body;

  // Custom color override if provided, else use variant color
  const finalColor = color || variantStyle.color;

  return (
    <RNText
      maxFontSizeMultiplier={maxFontSizeMultiplier !== undefined ? maxFontSizeMultiplier : themeMaxMultiplier}
      style={[
        styles.base,
        variantStyle,
        { color: finalColor },
        style,
      ]}
      {...rest}
    >
      {children}
    </RNText>
  );
};

const styles = StyleSheet.create({
  base: {
    // Shared fallback base styles
    fontVariant: [],
  },
});
