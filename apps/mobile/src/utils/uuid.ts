// ─────────────────────────────────────────────────────────
// UUID v4 Generator
//
// Generates RFC 4122 compliant UUID v4 strings without
// needing an external dependency. Uses Math.random() which
// is sufficient for client-side message IDs (not crypto).
// ─────────────────────────────────────────────────────────

export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
