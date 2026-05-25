import { create } from 'zustand';
import {
  AccessibilityPreferences,
  defaultAccessibilityPreferences,
  getAccessibilityPreferences,
  saveAccessibilityPreferences as persistPreferences,
} from '../services/storageService';

interface AccessibilityState {
  preferences: AccessibilityPreferences;
  isLoaded: boolean;
  loadPreferences: (userId: string) => Promise<void>;
  updatePreferences: (userId: string, prefs: Partial<AccessibilityPreferences>) => Promise<void>;
  setLocalPreferences: (prefs: Partial<AccessibilityPreferences>) => void;
}

export const useAccessibilityStore = create<AccessibilityState>((set, get) => ({
  preferences: defaultAccessibilityPreferences,
  isLoaded: false,
  loadPreferences: async (userId: string) => {
    try {
      const saved = await getAccessibilityPreferences(userId);
      if (saved) {
        set({ preferences: saved, isLoaded: true });
      } else {
        set({ preferences: defaultAccessibilityPreferences, isLoaded: true });
      }
    } catch {
      set({ preferences: defaultAccessibilityPreferences, isLoaded: true });
    }
  },
  updatePreferences: async (userId: string, prefs: Partial<AccessibilityPreferences>) => {
    const updated = { ...get().preferences, ...prefs };
    set({ preferences: updated });
    await persistPreferences(userId, updated);
  },
  setLocalPreferences: (prefs: Partial<AccessibilityPreferences>) => {
    set({ preferences: { ...get().preferences, ...prefs } });
  },
}));
