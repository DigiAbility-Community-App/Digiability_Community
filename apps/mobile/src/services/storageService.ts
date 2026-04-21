import * as SecureStore from 'expo-secure-store';

export type TextSize = 'Small' | 'Medium' | 'Large';

export interface AccessibilityPreferences {
  textSize: TextSize;
  highContrast: boolean;
  screenReader: boolean;
  reduceMotion: boolean;
  language: string;
  pushNotif: boolean;
  emailNotif: boolean;
  smsNotif: boolean;
}

const ACCESSIBILITY_KEY_PREFIX = 'digiability_accessibility';

export const defaultAccessibilityPreferences: AccessibilityPreferences = {
  textSize: 'Medium',
  highContrast: false,
  screenReader: true,
  reduceMotion: false,
  language: 'English',
  pushNotif: true,
  emailNotif: true,
  smsNotif: false,
};

function getAccessibilityKey(userId: string) {
  return `${ACCESSIBILITY_KEY_PREFIX}:${userId}`;
}

export async function getAccessibilityPreferences(
  userId: string
): Promise<AccessibilityPreferences | null> {
  const rawValue = await SecureStore.getItemAsync(getAccessibilityKey(userId));
  if (!rawValue) {
    return null;
  }

  try {
    return {
      ...defaultAccessibilityPreferences,
      ...JSON.parse(rawValue),
    } as AccessibilityPreferences;
  } catch {
    return null;
  }
}

export async function saveAccessibilityPreferences(
  userId: string,
  preferences: AccessibilityPreferences
): Promise<void> {
  await SecureStore.setItemAsync(
    getAccessibilityKey(userId),
    JSON.stringify(preferences)
  );
}

export async function hasCompletedAccessibility(userId: string): Promise<boolean> {
  const preferences = await getAccessibilityPreferences(userId);
  return preferences !== null;
}
