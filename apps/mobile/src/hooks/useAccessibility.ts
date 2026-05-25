import { useAccessibilityStore } from '../store/accessibilityStore';
import { StyleSheet } from 'react-native';

export const useAccessibility = () => {
  const preferences = useAccessibilityStore((state) => state.preferences);

  const { textSize, highContrast, reduceMotion, screenReader } = preferences;

  // 1. Font Size Scaling Helper
  const fs = (size: number) => {
    switch (textSize) {
      case 'Small':
        return Math.round(size * 0.85);
      case 'Large':
        return Math.round(size * 1.25);
      case 'Medium':
      default:
        return size;
    }
  };

  // 2. High Contrast Theme Colors
  const colors = {
    primary: highContrast ? '#000000' : '#500088',
    secondary: highContrast ? '#000000' : '#6B21A8',
    background: highContrast ? '#FFFFFF' : '#FAF8FF',
    card: highContrast ? '#FFFFFF' : '#FFFFFF',
    text: highContrast ? '#000000' : '#1A1B20',
    subtext: highContrast ? '#000000' : '#666666',
    border: highContrast ? '#000000' : 'rgba(0,0,0,0.05)',
    surface: highContrast ? '#FFFFFF' : '#F4F3FA',
    badge: highContrast ? '#000000' : '#F59E0B',
    white: '#FFFFFF',
    error: highContrast ? '#BA1A1A' : '#BA1A1A',
  };

  // 3. Dynamic High Contrast Borders/Styles
  const accessibilityStyles = StyleSheet.create({
    cardBorder: {
      borderWidth: highContrast ? 2 : 1,
      borderColor: highContrast ? '#000000' : 'rgba(0,0,0,0.05)',
    },
    buttonBorder: {
      borderWidth: highContrast ? 2 : 0,
      borderColor: highContrast ? '#000000' : 'transparent',
    },
  });

  return {
    textSize,
    highContrast,
    reduceMotion,
    screenReader,
    fs,
    colors,
    styles: accessibilityStyles,
  };
};
