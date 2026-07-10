import { createError } from "../middleware/error.middleware";

export interface SuspensionFields {
  isSuspended: boolean;
  suspendedUntil: Date | null;
  suspensionReason: string | null;
}

/**
 * A suspension with a past `suspendedUntil` has lapsed — treat as not
 * suspended without requiring a background job to clear the flag.
 */
export function isCurrentlySuspended(user: SuspensionFields): boolean {
  if (!user.isSuspended) return false;
  if (user.suspendedUntil === null) return true; // permanent
  return user.suspendedUntil.getTime() > Date.now();
}

/**
 * Throws a structured 403 error (with machine-readable ban info) if the user
 * is currently suspended. Callers pass the freshly-read suspension fields.
 */
export function assertNotSuspended(user: SuspensionFields): void {
  if (!isCurrentlySuspended(user)) return;

  throw createError(
    user.suspendedUntil === null
      ? "Your account has been permanently suspended."
      : "Your account has been temporarily suspended.",
    403,
    {
      banned: true,
      permanent: user.suspendedUntil === null,
      suspendedUntil: user.suspendedUntil ? user.suspendedUntil.toISOString() : null,
      reason: user.suspensionReason,
    }
  );
}
