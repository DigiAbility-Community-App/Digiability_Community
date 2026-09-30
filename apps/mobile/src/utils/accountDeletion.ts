import { Alert } from 'react-native';

interface ConfirmDeleteAccountOptions {
  /** Called once the user has passed both warnings — open the password modal. */
  onConfirmed: () => void;
}

/**
 * Two-step destructive confirm for account deletion, shared by every screen
 * that offers it.
 *
 * This no longer performs the deletion itself. The server requires the user's
 * password for this irreversible action, and Alert.prompt is iOS-only, so the
 * final step is a DeleteAccountModal the caller renders.
 *
 * Deletion anonymises the account immediately rather than dropping the row, and
 * a minimal registration record is retained for 180 days as Indian intermediary
 * rules require — the copy below says so rather than promising a full wipe.
 */
export function confirmDeleteAccount({ onConfirmed }: ConfirmDeleteAccountOptions): void {
  Alert.alert(
    'Delete Account',
    'This deactivates your account immediately and erases your profile, preferences, messages, and personal details. Your forum posts remain but are shown as written by "Deleted User", so conversations others took part in stay readable.',
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Continue',
        style: 'destructive',
        onPress: () =>
          Alert.alert(
            'Are you absolutely sure?',
            'This cannot be undone. A minimal registration record is kept for 180 days because Indian law requires it, and is then destroyed.',
            [
              { text: 'No, keep my account', style: 'cancel' },
              {
                text: 'Yes, continue',
                style: 'destructive',
                onPress: onConfirmed,
              },
            ],
          ),
      },
    ],
  );
}
