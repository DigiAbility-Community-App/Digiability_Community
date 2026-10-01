# Age Policy and Gate Spec — Digiability Community

**Effective date:** [DATE]
**Last updated:** [DATE]
**Version:** 1.0

---

This document is both the published policy and the internal specification for how it is
enforced. It is referenced by the [Terms of Use](./03-terms-of-use.md) §2, the
[Privacy Policy](./01-privacy-policy.md) §6, and the
[Child Safety Standards](./04-child-safety-standards.md).

## Part 1 — Policy

### 1.1 Minimum age

**You must be 18 or older to hold a Digiability Community account.** There is no lower tier and
no supervised account type.

### 1.2 Why

DPDP Act §9 requires verifiable parental consent before a Data Fiduciary may process the
personal data of anyone under 18, and prohibits behavioural tracking and targeted advertising
directed at children. Building verifiable parental consent for account holders is a substantial
undertaking. We have chosen instead not to serve under-18 account holders at all.

### 1.3 Under-18 people in Care Circles

A person under 18 may be included in a Care Circle under the account and supervision of their
parent or lawful guardian. They do not hold their own account, do not log in, and cannot post.

The guardian confirms, at the point of adding them, that they are the parent or lawful guardian
or have that guardian's permission. That confirmation is recorded — who confirmed, for whom, the
stated relationship, which Care Circle, the policy version, and when. The same confirmation is
required when adding an adult who has a lawful guardian.

### 1.4 What happens to under-18 accounts

Accounts we find belong to a person under 18 are terminated. Where we can, we tell the person
why and give them a way to correct the record if we have it wrong — a mistyped date of birth
should not cost someone their account without recourse.

### 1.5 What we do not do

- We do not ask for identity documents or perform documentary age verification.
- We do not use biometric or inferential age estimation.
- We do not carry out behavioural tracking or targeted advertising for any user, of any age.

### 1.6 Honest limitation — age

Date of birth at registration is **self-declared**. It is an age gate, not age verification. It
establishes our stated minimum age, records the user's own declaration, and gives us a basis to
act — it does not prove age. We consider this proportionate for a free peer-support service that
runs no advertising and does no profiling. It is stated plainly here rather than implied to be
stronger than it is.

### 1.7 Honest limitation — guardian confirmation

The guardian confirmation described in §1.3 is likewise **self-attested**. We record who
confirmed the relationship, for whom, on what date, and against which policy version — but
nothing currently verifies that the person confirming is an identifiable adult, or that they
hold the guardianship they claim.

**On its own this does not meet the verifiable-consent standard in DPDP Act §9.** Meeting it
requires one of: requiring the guardian to hold their own age-verified account on the platform;
a one-time code sent to the guardian and confirmed by them; or identity verification through
DigiLocker. Which of those we adopt is an open decision.

Until one is implemented, this document, Privacy Policy §6 and Terms §2 must describe what we
actually do — record a confirmation — and must not claim we have verified it.

---

## Part 2 — Gate specification

This half is the implementation contract. Keep it in step with the code.

### 2.1 Where the gate lives

**The server is the gate.** Date of birth is a required field on the registration schema in
`services/user-svc`, validated before an account row is created. Client-side validation exists
for the sake of a decent error message, and is not relied upon — a request that bypasses the app
entirely is rejected by the same rule.

### 2.2 The rule

- `dateOfBirth` is required at registration. A registration without it fails validation.
- Age is computed server-side at the moment of registration, from the declared date of birth to
  the current date, in Asia/Kolkata.
- Age **≥ 18** passes. Anything less is refused, with a message that says why.
- A date of birth in the future, or implying an age beyond a plausible maximum, is refused as
  invalid rather than treated as passing.

### 2.3 Where date of birth is stored

On the user record, not the profile. It is an eligibility fact checked at registration, not an
optional profile detail — storing it on the profile is what allowed it to be skipped before.

It is treated as personal data under the Privacy Policy: exported on request, anonymised on
account deletion, and never used for anything other than the eligibility check.

### 2.4 Existing accounts

Accounts created before this gate may have no recorded date of birth, because it was previously
an optional profile field.

Those accounts are asked for it at the next app launch, through the same interception point that
handles re-acceptance of an updated policy version. The prompt blocks further use until answered,
so the population converges rather than drifting indefinitely.

A declared age under 18 from that backfill routes the account to the moderation queue for
termination under §1.4 — it does not delete the account automatically. A human confirms, because
the most likely cause of a surprising date of birth is a typo.

### 2.5 What is recorded

- The declared date of birth, on the user record.
- An audit entry when an under-18 declaration is detected, whether at registration or backfill.
- For Care Circle guardian confirmations, a guardian-consent record as described in §1.3.

### 2.6 Review

This spec is reviewed whenever the registration flow changes, and at least annually. If the
platform ever admits under-18 account holders, this document is void and a verifiable parental
consent mechanism must be built and documented first.

---

*Digiability Community — Age Policy and Gate Spec v1.0 — [DATE]*
