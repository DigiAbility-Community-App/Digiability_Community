# Privacy Policy — Digiability Community

**Effective date:** [DATE]
**Last updated:** [DATE]
**Version:** 1.0

---

This policy explains what personal data Digiability Community collects, why, how long we
keep it, and what you can do about it. It is written to meet our obligations as a Data
Fiduciary under India's Digital Personal Data Protection Act, 2023 (the "DPDP Act").

It sits alongside our [Terms of Use](./03-terms-of-use.md) and
[Community Guidelines](./02-community-guidelines.md).

## 1. Who we are

[LEGAL ENTITY NAME], [REGISTERED POSTAL ADDRESS], CIN [COMPANY IDENTIFICATION NUMBER], is the
Data Fiduciary responsible for your personal data under DPDP Act §8(2)(a).

## 2. Data we collect

**Account data** — name, email address, phone number (optional), date of birth, and the roles
you select. We ask for your date of birth at registration because Digiability is an 18+
platform; see Section 6.

**Profile data** — gender, city, state, disability type and history, support needs, caregiver
and care-recipient details, and professional credentials for therapists and NGOs. Most of this
is optional; you choose what to share.

**Communication data** — chat messages, forum questions, answers, and votes.

**Device data** — your Expo push notification token and device platform, so we can send you
notifications. You can turn these off.

**Usage data** — last-seen timestamp and session information.

**Safety and compliance data** — reports you file or that are filed about you, moderation
decisions, guardian-consent confirmations you make for Care Circle members, grievance tickets,
and consent records (including a truncated IP address, see Section 4).

We do not run advertising, and we do not sell your data to anyone.

## 3. Why we collect it

- Creating and managing your account, and confirming you are eligible to hold one
- Delivering chat, forum, Care Circle, and community features
- Sending push notifications about activity relevant to you
- Content moderation, to keep the platform safe
- Verifying professional credentials for therapists and NGOs
- Handling reports, appeals, and grievances
- Meeting legal obligations, including retention duties under Indian intermediary rules

## 4. Legal basis for processing

**Consent (DPDP §6).** We record your explicit consent at registration for data processing,
and separately for our Terms of Use and Community Guidelines. Optional consents — push
notifications and marketing — can be withdrawn at any time from Settings → Privacy & Data.

Each consent record stores who consented, which consent it was, the version of the notice you
accepted, and when. It also stores your IP address **truncated** — the last block of an IPv4
address is discarded, so it identifies a network rather than a device.

**Legitimate uses (DPDP §7).** We rely on §7 for compliance with law and for responding to
credible threats to someone's life or safety.

## 5. Third-party services

These services may receive your data. A full inventory is maintained internally and reviewed
annually.

| Service | What it receives | Why |
|---|---|---|
| Expo Push Notifications (delivering via Apple APNs on iOS, Google FCM on Android) | Device push token; notification previews may include short message excerpts | To notify you of activity |
| OpenAI Moderation API | Submitted text. No personal identifier is included in the request | Automated screening for harmful content |
| Google Cloud Vision API | Images you upload | Automated screening for inappropriate imagery |
| [EMAIL PROVIDER NAME] | Your email address and message content | Verification codes, password resets, service notices |
| [HOSTING PROVIDER NAME] | All stored data | Running the service |

[LEGAL PLACEHOLDER — confirm a Data Processing Agreement is in place with each provider above.]

## 6. Children's data

**Digiability is an 18+ platform.** DPDP Act §9 requires verifiable parental consent before
processing a child's personal data and prohibits behavioural tracking of children. Rather than
build that, we do not permit under-18 accounts at all.

We ask for your date of birth at registration and refuse to create an account for anyone under
18. If we find an account belongs to someone under 18, we terminate it. The full mechanism is
described in the [Age Policy and Gate Spec](./06-age-policy-and-gate-spec.md).

**Care Circles.** You may include a person under 18 in your Care Circle under your own account
and supervision. When you do, you confirm that you are their parent or lawful guardian, or that
you have that guardian's permission, and we record that confirmation — who confirmed it, for
whom, on what date, and against which version of this policy. The same applies when you add an
adult who has a lawful guardian. We keep that record for as long as the Care Circle membership
lasts, plus the retention period in Section 8.

**We rely on that confirmation and do not currently verify it independently.** Our
[Age Policy](./06-age-policy-and-gate-spec.md) §1.7 sets out this limitation and the
verification options under consideration.

We do not use children's data for behavioural tracking or advertising in any circumstances.

## 7. Your rights (DPDP Act §11–§14)

| Right | How to use it |
|---|---|
| **Access** | Download everything we hold about you: Settings → Privacy & Data → Export my data |
| **Correction** | Update your profile at any time from Settings |
| **Erasure** | Settings → Privacy & Data → Delete account, or at [ACCOUNT DELETION URL] if you have uninstalled the app. See Section 8 |
| **Withdraw consent** | Settings → Privacy & Data. Withdrawing data-processing consent means deleting your account, since we cannot run the service without it |
| **Grievance redressal** | Contact our Grievance Officer, Section 11 |
| **Nominate** | DPDP §14 lets you nominate someone to exercise your rights if you die or become incapacitated. [LEGAL PLACEHOLDER — describe the nomination mechanism, or state plainly that it is not yet available and how to make such a request by email in the meantime.] |

## 8. Data retention

When you delete your account, we immediately anonymise your account and profile: your name,
email, and phone number are replaced, every profile field is emptied, your sessions and device
tokens are destroyed, and the text of your chat messages is blanked. Your forum posts remain but
are attributed to "Deleted User", so discussions others took part in stay readable.

**One exception.** Indian intermediary rules require us to keep user registration records for
**180 days after cancellation of registration**. We therefore keep a sealed record — your user
id, email, phone number, and the dates you registered and cancelled — separate from the live
service, reachable only through an internal, audited lookup. It is deleted automatically 180
days after cancellation.

Other retention periods:

| Data | Kept for |
|---|---|
| Account and profile data | Until you delete your account |
| Registration record after cancellation | 180 days |
| Admin audit logs | 2 years |
| Reports and moderation records | 2 years |
| Automated moderation flags | 1 year |
| Revoked session tokens | 35 days |
| Verification and password-reset codes | 1 day after they expire |

[LEGAL PLACEHOLDER — confirm these periods satisfy DPDP Act §8(7) and any sectoral rules.]

## 9. Cross-border data transfers

[LEGAL PLACEHOLDER — BLOCKED: DPDP Act §16 restricts transfer of personal data to countries
outside those the Government permits. This section cannot be completed until the hosting region
of the production database is confirmed and each vendor's data-centre location is documented.
Do not publish this policy with this section unresolved.]

## 10. How we protect your data, and when we look at it

Data is encrypted in transit. Access to production data is restricted to administrators.

**Your messages are not end-to-end encrypted.** We are technically able to read message
content, and we do so only to investigate a report, to comply with a legal obligation, or to
respond to a credible risk to someone's safety. Every such access is recorded — which
administrator, which conversation, and when — and those records are retained as audit logs.

The same applies to content we have removed for breaking our rules, which Indian
intermediary rules require us to keep for 180 days (see the
[Account Deletion and Retention policy](./05-account-deletion-and-retention.md) §3.4).
Viewing a preserved copy is recorded in the same way.

## 11. Grievance Officer

Under DPDP Act §13(5) and the Information Technology (Intermediary Guidelines and Digital Media
Ethics Code) Rules, 2021, we publish a named officer to receive complaints about how we handle
your personal data.

**Grievance Officer:** [GRIEVANCE OFFICER NAME]
**Email:** [GRIEVANCE EMAIL]
**Address:** [REGISTERED POSTAL ADDRESS]

We acknowledge complaints **within 24 hours** and resolve them **within 15 days** of receipt,
and we give you a ticket reference. If you are unsatisfied, you may complain to the Data
Protection Board of India, or appeal to the Grievance Appellate Committee at
[gac.gov.in](https://gac.gov.in).

## 12. Changes to this policy

We may update this policy. For material changes we will notify you in the app or by email
before they take effect, and where the change is significant we will ask you to accept the
updated version before continuing to use the service.

## 13. Contact

[LEGAL ENTITY NAME]
[REGISTERED POSTAL ADDRESS]
Privacy enquiries: [PRIVACY EMAIL]
Grievance Officer: [GRIEVANCE OFFICER NAME], [GRIEVANCE EMAIL]

---

*Digiability Community — Privacy Policy v1.0 — [DATE]*
