// ─────────────────────────────────────────────────────────────
// ID Generation Utilities
// Uses UUID v4 for message IDs: required by Cassandra's UUID
// column type. ULIDs are incompatible with Cassandra's Uuid.fromString().
// ─────────────────────────────────────────────────────────────

import { randomUUID } from "crypto";

/** Generate a UUID v4 — used for messageId (Cassandra-compatible). */
export function generateMessageId(): string {
  return randomUUID();
}

/** Generate a UUID v4 — used for connection IDs, general-purpose. */
export function generateConnId(): string {
  return randomUUID();
}

/** Generate a UUID v4 — used for request IDs. */
export function generateRequestId(): string {
  return randomUUID();
}
