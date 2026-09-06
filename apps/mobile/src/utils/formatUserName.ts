// ─────────────────────────────────────────────────────────────
// Single, consistent display-name formatter for any user shown in chat
// or forum UI — participants, message senders, forum authors.
//
// Deliberately does NOT try to recover a deleted user's real name: when
// an account is deleted, user-svc permanently overwrites `name` with the
// literal "Deleted User" as PII anonymization (see auth.service.ts
// deleteAccount()). That placeholder is not the person's real name, so we
// never display it — a deleted user is shown with no name at all.
//
// Suspended and former-member (left/removed from a group) accounts still
// exist and their real name is still held, so those cases keep the name
// and append a status suffix instead.
// ─────────────────────────────────────────────────────────────

export interface DisplayableUser {
  name: string;
  /** Set when the account has been soft-deleted (anonymized). */
  deletedAt?: string | null;
  /** Set when the account is currently suspended (account still exists). */
  isSuspended?: boolean | null;
  /** Set when this reflects a group membership the user has left or been
   *  removed from (account still exists, just no longer a member). */
  leftAt?: string | null;
}

export function formatUserDisplayName(user?: DisplayableUser | null): string {
  if (!user) return "Unknown";
  if (user.deletedAt) return "This user no longer exists";
  if (user.isSuspended) return `${user.name} (Inactive)`;
  if (user.leftAt) return `${user.name} (Removed)`;
  return user.name;
}
