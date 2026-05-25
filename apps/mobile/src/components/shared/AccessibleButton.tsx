import React, { useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  PressableProps,
  StyleSheet,
  ViewStyle,
  StyleProp,
} from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { AccessibleText } from './AccessibleText';
import { animateIfAllowed } from '../../hooks/motionHelper';

export interface AccessibleButtonProps extends Omit<PressableProps, 'style'> {
  accessibilityLabel: string; // Enforce required accessibilityLabel
  accessibilityHint?: string;
  variant?: 'primary' | 'secondary' | 'outline' | 'danger';
  style?: StyleProp<ViewStyle>;
  textStyle?: any;
  children?: React.ReactNode | string;
}

export const AccessibleButton: React.FC<AccessibleButtonProps> = ({
  accessibilityLabel,
  accessibilityHint,
  variant = 'primary',
  disabled = false,
  style,
  textStyle,
  children,
  onPress,
  ...rest
}) => {
  const { colors, spacing, reduceMotion, highContrast } = useTheme();
  const [isFocused, setIsFocused] = useState(false);

  // Animation values
  const animatedScale = useRef(new Animated.Value(1)).current;
  const animatedOpacity = useRef(new Animated.Value(1)).current;

  // Animation events
  const handlePressIn = () => {
    if (disabled) return;
    Animated.parallel([
      animateIfAllowed(reduceMotion, animatedScale, {
        toValue: 0.97,
        duration: 100,
        useNativeDriver: true,
      }),
      animateIfAllowed(reduceMotion, animatedOpacity, {
        toValue: 0.85,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handlePressOut = () => {
    Animated.parallel([
      animateIfAllowed(reduceMotion, animatedScale, {
        toValue: 1.0,
        duration: 120,
        useNativeDriver: true,
      }),
      animateIfAllowed(reduceMotion, animatedOpacity, {
        toValue: 1.0,
        duration: 120,
        useNativeDriver: true,
      }),
    ]).start();
  };

  // Compute colors based on variant
  let backgroundColor = colors.primary;
  let textColor = '#FFFFFF';
  let borderWidth = highContrast ? 2 : 0;
  let borderColor = colors.border;

  if (variant === 'secondary') {
    backgroundColor = colors.secondary;
    textColor = '#FFFFFF';
  } else if (variant === 'outline') {
    backgroundColor = 'transparent';
    textColor = colors.primary;
    borderWidth = highContrast ? 3 : 2;
    borderColor = colors.primary;
  } else if (variant === 'danger') {
    backgroundColor = colors.error;
    textColor = '#FFFFFF';
  }

  // Double outline focused style
  const focusBorder: ViewStyle = isFocused || highContrast
    ? {
        borderWidth: highContrast ? Math.max(borderWidth, 3) : 2,
        borderColor: highContrast ? '#000000' : colors.primary,
      }
    : {};

  // Disabled overlay styling
  const disabledStyle: ViewStyle = disabled
    ? {
        opacity: 0.5,
      }
    : {};

  return (
    <Pressable
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      {...rest}
    >
      <Animated.View
        style={[
          styles.buttonBase,
          {
            backgroundColor,
            borderColor,
            borderWidth,
            paddingVertical: spacing.md,
            paddingHorizontal: spacing.lg,
          },
          focusBorder,
          disabledStyle,
          {
            transform: [{ scale: animatedScale }],
            opacity: animatedOpacity,
          },
          style,
        ]}
      >
        {typeof children === 'string' ? (
          <AccessibleText
            variant="button"
            style={[
              { color: textColor, textAlign: 'center' },
              textStyle,
            ]}
          >
            {children}
          </AccessibleText>
        ) : (
          children
        )}
      </Animated.View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  buttonBase: {
    borderRadius: 999,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 48, // Minimum touch target size compliance (48x48 dp)
    flexDirection: 'row',
  },
});
