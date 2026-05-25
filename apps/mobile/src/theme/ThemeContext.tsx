import React, { createContext, useContext, useMemo } from 'react';
import { useAccessibilityStore } from '../store/accessibilityStore';
import { TextSize } from '../services/storageService';

// Define the shape of our typography variant style
export interface TypographyStyle {
  fontSize: number;
  lineHeight?: number;
  fontWeight: '400' | '500' | '600' | '700' | '800' | 'normal' | 'bold';
  fontFamily: string;
  letterSpacing?: number;
  textTransform?: 'none' | 'uppercase' | 'lowercase' | 'capitalize';
  color: string;
}

// Spacing shape
export interface Spacing {
  xs: number;
  sm: number;
  md: number;
  lg: number;
  xl: number;
}

// Colors shape
export interface ThemeColors {
  primary: string;
  secondary: string;
  background: string;
  card: string;
  text: string;
  subtext: string;
  border: string;
  surface: string;
  badge: string;
  white: string;
  error: string;
}

// Theme Context Shape
export interface ThemeContextProps {
  colors: ThemeColors;
  spacing: Spacing;
  typography: {
    heroTitle: TypographyStyle;
    title: TypographyStyle;
    subtitle: TypographyStyle;
    body: TypographyStyle;
    label: TypographyStyle;
    caption: TypographyStyle;
    button: TypographyStyle;
    input: TypographyStyle;
    overline: TypographyStyle;
  };
  reduceMotion: boolean;
  screenReader: boolean;
  maxFontSizeMultiplier: number;
  highContrast: boolean;
  textSize: TextSize;
}

const ThemeContext = createContext<ThemeContextProps | undefined>(undefined);

export const AppThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const preferences = useAccessibilityStore((state) => state.preferences);
  const { textSize, highContrast, reduceMotion, screenReader } = preferences;

  const themeValue = useMemo(() => {
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
    const colors: ThemeColors = {
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
      error: '#BA1A1A',
    };

    // 3. Dynamic spacing that expands slightly for readability in large text modes
    const spacingScale = textSize === 'Large' ? 1.15 : 1.0;
    const spacing: Spacing = {
      xs: Math.round(4 * spacingScale),
      sm: Math.round(8 * spacingScale),
      md: Math.round(16 * spacingScale),
      lg: Math.round(24 * spacingScale),
      xl: Math.round(32 * spacingScale),
    };

    // 4. Accessible Typography presets
    const typography = {
      heroTitle: {
        fontSize: fs(30),
        lineHeight: fs(38),
        fontWeight: '700' as const,
        fontFamily: 'Inter-Bold',
        color: colors.text,
      },
      title: {
        fontSize: fs(20),
        lineHeight: fs(28),
        fontWeight: '700' as const,
        fontFamily: 'Inter-Bold',
        color: colors.text,
      },
      subtitle: {
        fontSize: fs(16),
        lineHeight: fs(24),
        fontWeight: '500' as const,
        fontFamily: 'Inter-Regular',
        color: colors.subtext,
      },
      body: {
        fontSize: fs(14),
        lineHeight: fs(20),
        fontWeight: '400' as const,
        fontFamily: 'Inter-Regular',
        color: colors.text,
      },
      label: {
        fontSize: fs(12),
        fontWeight: '700' as const,
        fontFamily: 'Inter-Bold',
        letterSpacing: 1.2,
        color: colors.subtext,
      },
      caption: {
        fontSize: fs(11),
        fontWeight: '400' as const,
        fontFamily: 'Inter-Regular',
        color: colors.subtext,
      },
      button: {
        fontSize: fs(16),
        fontWeight: '700' as const,
        fontFamily: 'Inter-Bold',
        color: '#FFFFFF',
      },
      input: {
        fontSize: fs(16),
        fontWeight: '400' as const,
        fontFamily: 'Inter-Regular',
        color: colors.text,
      },
      overline: {
        fontSize: fs(10),
        fontWeight: '700' as const,
        fontFamily: 'Inter-Bold',
        letterSpacing: 1.5,
        textTransform: 'uppercase' as const,
        color: colors.subtext,
      },
    };

    return {
      colors,
      spacing,
      typography,
      reduceMotion,
      screenReader,
      maxFontSizeMultiplier: 1.6,
      highContrast,
      textSize,
    };
  }, [textSize, highContrast, reduceMotion, screenReader]);

  return (
    <ThemeContext.Provider value={themeValue}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within an AppThemeProvider');
  }
  return context;
};
