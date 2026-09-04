// ─────────────────────────────────────────────────────────────
// Formats a participant/sender display name, flagging soft-deleted
// accounts explicitly instead of showing a bare "Deleted User" that's
// indistinguishable from a real user who happens to have that name.
// ─────────────────────────────────────────────────────────────

export function formatUserDisplayName(user?: { name: string; deletedAt?: string | null } | null): string {
  if (!user) return "Unknown";
  if (user.deletedAt) return "Deleted User (this user no longer exists)";
  return user.name;
}
