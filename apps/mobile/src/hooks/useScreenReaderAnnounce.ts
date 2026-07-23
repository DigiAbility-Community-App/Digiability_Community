import { useCallback } from 'react';
import { AccessibilityInfo } from 'react-native';
import { useAccessibilityStore } from '../store/accessibilityStore';

/**
 * Returns an `announce(message)` function that speaks via the OS screen
 * reader (VoiceOver/TalkBack) only when the user's `screenReader`
 * accessibility preference is on — a no-op otherwise.
 */
export function useScreenReaderAnnounce() {
  const screenReaderEnabled = useAccessibilityStore((s) => s.preferences.screenReader);

  return useCallback(
    (message: string) => {
      if (screenReaderEnabled) {
        AccessibilityInfo.announceForAccessibility(message);
      }
    },
    [screenReaderEnabled]
  );
}
