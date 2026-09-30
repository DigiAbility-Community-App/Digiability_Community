# Account Deletion and Retention Policy — Digiability Community

**Effective date:** [DATE]
**Last updated:** [DATE]
**Version:** 1.0

---

This document explains exactly what happens when you delete your Digiability Community account,
what we keep afterwards, and for how long. It supports the [Privacy Policy](./01-privacy-policy.md)
§8 and the [Terms of Use](./03-terms-of-use.md) §5 and §12.

## 1. How to delete your account

**In the app:** Profile → Privacy & Data → Delete account.

**On the web, without signing in to the app:** [ACCOUNT DELETION URL]. Use this if you have
already uninstalled the app or cannot sign in to it.

Both routes do exactly the same thing. There is no "email us to delete" step, and you do not
need to ask anyone's permission.

We ask you to re-enter your password to confirm. This is deliberate — deletion cannot be
undone, and an unlocked phone should not be enough to destroy someone's account.

## 2. Deletion is immediate and irreversible

There is no grace period and no recovery window. When you confirm, the following happens at once:

| What | What happens to it |
|---|---|
| Your name, email, phone number | Replaced with anonymised values |
| Every profile field — date of birth, gender, location, disability information, caregiver and care-recipient details, professional credentials, uploaded verification documents | Emptied |
| Your sessions and login tokens | Destroyed. You are signed out everywhere immediately |
| Your device push tokens | Deleted. No further notifications are sent |
| The text of your chat messages | Blanked. The messages remain as empty placeholders so conversations others took part in do not break |
| Your Care Circle and group memberships | Removed |
| Your forum bookmarks and votes | Deleted |
| Your forum questions and answers | **Kept**, attributed to "Deleted User" — see §3 |
| Text captured by automated moderation flags about you | Scrubbed, while the flag record itself is kept for audit integrity |

Your account cannot be signed into after this point, and cannot be restored.

## 3. What we keep, and why

### 3.1 Your forum posts remain, anonymised

Questions and answers you posted stay on the platform, attributed to "Deleted User". Discussions
here are often long threads where several people contributed, and removing one person's posts
would break the thread for everyone else who took part. Your name and profile are no longer
attached to them.

If a specific post needs to come down as well, contact the Grievance Officer.

### 3.2 A sealed registration record, for 180 days

Indian intermediary rules require us to retain user registration records for **180 days after
cancellation of registration**. We therefore copy a minimal record — your user id, email address,
phone number, and the dates you registered and cancelled — into a separate store before
anonymising your account.

That record:

- is **not** part of the live service and cannot be used to sign in or restore anything;
- is not exposed through any user-facing feature or API;
- is reachable only through an internal lookup that itself writes an audit entry;
- is **deleted automatically 180 days after cancellation**.

### 3.3 Safety and moderation records

Reports, moderation decisions, and administrative audit entries are kept on the schedule in §4.
They are what allows us to investigate a pattern of behaviour, honour an appeal, and answer a
regulator. Personal content within them is scrubbed as described in §2.

### 3.4 Content removed for breaking the rules

When we remove content for breaching these rules or the law, Indian intermediary rules
require us to keep that content and the associated records for **180 days**, so it can be
investigated if needed.

We therefore take a copy of the content at the moment it is removed, together with who
removed it, why, and which report prompted it. That copy:

- is separate from the live service, and the content stays removed from the platform;
- is reachable only by administrators, and each viewing is itself recorded (see the
  Privacy Policy §10);
- is **deleted automatically 180 days after removal**.

This applies to content we removed. It is not a copy of anything you deleted yourself.

### 3.5 Legal holds and child safety

Where content or account records are the subject of a law-enforcement request, a legal
obligation, or a child safety investigation, we preserve them for as long as required. A
preservation obligation overrides the ordinary deletion described above. See the
[Child Safety Standards](./04-child-safety-standards.md) §4.

### 3.6 What is outside our control

- **Copies other people already have** — anything another member saved, screenshotted, or
  forwarded before you deleted.
- **Messages you sent to other people** exist in their conversations. The text is blanked as
  described in §2, but the fact that a message was sent remains.
- **Backups** retain data until they expire on their normal cycle.
  [LEGAL PLACEHOLDER — state the backup retention period once the production backup schedule is
  confirmed. This is blocked on the same infrastructure question as Privacy Policy §9.]

## 4. Retention schedule

| Data | Retained for | Enforced by |
|---|---|---|
| Account and profile data | Until you delete your account | — |
| Registration record after cancellation | 180 days | Automated daily retention job |
| Content removed for breaking the rules | 180 days | Automated daily retention job |
| Administrative audit logs | 2 years | Automated daily retention job |
| Reports and moderation records | 2 years | Automated daily retention job |
| Automated moderation flags (dismissed) | 1 year | Automated daily retention job |
| Revoked session tokens | 35 days | Automated daily retention job |
| Email verification and password reset codes | 1 day after expiry | Automated daily retention job |

These periods are enforced by a scheduled job, not by anyone remembering to run one. They are
configured in one place so this table and the system cannot drift apart.

[LEGAL PLACEHOLDER — confirm these periods satisfy DPDP Act §8(7) and any sectoral rules.]

## 5. Exporting your data first

You can download everything we hold about you before deleting: Settings → Privacy & Data →
Export my data. We recommend doing this first, because deletion cannot be reversed.

## 6. Deleting individual content without deleting your account

You can delete your own forum questions, answers, and messages individually from the app,
without closing your account.

## 7. Questions

**Grievance Officer:** [GRIEVANCE OFFICER NAME]
**Email:** [GRIEVANCE EMAIL]
**Address:** [REGISTERED POSTAL ADDRESS]

Acknowledged within 24 hours, resolved within 15 days.

---

*Digiability Community — Account Deletion and Retention Policy v1.0 — [DATE]*
