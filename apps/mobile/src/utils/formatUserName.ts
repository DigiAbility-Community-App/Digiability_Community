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
  /** Why that membership ended: "LEFT" (their own choice) or "REMOVED" (an
   *  admin removed them). Null on memberships that ended before chat-svc
   *  started recording the reason — those stay deliberately neutral rather
   *  than guessing and accusing someone of having been removed. */
  leftReason?: string | null;
}

export function formatUserDisplayName(user?: DisplayableUser | null): string {
  if (!user) return "Unknown";
  if (user.deletedAt) return "This user no longer exists";
  if (user.isSuspended) return `${user.name} (Inactive)`;
  if (user.leftAt) {
    // Everyone with a leftAt used to be labelled "(Removed)", so a member who
    // simply left a group was shown as though an admin had kicked them.
    if (user.leftReason === "LEFT") return `${user.name} (Left)`;
    if (user.leftReason === "REMOVED") return `${user.name} (Removed)`;
    return `${user.name} (Past member)`;
  }
  return user.name;
}
