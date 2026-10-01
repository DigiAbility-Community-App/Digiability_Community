# Legal documents — what the client must fill in or approve

Nothing in `docs/legal/` can be published while `npm run lint:legal` fails; it lists every
bracketed placeholder with its line number. This page groups the ones added or changed in the
October 2026 privacy update so they can be answered in one pass. Run the lint for the full list.

## 1. Who you are (all documents)

- Legal entity name, registered postal address, CIN
- Privacy enquiries email
- Effective dates (the "DATE" placeholders). When counsel signs off, set
  `policyVersion` in `manifest.json` to the same date.

## 2. Grievance Officer (Privacy Policy §11, and repeated in documents 02, 04, 05)

A named person is required by the IT Rules 2021 — a role or shared inbox is not enough.

- Full name and designation
- Email, phone number, postal address
- Working days and hours

## 3. Where data is stored (Privacy Policy §5 and §9)

- **Hostinger data-centre location** (country and city) for the VPS that runs the app and
  database. This decides whether §9 needs cross-border wording for the main database.
- **S3-compatible object storage** — is one actually used for the Community app? The code
  today stores uploaded images on the Hostinger server and has no object-storage client; the
  only S3 usage found is the database-backup job of the separate NGO platform. If it is used:
  provider name, what is stored (backups? media?), and region. If not, delete that row.
- **Google Cloud Vision** region, and the **email provider** name and region.
- Confirm every location is permitted under DPDP Act §16.
- Confirm a Data Processing Agreement exists with each processor.

## 4. Retention (Privacy Policy §8, deletion policy §4)

- Backup retention period
- Server and security log retention period
- Confirm the existing periods (audit logs 2 years, moderation 2 years / 1 year, sessions and
  revoked tokens 35 days, registration record 180 days) satisfy DPDP §8(7).

## 5. Other open items already in the documents

- Public account-deletion URL (needed for app-store listings when the app is uninstalled)
- DPDP §14 nomination mechanism, or a plain statement that it is not yet available

## 6. Data-processing notice (`07-data-processing-notice.md`)

Shown in the app before an account is created, with its own consent checkbox. Only the legal
entity name is a placeholder. Review the list of data and purposes. **If you change it
materially, bump `consentNoticeVersion` in `manifest.json`** — every user is then asked to
consent again on their next launch.

## 7. Not changed on purpose

The Terms of Use (03) still refer to the menu as "Profile → Privacy & Data"; the menu item is
now called "My data & privacy". Editing the Terms changes text users have already accepted, so
fix this at the next Terms revision, together with a `policyVersion` bump.
