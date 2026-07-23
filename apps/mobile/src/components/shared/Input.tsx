import React, { useState, useEffect } from 'react';
import {
  View,
  TextInput,
  TextInputProps,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { AccessibleText } from './AccessibleText';
import { useScreenReaderAnnounce } from '../../hooks/useScreenReaderAnnounce';

export interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  containerStyle?: ViewStyle;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  accessibilityLabel,
  accessibilityHint,
  containerStyle,
  style,
  onFocus,
  onBlur,
  placeholderTextColor,
  ...rest
}) => {
  const { colors, spacing, maxFontSizeMultiplier, highContrast } = useTheme();
  const [isFocused, setIsFocused] = useState(false);
  const announce = useScreenReaderAnnounce();

  // Announce errors to screen readers, only when the user has the
  // Screen Reader accessibility preference enabled.
  useEffect(() => {
    if (error) {
      announce(`Error in input field: ${error}`);
    }
  }, [error, announce]);

  const handleFocus = (e: any) => {
    setIsFocused(true);
    if (onFocus) onFocus(e);
  };

  const handleBlur = (e: any) => {
    setIsFocused(false);
    if (onBlur) onBlur(e);
  };

  const finalAccessibilityLabel = accessibilityLabel || label || rest.placeholder || 'Text Input Field';

  // Dynamic borders for normal/focused/highContrast states
  const borderStyle: ViewStyle = {
    borderWidth: highContrast ? 2 : 1,
    borderColor: error
      ? colors.error
      : isFocused
      ? colors.primary
      : highContrast
      ? '#000000'
      : colors.border,
  };

  // Focused state gets a thicker outline for low vision users
  const focusOutline: ViewStyle = isFocused
    ? {
        borderWidth: 2,
        borderColor: colors.primary,
      }
    : {};

  return (
    <View style={[styles.container, containerStyle]}>
      {/* Input Label */}
      {!!label && (
        <AccessibleText
          variant="label"
          style={[styles.label, { marginBottom: spacing.xs }]}
        >
          {label}
        </AccessibleText>
      )}

      {/* Input Field wrapper */}
      <View style={[styles.wrapper, borderStyle, focusOutline]}>
        <TextInput
          accessible={true}
          accessibilityLabel={finalAccessibilityLabel}
          accessibilityHint={accessibilityHint}
          accessibilityState={{ disabled: !rest.editable }}
          importantForAccessibility="yes"
          maxFontSizeMultiplier={maxFontSizeMultiplier}
          placeholderTextColor={placeholderTextColor || (highContrast ? '#000000' : 'rgba(126,115,131,0.5)')}
          onFocus={handleFocus}
          onBlur={handleBlur}
          style={[
            styles.input,
            {
              color: colors.text,
              fontSize: 16, // Minimum legible size
              paddingVertical: spacing.md,
              paddingHorizontal: spacing.md,
            },
            style,
          ]}
          {...rest}
        />
      </View>

      {/* Error Message */}
      {!!error && (
        <AccessibleText
          variant="caption"
          color={colors.error}
          accessibilityRole="alert"
          style={{ marginTop: spacing.xs, fontWeight: '700' }}
        >
          ⚠️ {error}
        </AccessibleText>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  label: {
    textTransform: 'uppercase',
  },
  wrapper: {
    borderRadius: 12,
    backgroundColor: '#F4F3FA',
    overflow: 'hidden',
  },
  input: {
    width: '100%',
    fontFamily: 'Inter-Regular',
    minHeight: 48, // Minimum tap height
  },
});
