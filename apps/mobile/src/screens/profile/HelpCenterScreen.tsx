import React, { useEffect, useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  Alert,
  Clipboard,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useTheme } from "../../theme/ThemeContext";
import { AccessibleText } from "../../components/shared/AccessibleText";
import ScreenWrapper from "../../components/layout/ScreenWrapper";
import AppHeader from "../../components/layout/AppHeader";
import { useSystemStore } from "../../store/systemStore";

const FAQS = [
  {
    q: "How do I change my accessibility preferences?",
    a: "Go to Profile > Edit Profile or the top Accessibility settings to adjust high contrast mode, text scaling, screen reader settings, and dyslexia font mode.",
  },
  {
    q: "How do I report inappropriate content or harassment?",
    a: "In community forums or chat threads, long-press any message or tap the flag icon on questions/answers, select the violation reason (Spam, Harassment, Inappropriate Content), and submit.",
  },
  {
    q: "How do I create and manage a Care Circle?",
    a: "Navigate to Profile > Care Circle to add family members, caregivers, or mentors with custom notification preferences and emergency contact privileges.",
  },
  {
    q: "How do I reset my account password?",
    a: "On the Login screen, tap 'Forgot Password', enter your email, verify the 6-digit OTP code, and set a new password.",
  },
];

export default function HelpCenterScreen() {
  const navigation = useNavigation();
  const { colors, highContrast } = useTheme();

  // Dynamic system settings from Admin General Settings
  const supportEmail = useSystemStore((s) => s.supportEmail) || "support@digiability.org";
  const supportPhone = useSystemStore((s) => s.supportPhone) || "+91 88000 12345";
  const checkMaintenanceStatus = useSystemStore((s) => s.checkMaintenanceStatus);

  useEffect(() => {
    checkMaintenanceStatus();
  }, [checkMaintenanceStatus]);

  const rawPhone = supportPhone.replace(/[^0-9+]/g, "") || "+918800012345";

  // First item expanded by default.
  const [expandedFaq, setExpandedFaq] = useState<number | null>(0);

  const cardBorder = highContrast
    ? { borderWidth: 2, borderColor: "#000000" }
    : { borderWidth: 1, borderColor: "rgba(0,0,0,0.06)" };

  const handleEmailPress = async () => {
    const mailtoUrl = `mailto:${supportEmail}`;
    try {
      const supported = await Linking.canOpenURL(mailtoUrl);
      if (supported) {
        await Linking.openURL(mailtoUrl);
      } else {
        Clipboard.setString(supportEmail);
        Alert.alert("Email Copied", `Could not open mail app. Support email ${supportEmail} has been copied to your clipboard.`);
      }
    } catch {
      Clipboard.setString(supportEmail);
      Alert.alert("Email Copied", `Support email ${supportEmail} copied to clipboard.`);
    }
  };

  const handlePhonePress = async () => {
    const telUrl = `tel:${rawPhone}`;
    try {
      const supported = await Linking.canOpenURL(telUrl);
      if (supported) {
        await Linking.openURL(telUrl);
      } else {
        Clipboard.setString(supportPhone);
        Alert.alert("Phone Copied", `Helpline number ${supportPhone} has been copied to your clipboard.`);
      }
    } catch {
      Clipboard.setString(supportPhone);
      Alert.alert("Phone Copied", `Helpline number ${supportPhone} copied to clipboard.`);
    }
  };

  return (
    <ScreenWrapper>
      <AppHeader
        title="Help Center & FAQs"
        onBackPress={() => navigation.goBack()}
      />

      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* ── FAQ LIST ── */}
        <AccessibleText variant="caption" style={[styles.sectionHeading, { color: colors.subtext }]}>
          FREQUENTLY ASKED QUESTIONS
        </AccessibleText>

        <View style={[styles.faqCard, { backgroundColor: colors.surface }, cardBorder]}>
          {FAQS.map((faq, index) => {
            const isExpanded = expandedFaq === index;
            return (
              <View
                key={index}
                style={[
                  styles.faqItem,
                  index !== FAQS.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border },
                ]}
              >
                <TouchableOpacity
                  onPress={() => setExpandedFaq(isExpanded ? null : index)}
                  style={styles.faqQuestionRow}
                  accessibilityRole="button"
                  accessibilityLabel={faq.q}
                  accessibilityState={{ expanded: isExpanded }}
                >
                  <AccessibleText variant="body" style={[styles.faqQuestion, { color: colors.text }]}>
                    {faq.q}
                  </AccessibleText>
                  <AccessibleText variant="body" style={{ color: colors.primary, fontWeight: "700" }}>
                    {isExpanded ? "−" : "+"}
                  </AccessibleText>
                </TouchableOpacity>

                {isExpanded && (
                  <AccessibleText variant="caption" style={[styles.faqAnswer, { color: colors.subtext }]}>
                    {faq.a}
                  </AccessibleText>
                )}
              </View>
            );
          })}
        </View>

        {/* ── STILL NEED HELP? ── */}
        <AccessibleText variant="caption" style={[styles.sectionHeading, { color: colors.subtext, marginTop: 24 }]}>
          STILL NEED HELP?
        </AccessibleText>

        <View style={[styles.helpCard, { backgroundColor: colors.surface }, cardBorder]}>
          <AccessibleText variant="body" style={{ color: colors.subtext, marginBottom: 14 }}>
            Couldn't find what you were looking for? Reach out to our support team directly.
          </AccessibleText>

          <TouchableOpacity
            style={styles.helpRow}
            onPress={handleEmailPress}
            accessibilityRole="button"
            accessibilityLabel={`Email support at ${supportEmail}`}
          >
            <AccessibleText style={{ fontSize: 18, marginRight: 12 }}>✉️</AccessibleText>
            <AccessibleText variant="body" style={{ color: colors.primary, fontWeight: "700" }}>
              {supportEmail}
            </AccessibleText>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.helpRow}
            onPress={handlePhonePress}
            accessibilityRole="button"
            accessibilityLabel={`Call support at ${supportPhone}`}
          >
            <AccessibleText style={{ fontSize: 18, marginRight: 12 }}>📞</AccessibleText>
            <AccessibleText variant="body" style={{ color: colors.text, fontWeight: "700" }}>
              {supportPhone}
            </AccessibleText>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 40,
  },
  sectionHeading: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
    marginBottom: 8,
    marginLeft: 4,
  },
  faqCard: {
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginBottom: 16,
  },
  faqItem: {
    paddingVertical: 12,
  },
  faqQuestionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  faqQuestion: {
    fontSize: 14,
    fontWeight: "700",
    flex: 1,
    paddingRight: 10,
  },
  faqAnswer: {
    fontSize: 12.5,
    lineHeight: 18,
    marginTop: 6,
  },
  helpCard: {
    borderRadius: 18,
    padding: 16,
  },
  helpRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 44,
    marginBottom: 4,
  },
});
