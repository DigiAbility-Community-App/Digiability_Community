import { Alert } from 'react-native';
import { deleteAccount } from '@services/authService';

interface ConfirmDeleteAccountOptions {
  onStart: () => void;
  onError: (message: string) => void;
}

/**
 * Two-step destructive confirm for account deletion, shared by every
 * screen that offers it. `deleteAccount()` doesn't hard-delete the row —
 * it anonymises it and sets a deletion flag — so the copy here describes
 * that, rather than promising the record is wiped from our systems.
 */
export function confirmDeleteAccount({ onStart, onError }: ConfirmDeleteAccountOptions): void {
  Alert.alert(
    'Delete Account',
    'This deactivates your account immediately and anonymises your profile, preferences, messages, and forum posts. Your account will no longer be usable or visible to others. Some records are retained in our systems, marked as deleted, as required by law — they are not shared or used after this point.',
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Continue',
        style: 'destructive',
        onPress: () =>
          Alert.alert(
            'Are you absolutely sure?',
            'This cannot be undone from within the app. Your name, email, and profile details will be replaced with anonymised placeholders right away.',
            [
              { text: 'No, keep my account', style: 'cancel' },
              {
                text: 'Yes, delete my account',
                style: 'destructive',
                onPress: async () => {
                  onStart();
                  try {
                    await deleteAccount();
                  } catch {
                    onError('Could not delete account. Please try again.');
                  }
                },
              },
            ],
          ),
      },
    ],
  );
}
