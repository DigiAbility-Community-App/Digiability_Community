// ─────────────────────────────────────────────────────────────
// The identity that owns admin-authored forum content.
//
// Admin replies were previously posted as the chat bot account
// (00000000-…-0001, "Digiability Bot"), so an official reply appeared in the
// mobile app under the bot's name. They now have their own user, seeded by
// services/user-svc/prisma/seed-admin-user.ts — keep these values in sync
// with that script.
// ─────────────────────────────────────────────────────────────

export const ADMIN_REPLY_USER_ID = "00000000-0000-0000-0000-000000000002";
export const ADMIN_REPLY_EMAIL = "admin@digiability.com";
