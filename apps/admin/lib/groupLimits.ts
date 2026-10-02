// ─────────────────────────────────────────────────────────────
// Member-limit (`chat.conversations."maxMembers"`) bounds for admin-created
// and admin-edited groups. chat-svc enforces the limit on every add / invite /
// join as `activeMemberCount >= maxMembers`, so these bounds are the only
// place the value itself is checked.
// ─────────────────────────────────────────────────────────────

export const MIN_GROUP_MEMBERS = 2;
export const MAX_GENERAL_GROUP_MEMBERS = 500;
export const MAX_CARE_CIRCLE_MEMBERS = 15;

export function defaultMaxMembers(subType: string | null | undefined): number {
  return subType === "CARE_CIRCLE" ? MAX_CARE_CIRCLE_MEMBERS : 256;
}

export function maxAllowedMembers(subType: string | null | undefined): number {
  return subType === "CARE_CIRCLE" ? MAX_CARE_CIRCLE_MEMBERS : MAX_GENERAL_GROUP_MEMBERS;
}

/** Validates a requested member limit for a group of the given subType. */
export function validateMaxMembers(
  value: unknown,
  subType: string | null | undefined
): { ok: true; value: number } | { ok: false; message: string } {
  const n = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  const max = maxAllowedMembers(subType);
  if (typeof n !== "number" || !Number.isInteger(n)) {
    return { ok: false, message: "Member limit must be a whole number." };
  }
  if (n < MIN_GROUP_MEMBERS || n > max) {
    const kind = subType === "CARE_CIRCLE" ? "A Care Circle" : "A group";
    return { ok: false, message: `${kind}'s member limit must be between ${MIN_GROUP_MEMBERS} and ${max}.` };
  }
  return { ok: true, value: n };
}
