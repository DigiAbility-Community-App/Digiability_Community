import type { MainStackParamList } from './MainNavigator';

export type OnboardingRole =
  | 'pwd'
  | 'caregiver'
  | 'therapist'
  | 'ngo'
  | 'volunteer'
  | 'student';

export function isOnboardingRole(
  role: string | null | undefined
): role is OnboardingRole {
  return (
    role === 'pwd' ||
    role === 'caregiver' ||
    role === 'therapist' ||
    role === 'ngo' ||
    role === 'volunteer' ||
    role === 'student'
  );
}

/**
 * All roles go to the same unified Profile screen.
 */
export function getProfileRouteForRole(
  _role: OnboardingRole
): keyof MainStackParamList {
  return 'Profile';
}
