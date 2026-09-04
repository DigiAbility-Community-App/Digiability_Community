// ─────────────────────────────────────────────────────────────
// [LEGAL PLACEHOLDER]
// In-app Terms of Service / Privacy Policy. Content mirrors
// apps/web/src/features/legal/{TermsOfService,PrivacyPolicy}.tsx —
// including their "draft, pending legal review" status. Every section
// marked [LEGAL PLACEHOLDER] must be completed by legal counsel before
// public launch, and this file must be updated in step with the web copy.
//
// Previously these links opened EXPO_PUBLIC_WEB_BASE_URL/terms in an
// external browser, but that variable is set nowhere, so every build
// fell back to http://localhost:3000 and the links were dead on device.
// ─────────────────────────────────────────────────────────────

import React from "react";
import { View, ScrollView, StyleSheet } from "react-native";
import { RouteProp } from "@react-navigation/native";
import ScreenWrapper from "../../components/layout/ScreenWrapper";
import AppHeader from "../../components/layout/AppHeader";
import { AccessibleText } from "../../components/shared/AccessibleText";
import { useTheme } from "../../theme/ThemeContext";

type LegalDoc = "terms" | "privacy";

type Section = { heading: string; body: string[]; bullets?: string[] };

const TERMS: Section[] = [
  {
    heading: "1. Acceptance of terms",
    body: [
      "By creating an account on DigiAbility Community, you agree to these Terms of Service and our Privacy Policy.",
      "[LEGAL PLACEHOLDER — specify minimum age, jurisdiction, governing law]",
    ],
  },
  {
    heading: "2. Eligibility",
    body: [
      "[LEGAL PLACEHOLDER — minimum age requirement (18, or younger with parental consent per DPDP Act §9); requirements for professional roles (therapist/NGO verification)]",
    ],
  },
  {
    heading: "3. User conduct",
    body: [
      "You agree not to post content that is harmful, harassing, discriminatory, or violates applicable law. We reserve the right to moderate content and suspend accounts that violate these terms.",
      "[LEGAL PLACEHOLDER — expand acceptable use policy]",
    ],
  },
  {
    heading: "4. Health and disability information",
    body: [
      "[LEGAL PLACEHOLDER — disclaimer that platform does not provide medical advice; any professional credentials displayed are self-reported pending verification; users should seek qualified professional advice for medical decisions]",
    ],
  },
  { heading: "5. Intellectual property", body: ["[LEGAL PLACEHOLDER]"] },
  { heading: "6. Disclaimer of warranties", body: ["[LEGAL PLACEHOLDER]"] },
  { heading: "7. Limitation of liability", body: ["[LEGAL PLACEHOLDER]"] },
  {
    heading: "8. Governing law and dispute resolution",
    body: [
      "[LEGAL PLACEHOLDER — jurisdiction, governing law (India), dispute resolution mechanism, and court of competent jurisdiction]",
    ],
  },
  {
    heading: "9. Changes to these terms",
    body: [
      "We will notify you of material changes to these terms via email. Continued use of the platform after the effective date constitutes acceptance.",
      "[LEGAL PLACEHOLDER — specify notice period]",
    ],
  },
  { heading: "10. Contact", body: ["[LEGAL PLACEHOLDER — contact details]"] },
];

const PRIVACY: Section[] = [
  {
    heading: "1. Who we are",
    body: [
      "[LEGAL PLACEHOLDER — full legal entity name, registered address, CIN, and contact details of the Data Fiduciary as required under DPDP Act 2023 §8(2)(a)]",
    ],
  },
  {
    heading: "2. Data we collect",
    body: ["We collect the following categories of personal data when you use DigiAbility Community:"],
    bullets: [
      "Account data: name, email address, phone number (optional), roles",
      "Profile data: date of birth, gender, city, state, disability type and history, caregiver information (if applicable), professional credentials (for therapists and NGOs)",
      "Communication data: chat messages, forum questions, answers, and votes",
      "Device data: Expo push notification token, device platform",
      "Usage data: last seen timestamp, session information",
    ],
  },
  {
    heading: "3. Why we collect your data (purposes)",
    body: [],
    bullets: [
      "Creating and managing your account",
      "Delivering chat, forum, and community features",
      "Sending push notifications for activity relevant to you",
      "Content moderation to keep the platform safe",
      "Verifying professional credentials for therapists and NGOs",
    ],
  },
  {
    heading: "4. Legal basis for processing",
    body: [
      "Under the Digital Personal Data Protection Act 2023 (DPDP Act), we process your personal data on the basis of:",
    ],
    bullets: [
      "Consent (§6): We record your explicit consent at registration. You may withdraw optional consents at any time from your account settings.",
      "Legitimate uses (§7): [LEGAL PLACEHOLDER — identify any processing done under §7 exemptions, e.g., compliance with law]",
    ],
  },
  {
    heading: "5. Third-party services",
    body: [
      "We use the following third-party services that may receive your data. A full inventory is maintained internally and reviewed annually:",
      "[LEGAL PLACEHOLDER — confirm Data Processing Agreements are in place with each provider]",
    ],
    bullets: [
      "Expo Push Notifications: Delivers in-app notifications to your device. Notification previews may include short excerpts from messages.",
      "OpenAI Moderation API: Submitted text may be analysed for harmful content. No personal identifier is included in the request.",
      "Google Cloud Vision API: Images you upload may be analysed for inappropriate content.",
      "SMTP email provider: [LEGAL PLACEHOLDER — name the actual email provider in production]",
    ],
  },
  {
    heading: "6. Children's data",
    body: [
      "[LEGAL PLACEHOLDER — DPDP Act 2023 §9 prohibits processing personal data of children under 18 without verifiable parental consent, and prohibits behavioural tracking of children. If the platform allows users under 18, a parental-consent flow and age-verification mechanism must be documented here and implemented before launch.]",
    ],
  },
  {
    heading: "7. Your rights (DPDP Act 2023 §11–§14)",
    body: [],
    bullets: [
      "Right to access: Download all data we hold about you from Profile → Privacy & Data.",
      "Right to correction: Update your profile at any time from Profile.",
      "Right to erasure: Delete your account from Profile → Privacy & Data. All PII is anonymised immediately.",
      "Right to withdraw consent: Manage your consent preferences from Profile → Privacy & Data.",
      "Right to grievance redressal: Contact [LEGAL PLACEHOLDER — grievance officer name and email, required under DPDP §13(5)].",
    ],
  },
  {
    heading: "8. Data retention",
    body: ["[LEGAL PLACEHOLDER — state retention periods for each data category]"],
  },
  {
    heading: "9. Cross-border data transfers",
    body: ["[LEGAL PLACEHOLDER — disclose any processing outside India and the safeguards applied]"],
  },
  {
    heading: "10. Contact us",
    body: ["[LEGAL PLACEHOLDER — contact and grievance officer details]"],
  },
];

export default function LegalScreen({
  navigation,
  route,
}: {
  navigation: any;
  route: RouteProp<Record<string, { doc?: LegalDoc }>, string>;
}) {
  const { colors } = useTheme();
  const doc: LegalDoc = route.params?.doc === "terms" ? "terms" : "privacy";
  const sections = doc === "terms" ? TERMS : PRIVACY;
  const title = doc === "terms" ? "Terms of Service" : "Privacy Policy";

  return (
    <ScreenWrapper>
      <AppHeader title={title} onBackPress={() => navigation.goBack()} />
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <AccessibleText variant="caption" style={{ color: colors.subtext, marginBottom: 12 }}>
          Last updated: [LEGAL PLACEHOLDER — insert effective date]
        </AccessibleText>

        {/* Same notice the web version carries — this copy is not final. */}
        <View style={[styles.draftBanner, { backgroundColor: "#FFF3CD", borderColor: "#FFC107" }]}>
          <AccessibleText variant="body" style={styles.draftTitle}>
            ⚠ Draft — pending legal review
          </AccessibleText>
          <AccessibleText variant="caption" style={{ color: "#5C4500", marginTop: 4 }}>
            This document requires legal review before publication.
          </AccessibleText>
        </View>

        {sections.map((section) => (
          <View key={section.heading} style={styles.section}>
            <AccessibleText variant="body" style={[styles.heading, { color: colors.text }]}>
              {section.heading}
            </AccessibleText>
            {section.body.map((paragraph, i) => (
              <AccessibleText
                key={i}
                variant="caption"
                style={[styles.paragraph, { color: colors.subtext }]}
              >
                {paragraph}
              </AccessibleText>
            ))}
            {section.bullets?.map((bullet, i) => (
              <AccessibleText
                key={`b-${i}`}
                variant="caption"
                style={[styles.bullet, { color: colors.subtext }]}
              >
                {"•  "}{bullet}
              </AccessibleText>
            ))}
          </View>
        ))}
      </ScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 48 },
  draftBanner: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    marginBottom: 20,
  },
  draftTitle: { fontWeight: "700", color: "#5C4500" },
  section: { marginBottom: 20 },
  heading: { fontWeight: "700", marginBottom: 6 },
  paragraph: { lineHeight: 20, marginBottom: 8 },
  bullet: { lineHeight: 20, marginBottom: 6, paddingLeft: 4 },
});
