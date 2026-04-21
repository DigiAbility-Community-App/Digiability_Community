import type { MainStackParamList } from './MainNavigator';

export type OnboardingRole = 'pwd' | 'caregiver' | 'therapist' | 'ngo';

export function isOnboardingRole(
  role: string | null | undefined
): role is OnboardingRole {
  return (
    role === 'pwd' ||
    role === 'caregiver' ||
    role === 'therapist' ||
    role === 'ngo'
  );
}

export function getProfileRouteForRole(
  role: OnboardingRole
): keyof MainStackParamList {
  switch (role) {
    case 'pwd':
      return 'PWDProfile';
    case 'caregiver':
      return 'CaregiverProfile';
    case 'therapist':
      return 'EducatorProfile';
    case 'ngo':
      return 'NGOProfile';
  }
}
