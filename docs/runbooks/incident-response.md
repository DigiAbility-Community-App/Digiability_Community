# Incident Response Runbook — Digiability Community

**Audience:** whoever is on point when something goes wrong.
**Status:** operational procedure, not a published legal document.
**Last updated:** [DATE]

---

## 0. Read this first — what this system can and cannot do

**There is no automated breach detection.** No error capture, no APM, no log
aggregation — Sentry is listed in `docs/privacy/third-party-sdks.md` as "not yet
used", and application logs go to container stdout with no rotation, retention,
or alerting on top of them.

In practice this means an incident is found by **a person noticing** — a user
report, a support email, a failing service, an unusual bill, or a third-party
disclosure. The alerting described in §3 fires only on the specific conditions
the code explicitly reports; it is a way to be *told* about things we already
detect, not a way to *detect* things.

That matters because the clocks below start when the incident occurs, not when
we notice. **Closing this gap — error capture with alerting — is the single
highest-value thing to add to this runbook.**

---

## 1. The clocks

| Obligation | Deadline | Who to |
|---|---|---|
| CERT-In incident report | **6 hours** of noticing | CERT-In (incident@cert-in.org.in) |
| DPDP breach notification — Board | Without delay | Data Protection Board of India |
| DPDP breach notification — affected people | Without delay | Every affected individual |
| Preserve logs and evidence | Immediately, before anything else | — |

`[LEGAL PLACEHOLDER — confirm the current CERT-In reporting channel and format,
and the Board's notification form, with counsel. These change.]`

**Start the clock at the moment of noticing and write that time down.** Every
later question ("was this reported in time?") is answered from it.

---

## 2. First 30 minutes

1. **Write down when you noticed, and how.** One line in the incident log.
2. **Do not fix anything yet if fixing destroys evidence.** Snapshot first:
   ```bash
   # Container logs, before they roll away
   docker logs digiability_user_svc  > incident-user-svc.log  2>&1
   docker logs digiability_chat_svc  > incident-chat-svc.log  2>&1
   docker logs digiability_forum_svc > incident-forum-svc.log 2>&1

   # Database snapshot
   docker exec digiability_postgres pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
     > incident-db-snapshot.sql
   ```
3. **Stop the bleeding** — revoke keys, take a service down, disable an account.
   Availability is worth less than containment.
4. **Tell the Grievance Officer and whoever owns the legal relationship.** They
   own the CERT-In and Board filings; you own the technical facts.

---

## 3. Alerting — what actually fires

`raiseAlert()` in `services/user-svc/src/services/alert.service.ts` sends to:

- `INCIDENT_WEBHOOK_URL` (Slack or similar) if set — the fast path;
- otherwise/also email, to `INCIDENT_ALERT_EMAIL`, falling back to the admin
  general-settings address;
- always stderr, so an alert is never lost entirely.

Honoured by the **"email me about system errors"** toggle in admin settings —
which did nothing at all until this was wired up.

**Conditions that currently raise an alert:**

| Condition | Severity | Why it matters |
|---|---|---|
| Daily retention pass failed | critical | Every published retention period stops being enforced |
| Account deletions not completing after 3+ attempts | critical | Users were told their data was erased and it was not |

Everything else is silent. Adding a condition is one `raiseAlert()` call.

---

## 4. Working out who was affected

The DPDP duty is to tell **the affected individuals**, which means producing a
list fast:

```bash
# Everyone
npm run breach:scope -- --all

# A specific set of accounts
npm run breach:scope -- --ids affected-ids.txt

# Everyone in one conversation
npm run breach:scope -- --conversation <conversationId>

# Accounts created in a window
npm run breach:scope -- --registered-between 2026-01-01 2026-06-30

# Write to a file (mode 600) instead of stdout
npm run breach:scope -- --all --out /secure/scope.json
```

It emits contact details plus **which classes of data** each person holds —
health/disability information, date of birth, verification documents, message
counts — so the notice can say accurately what was exposed.

It deliberately does **not** dump everyone's full personal data: a file like that
is a second breach. For one individual's complete record, use the existing
per-user export (`GET /api/auth/privacy/export`).

---

## 5. Notifying people

The notice must let someone understand what happened to *them*. Say plainly:

- what happened, and when;
- what data of theirs was involved (the `dataHeld` flags from §4);
- what we have done;
- what they should do — change a password, watch for phishing;
- who to contact: the Grievance Officer, with the reference for this incident.

Do not minimise, and do not promise an investigation outcome before there is one.
If the facts change, send a second notice rather than quietly revising the first.

`[PLACEHOLDER — draft notification templates for: credential exposure, message
content exposure, and profile/health data exposure. Have counsel review them
before an incident, not during one.]`

---

## 6. Access already recorded

Two trails exist and should be pulled early, because they answer "who saw what":

- **`message_access_logs`** — every time an admin was shown private message
  content, with the justification. Admin UI: `/moderation/message-access`.
- **`admin_audit_log`** — every moderation and administrative action, with the
  acting admin's email and IP.

Both are append-only; there is no endpoint to edit or delete either.

---

## 7. Afterwards

- Write what happened, in plain language, while it is fresh.
- Record the timings actually achieved against §1, honestly.
- Fix the cause, not just the symptom.
- If detection was manual — and today it will be — say so in the review, and
  weigh it against §0.

---

## 8. Contacts

| Role | Who | Contact |
|---|---|---|
| Grievance Officer | [GRIEVANCE OFFICER NAME] | [GRIEVANCE EMAIL] |
| Security contact | [SECURITY CONTACT NAME] | [SECURITY EMAIL] |
| Infrastructure / hosting | [INFRA OWNER] | [INFRA CONTACT] |
| Legal counsel | [COUNSEL NAME] | [COUNSEL CONTACT] |
| CERT-In | — | incident@cert-in.org.in |

---

*This runbook is reviewed after every incident, and at least annually.*
