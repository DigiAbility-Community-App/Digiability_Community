// ─────────────────────────────────────────────────────────────
// Shared group-role helpers.
//
// Single source of truth for which roles carry admin-level access, and how
// many admin-capable members a group may have. Previously duplicated
// verbatim across conversation.service.ts, invite.service.ts, and partial
// copies in the WS handlers — consolidated here so the max-admin cap and
// succession logic (see conversation.service.ts) don't need to reconcile
// multiple definitions.
// ─────────────────────────────────────────────────────────────

import { MemberRole, GroupSubType } from "../generated/client";

// Roles that have admin-level access in Care Circles
export const CARE_CIRCLE_ADMIN_ROLES: MemberRole[] = ["OWNER", "CAREGIVER"];
// Roles that have admin-level access in General Groups
export const GROUP_ADMIN_ROLES: MemberRole[] = ["OWNER", "ADMIN"];

// A group (General or Care Circle) may have at most this many admin-capable
// members (OWNER counts toward this) at once.
export const MAX_ADMINS_PER_GROUP = 3;

/**
 * Check if a role has admin-level permissions.
 * For Care Circles: OWNER and CAREGIVER have admin access.
 * For General Groups: OWNER and ADMIN have admin access.
 */
export function hasAdminAccess(role: MemberRole, subType?: GroupSubType | null): boolean {
  return adminRolesFor(subType).includes(role);
}

/** The set of admin-capable roles for a given group subType. */
export function adminRolesFor(subType?: GroupSubType | null): MemberRole[] {
  return subType === "CARE_CIRCLE" ? CARE_CIRCLE_ADMIN_ROLES : GROUP_ADMIN_ROLES;
}

/** The role auto-succession / manual promotion assigns — never OWNER. */
export function adminRoleToPromoteTo(subType?: GroupSubType | null): MemberRole {
  return subType === "CARE_CIRCLE" ? "CAREGIVER" : "ADMIN";
}
