#!/usr/bin/env node
/**
 * breach-scope — build the list of people to notify after a data breach.
 *
 * DPDP Act 2023 requires the affected individuals be told, and the Data
 * Protection Board notified, without undue delay. CERT-In directions require
 * reporting certain incidents within 6 hours. Neither clock is meetable if
 * working out *who* was affected takes a day of ad-hoc SQL.
 *
 * ── What this deliberately does NOT do ──────────────────────────────────────
 * It does not dump each affected person's full personal data. A tool that
 * writes everyone's profile, messages and consents to a file on someone's
 * laptop is itself a second breach, and none of that is needed to send a
 * notification. It emits contact details plus a summary of WHICH CLASSES of
 * data each person holds — enough to write an accurate notice saying what was
 * exposed. For one individual's complete record, use the existing
 * per-user export (GET /api/auth/privacy/export).
 *
 * ── Usage ───────────────────────────────────────────────────────────────────
 *   node scripts/breach-scope.js --all
 *   node scripts/breach-scope.js --ids <file with one user id per line>
 *   node scripts/breach-scope.js --registered-between 2026-01-01 2026-06-30
 *   node scripts/breach-scope.js --conversation <conversationId>
 *   node scripts/breach-scope.js --all --out /secure/path/scope.json
 *
 * Reads DATABASE_URL from services/user-svc/.env unless already in the
 * environment. Output defaults to stdout so it need not touch disk at all.
 */

const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

const ROOT = path.join(__dirname, "..");

function loadDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const envFile = path.join(ROOT, "services/user-svc/.env");
  if (fs.existsSync(envFile)) {
    const m = fs.readFileSync(envFile, "utf8").match(/^DATABASE_URL=(.*)$/m);
    if (m) return m[1].trim().replace(/^["']|["']$/g, "");
  }
  return null;
}

function parseArgs(argv) {
  const args = { mode: null, out: null, params: [] };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--all") args.mode = "all";
    else if (a === "--ids") { args.mode = "ids"; args.params = [argv[++i]]; }
    else if (a === "--registered-between") { args.mode = "registered"; args.params = [argv[++i], argv[++i]]; }
    else if (a === "--conversation") { args.mode = "conversation"; args.params = [argv[++i]]; }
    else if (a === "--out") args.out = argv[++i];
  }
  return args;
}

function usage() {
  console.error(`
breach-scope — who do we have to notify?

  --all                            every account
  --ids <file>                     user ids, one per line
  --registered-between <from> <to> accounts created in a date range (YYYY-MM-DD)
  --conversation <id>              everyone who was a member of one conversation
  --out <file>                     write JSON here (default: stdout)

Emits contact details and which classes of data each person holds — not their
data itself. See the header of this file for why.
`);
}

async function main() {
  const args = parseArgs(process.argv);
  if (!args.mode) {
    usage();
    process.exit(1);
  }

  const connectionString = loadDatabaseUrl();
  if (!connectionString) {
    console.error("breach-scope — DATABASE_URL not set and not found in services/user-svc/.env");
    process.exit(1);
  }

  const client = new Client({ connectionString });
  await client.connect();

  try {
    // Resolve the cohort to a set of user ids first, then describe them with
    // one query — so adding a new selector never changes the reporting shape.
    let cohortSql;
    let cohortParams = [];

    switch (args.mode) {
      case "all":
        cohortSql = `SELECT id FROM users WHERE "deletedAt" IS NULL`;
        break;
      case "ids": {
        const file = args.params[0];
        if (!file || !fs.existsSync(file)) {
          console.error(`breach-scope — id file not found: ${file}`);
          process.exit(1);
        }
        const ids = fs.readFileSync(file, "utf8").split("\n").map((l) => l.trim()).filter(Boolean);
        cohortSql = `SELECT id FROM users WHERE id = ANY($1::text[])`;
        cohortParams = [ids];
        break;
      }
      case "registered":
        cohortSql = `SELECT id FROM users WHERE "createdAt" >= $1::date AND "createdAt" < ($2::date + INTERVAL '1 day')`;
        cohortParams = args.params;
        break;
      case "conversation":
        // Cross-schema: conversation membership lives in chat-svc's schema.
        cohortSql = `SELECT DISTINCT "userId" AS id FROM chat.conversation_members WHERE "conversationId" = $1`;
        cohortParams = args.params;
        break;
    }

    const result = await client.query(
      `
      WITH cohort AS (${cohortSql})
      SELECT
        u.id,
        u.name,
        u.email,
        u."phoneNo",
        u."isEmailVerified",
        u."createdAt",
        u."deletedAt",
        -- Which classes of personal data this person holds. Booleans, not the
        -- data, so a notice can say accurately what was exposed.
        (p."userId" IS NOT NULL)                                   AS "hasProfile",
        (p."disabilityType" IS NOT NULL OR p."careDisabilityType" IS NOT NULL) AS "hasHealthData",
        (u."dateOfBirth" IS NOT NULL OR p.dob IS NOT NULL)         AS "hasDateOfBirth",
        (p."verificationDoc" IS NOT NULL)                          AS "hasVerificationDoc",
        COALESCE(dt.cnt, 0)                                        AS "deviceTokens",
        COALESCE(cm.cnt, 0)                                        AS "conversations",
        COALESCE(msg.cnt, 0)                                       AS "messagesSent",
        COALESCE(fq.cnt, 0)                                        AS "forumPosts"
      FROM cohort c
      JOIN users u              ON u.id = c.id
      LEFT JOIN user_profiles p ON p."userId" = u.id
      LEFT JOIN (SELECT "userId", COUNT(*) cnt FROM device_tokens GROUP BY 1) dt  ON dt."userId" = u.id
      LEFT JOIN (SELECT "userId", COUNT(*) cnt FROM chat.conversation_members WHERE "leftAt" IS NULL GROUP BY 1) cm ON cm."userId" = u.id
      LEFT JOIN (SELECT "senderId", COUNT(*) cnt FROM chat.messages GROUP BY 1) msg ON msg."senderId" = u.id
      LEFT JOIN (SELECT "authorId", COUNT(*) cnt FROM forum_questions WHERE "deletedAt" IS NULL GROUP BY 1) fq ON fq."authorId" = u.id
      ORDER BY u."createdAt"
      `,
      cohortParams
    );

    const affected = result.rows;
    const notifiable = affected.filter((r) => !r.deletedAt && r.email);

    const report = {
      generatedAt: new Date().toISOString(),
      selector: { mode: args.mode, params: args.params },
      counts: {
        affected: affected.length,
        // Deleted accounts are anonymised, so there is no address to write to.
        notifiable: notifiable.length,
        withHealthData: affected.filter((r) => r.hasHealthData).length,
        withVerificationDocs: affected.filter((r) => r.hasVerificationDoc).length,
        withMessages: affected.filter((r) => Number(r.messagesSent) > 0).length,
      },
      // The notification list. Contact details only, plus data-class flags.
      people: affected.map((r) => ({
        userId: r.id,
        name: r.name,
        email: r.email,
        phone: r.phoneNo,
        accountDeleted: Boolean(r.deletedAt),
        dataHeld: {
          profile: r.hasProfile,
          healthOrDisability: r.hasHealthData,
          dateOfBirth: r.hasDateOfBirth,
          verificationDocument: r.hasVerificationDoc,
          deviceTokens: Number(r.deviceTokens),
          conversations: Number(r.conversations),
          messagesSent: Number(r.messagesSent),
          forumPosts: Number(r.forumPosts),
        },
      })),
    };

    const json = JSON.stringify(report, null, 2);
    if (args.out) {
      fs.writeFileSync(args.out, json, { mode: 0o600 });
      console.error(
        `breach-scope — ${affected.length} affected, ${notifiable.length} notifiable. Written to ${args.out} (mode 600).`
      );
      console.error("This file contains personal data. Store it securely and delete it when done.");
    } else {
      process.stdout.write(json + "\n");
    }
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("breach-scope failed:", err.message);
  process.exit(1);
});
