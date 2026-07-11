// [LEGAL PLACEHOLDER]
// This file contains the privacy policy for DigiAbility Community.
// The text below is a structural placeholder. Legal counsel must review
// and replace every [PLACEHOLDER] section before public launch.
// Required under DPDP Act 2023 §6 (consent notice) and §9 (disclosures).

export default function PrivacyPolicy() {
  return (
    <main style={{ maxWidth: 800, margin: "0 auto", padding: "2rem 1rem", fontFamily: "Inter, sans-serif", lineHeight: 1.7 }}>
      <h1>Privacy Policy</h1>
      <p><strong>Last updated:</strong> [LEGAL PLACEHOLDER — insert effective date]</p>

      <div style={{ background: "#fff3cd", border: "1px solid #ffc107", borderRadius: 6, padding: "1rem", marginBottom: "1.5rem" }}>
        <strong>⚠ Draft — Not for public distribution.</strong>
        <br />
        This document requires legal review before publication. All sections marked
        [LEGAL PLACEHOLDER] must be completed by qualified legal counsel.
      </div>

      <h2>1. Who we are</h2>
      <p>
        [LEGAL PLACEHOLDER — full legal entity name, registered address, CIN, and
        contact details of the Data Fiduciary as required under DPDP Act 2023 §8(2)(a)]
      </p>

      <h2>2. Data we collect</h2>
      <p>We collect the following categories of personal data when you use DigiAbility Community:</p>
      <ul>
        <li><strong>Account data:</strong> name, email address, phone number (optional), roles</li>
        <li><strong>Profile data:</strong> date of birth, gender, city, state, disability type and history, caregiver information (if applicable), professional credentials (for therapists and NGOs)</li>
        <li><strong>Communication data:</strong> chat messages, forum questions, answers, and votes</li>
        <li><strong>Device data:</strong> Expo push notification token, device platform</li>
        <li><strong>Usage data:</strong> last seen timestamp, session information</li>
      </ul>
      <p>
        [LEGAL PLACEHOLDER — confirm whether any data is collected passively (e.g., IP
        addresses, analytics) and disclose accordingly]
      </p>

      <h2>3. Why we collect your data (purposes)</h2>
      <ul>
        <li>Creating and managing your account</li>
        <li>Delivering chat, forum, and community features</li>
        <li>Sending push notifications for activity relevant to you</li>
        <li>Content moderation to keep the platform safe</li>
        <li>Verifying professional credentials for therapists and NGOs</li>
      </ul>

      <h2>4. Legal basis for processing</h2>
      <p>
        Under the Digital Personal Data Protection Act 2023 (DPDP Act), we process your
        personal data on the basis of:
      </p>
      <ul>
        <li><strong>Consent (§6):</strong> We record your explicit consent at registration. You may withdraw optional consents at any time from your account settings.</li>
        <li><strong>Legitimate uses (§7):</strong> [LEGAL PLACEHOLDER — identify any processing done under §7 exemptions, e.g., compliance with law]</li>
      </ul>

      <h2>5. Third-party services</h2>
      <p>
        We use the following third-party services that may receive your data. A full
        inventory is maintained internally and reviewed annually:
      </p>
      <ul>
        <li><strong>Expo Push Notifications:</strong> Delivers in-app notifications to your device. Notification previews may include short excerpts from messages.</li>
        <li><strong>OpenAI Moderation API:</strong> Submitted text may be analysed for harmful content. No personal identifier is included in the request.</li>
        <li><strong>Google Cloud Vision API:</strong> Images you upload may be analysed for inappropriate content.</li>
        <li><strong>SMTP email provider:</strong> [LEGAL PLACEHOLDER — name the actual email provider in production]</li>
      </ul>
      <p>[LEGAL PLACEHOLDER — confirm Data Processing Agreements are in place with each provider]</p>

      <h2>6. Children's data</h2>
      <p>
        [LEGAL PLACEHOLDER — DPDP Act 2023 §9 prohibits processing personal data of
        children under 18 without verifiable parental consent, and prohibits behavioural
        tracking of children. If the platform allows users under 18, a parental-consent
        flow and age-verification mechanism must be documented here and implemented
        before launch.]
      </p>

      <h2>7. Your rights (DPDP Act 2023 §11–§14)</h2>
      <ul>
        <li><strong>Right to access:</strong> Download all data we hold about you at <a href="/app/settings/privacy">Settings → Privacy → Export My Data</a>.</li>
        <li><strong>Right to correction:</strong> Update your profile at any time from Settings.</li>
        <li><strong>Right to erasure:</strong> Delete your account from Settings → Delete Account. All PII is anonymised immediately.</li>
        <li><strong>Right to withdraw consent:</strong> Manage your consent preferences at <a href="/app/settings/privacy">Settings → Privacy</a>.</li>
        <li><strong>Right to grievance redressal:</strong> Contact [LEGAL PLACEHOLDER — grievance officer name and email, required under DPDP §13(5)].</li>
      </ul>

      <h2>8. Data retention</h2>
      <p>
        We retain personal data for as long as needed to provide the service and as
        required by law. Key retention periods:
      </p>
      <ul>
        <li>Account data: until account deletion</li>
        <li>Admin audit logs: 2 years</li>
        <li>Moderation records: 1 year</li>
        <li>Security tokens (OTP, reset): 1 day after expiry</li>
      </ul>
      <p>[LEGAL PLACEHOLDER — confirm these periods satisfy DPDP Act §8(7) and any sectoral rules]</p>

      <h2>9. Cross-border data transfers</h2>
      <p>
        [LEGAL PLACEHOLDER — DPDP Act 2023 §16 restricts cross-border transfer to
        countries notified by the Government. Confirm where data is stored (database
        region) and whether any vendor data centres are outside India. If transfers occur,
        document the safeguards.]
      </p>

      <h2>10. Contact us</h2>
      <p>
        To exercise your rights or raise a privacy concern, contact:<br />
        [LEGAL PLACEHOLDER — email address / grievance officer details]
      </p>
    </main>
  );
}
