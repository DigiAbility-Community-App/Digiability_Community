# Third-Party SDK / Service Inventory

**Purpose:** Feeds app-store Privacy Labels (Phase 5) and DPDP Act 2023 §9 third-party
disclosure obligations. Update this file whenever a new SDK or external service is added.

> **[LEGAL PLACEHOLDER]** — This inventory must be reviewed with legal counsel before
> submitting app-store privacy labels and before the first public launch. Data Processing
> Agreements (DPAs) are required for all processors that handle personal data of Indian
> residents under DPDP Act 2023 §8.

Last updated: 2024-01-01  
Reviewed by: *[Legal team to sign off]*

---

## 1. Expo Notifications (`expo-notifications`, `expo-server-sdk`)

| Attribute | Detail |
|---|---|
| **Used in** | `apps/mobile` (client), `services/notif-svc` (server) |
| **Purpose** | Deliver push notifications to iOS and Android devices |
| **Data sent to Expo** | Expo push token (opaque device identifier), notification title, body text, and metadata (`conversationId`, `questionId`, `type`) |
| **Data sent includes PII?** | Yes — notification body may contain the first ~100 chars of a chat message or forum answer |
| **Retained by Expo** | Expo passes messages to Apple APNs / Google FCM and does not store message content per their privacy policy |
| **Expo Privacy Policy** | https://expo.dev/privacy |
| **Data Processing Agreement** | [LEGAL PLACEHOLDER — obtain DPA from Expo before production launch] |
| **Minimisation notes** | Consider truncating `contentPreview` to ≤ 50 chars and stripping names from notification body for sensitive Care Circle conversations |

---

## 2. OpenAI Moderation API

| Attribute | Detail |
|---|---|
| **Used in** | `services/user-svc/src/moderation/providers/openai.provider.ts` |
| **Purpose** | Tier-C async AI classification of chat messages and forum posts for harmful content |
| **Data sent to OpenAI** | First 1500 chars of message/post text; no user identifier is sent in the request body |
| **Data sent includes PII?** | Potentially — user-generated text may contain PII, health details, or disability status |
| **Retained by OpenAI** | OpenAI Moderation API (free endpoint) — per OpenAI policy, data is not used to train models; retained per their data retention policy |
| **OpenAI Privacy Policy** | https://openai.com/policies/privacy-policy |
| **Data Processing Agreement** | [LEGAL PLACEHOLDER — OpenAI offers a DPA for API customers; obtain before production launch] |
| **Minimisation notes** | The `noop` provider can be configured via `MODERATION_PROVIDER=noop` to disable this entirely. Text is not stored with a user ID at the API call level, but `ModerationFlag.userId` links the flag back to the author in our DB. |
| **Current config** | Controlled via `OPENAI_API_KEY` env var; if absent, falls back to `noop` provider |

---

## 3. Google Cloud Vision API

| Attribute | Detail |
|---|---|
| **Used in** | `services/user-svc/src/moderation/providers/image-provider.ts` |
| **Purpose** | SafeSearch detection on user-uploaded images (adult / violence / medical content) |
| **Data sent to Google** | Image URL (publicly accessible storage URL) |
| **Data sent includes PII?** | Potentially — images may contain faces or identifiable information |
| **Retained by Google** | Google does not store images submitted to Vision API per their terms; request data may be retained for up to 30 days for abuse prevention |
| **Google Privacy Policy** | https://policies.google.com/privacy |
| **Data Processing Agreement** | [LEGAL PLACEHOLDER — Google Cloud offers a DPA via the Google Cloud Data Processing Addendum; sign before production launch] |
| **Minimisation notes** | Only image URLs are sent (not raw bytes); images must be stored in a short-lived pre-signed URL where possible |
| **Current config** | Controlled via `GOOGLE_VISION_API_KEY` env var; if absent, image moderation is skipped |

---

## 4. Nodemailer (SMTP)

| Attribute | Detail |
|---|---|
| **Used in** | `services/user-svc/src/services/email.service.ts` |
| **Purpose** | Transactional email: OTP verification, password reset links |
| **Data sent** | User email address, name, and OTP or password-reset URL |
| **Third-party processor** | Depends on `MAIL_HOST` env var — this is a self-hostable SMTP relay (e.g., Postfix) or can be configured to use SendGrid / AWS SES / Mailgun |
| **Data Processing Agreement** | [LEGAL PLACEHOLDER — if using a managed SMTP provider (SendGrid, SES, etc.), obtain a DPA from that provider] |
| **Minimisation notes** | Emails contain the minimum required data. OTPs are short-lived (10 min). No marketing content in current emails. |

---

## 5. Apple APNs / Google FCM (via Expo)

| Attribute | Detail |
|---|---|
| **Used in** | Via Expo SDK — no direct integration in this codebase |
| **Purpose** | Final-mile push notification delivery |
| **Data sent** | Expo delegates to APNs (iOS) and FCM (Android) — includes device token and notification payload |
| **Data sent includes PII?** | Notification payload may contain message preview text |
| **Privacy Policies** | Apple: https://www.apple.com/legal/privacy/ · Google: https://policies.google.com/privacy |
| **Minimisation notes** | Apple and Google require app-store privacy labels that accurately reflect push notification data. See Phase 5 for label submission. |

---

## 6. Expo Secure Store (`expo-secure-store`)

| Attribute | Detail |
|---|---|
| **Used in** | `apps/mobile` |
| **Purpose** | Stores the refresh token on-device using the OS keychain (iOS Keychain / Android Keystore) |
| **Data stored** | Refresh token (opaque random string, hashed server-side) |
| **Third-party processor** | None — this is a local device API; data never leaves the device |
| **Notes** | Recommended over AsyncStorage for security-sensitive values |

---

## 7. Socket.io (`socket.io-client`)

| Attribute | Detail |
|---|---|
| **Used in** | `apps/mobile`, `apps/web` (forum realtime) |
| **Purpose** | Realtime forum notifications and typing indicators |
| **Data sent** | Forum event payloads — no additional PII beyond what the REST API sends |
| **Third-party processor** | None — socket.io is an open-source library; the server runs on our infrastructure |

---

## 8. BullMQ + ioredis

| Attribute | Detail |
|---|---|
| **Used in** | `services/user-svc` (moderation worker) |
| **Purpose** | Async job queue for AI moderation |
| **Data stored** | Job payload contains text content (first 1500 chars) in Redis temporarily |
| **Third-party processor** | None — Redis runs on our own Docker infrastructure |
| **Minimisation notes** | Job data is removed from Redis after processing. If using managed Redis (e.g., Upstash, Redis Cloud), a DPA is required. |

---

## Not-Yet-Used / Future SDKs to Review

| SDK | Planned use | Privacy action required before enabling |
|---|---|---|
| Firebase Analytics | App usage analytics | DPA + consent gate + DPDP disclosure |
| Sentry | Error monitoring | DPA + scrub PII from error payloads |
| Cloudinary / AWS S3 | File storage for verification docs | DPA + ensure data-residency in India |
| RevenueCat | In-app purchases | DPA + disclose purchase history data |
