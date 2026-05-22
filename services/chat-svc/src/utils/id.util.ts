// ─────────────────────────────────────────────────────────────
// ID Generation Utilities
// Uses ULID for message IDs: globally unique, lexicographically
// sortable by creation time, and URL-safe.
// ─────────────────────────────────────────────────────────────

import { ulid } from "ulid";
import { randomUUID } from "crypto";

/** Generate a ULID — sortable, unique, URL-safe. Used for messageId. */
export function generateMessageId(): string {
  return ulid();
}

/** Generate a UUID v4 — used for connection IDs, general-purpose. */
export function generateConnId(): string {
  return randomUUID();
}

/** Generate a UUID v4 — used for request IDs. */
export function generateRequestId(): string {
  return randomUUID();
}
