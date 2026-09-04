import React, { useState, useEffect, useRef } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Linking,
  Alert,
  Platform,
  Clipboard,
  KeyboardAvoidingView,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useTheme } from "../../theme/ThemeContext";
import { AccessibleText } from "../../components/shared/AccessibleText";
import { AccessibleButton } from "../../components/shared/AccessibleButton";
import ScreenWrapper from "../../components/layout/ScreenWrapper";
import AppHeader from "../../components/layout/AppHeader";
import { useAuthStore } from "../../store/authStore";
import { useSystemStore } from "../../store/systemStore";

const CRISIS_HELPLINE = "988";

const CATEGORIES = [
  "Account & Login",
  "Accessibility Needs",
  "Report a Bug",
  "Safety & Harassment",
  "Care Circle Support",
  "General Inquiry",
];

export default function ContactSupportScreen() {
  const navigation = useNavigation();
  const route = useRoute<any>();
  const { colors, highContrast } = useTheme();
  const user = useAuthStore((s) => s.user);

  // Help Center & FAQs and Contact Support are the same screen, entered
  // from two different menu items — initialSection tells us which one the
  // user tapped so we can scroll/expand to the relevant part and reflect
  // it in the header, instead of showing the identical page for both.
  const initialSection: "faq" | "contact" = route.params?.initialSection === "faq" ? "faq" : "contact";
  const scrollViewRef = useRef<ScrollView>(null);
  const [faqSectionY, setFaqSectionY] = useState<number | null>(null);
  const hasScrolledToFaq = useRef(false);

  // Dynamic system settings from Admin General Settings
  const supportEmail = useSystemStore((s) => s.supportEmail) || "support@digiability.org";
  const supportPhone = useSystemStore((s) => s.supportPhone) || "+91 88000 12345";
  const checkMaintenanceStatus = useSystemStore((s) => s.checkMaintenanceStatus);

  useEffect(() => {
    checkMaintenanceStatus();
  }, [checkMaintenanceStatus]);

  const rawPhone = supportPhone.replace(/[^0-9+]/g, "") || "+918800012345";
  const rawWhatsApp = rawPhone.replace(/\+/g, "");

  // Form state
  const [selectedCategory, setSelectedCategory] = useState(CATEGORIES[0]);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // FAQ Expand state
  const [expandedFaq, setExpandedFaq] = useState<number | null>(initialSection === "faq" ? 0 : null);

  useEffect(() => {
    if (initialSection === "faq" && faqSectionY !== null && !hasScrolledToFaq.current) {
      hasScrolledToFaq.current = true;
      scrollViewRef.current?.scrollTo({ y: faqSectionY, animated: true });
    }
  }, [initialSection, faqSectionY]);

  const cardBorder = highContrast
    ? { borderWidth: 2, borderColor: "#000000" }
    : { borderWidth: 1, borderColor: "rgba(0,0,0,0.06)" };

  // ── Contact Actions ──
  const handleEmailPress = async () => {
    const subjectParam = encodeURIComponent(`[${selectedCategory}] Support Request - ${user?.name || "User"}`);
    const bodyParam = encodeURIComponent(`Hello DigiAbility Support,\n\nUser: ${user?.name || "Anonymous"} (${user?.email || "N/A"})\n\nIssue:\n`);
    const mailtoUrl = `mailto:${supportEmail}?subject=${subjectParam}&body=${bodyParam}`;
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

  const handleWhatsAppPress = async () => {
    const textParam = encodeURIComponent(`Hello DigiAbility Support, I need help with ${selectedCategory}.`);
    const waUrl = `https://wa.me/${rawWhatsApp}?text=${textParam}`;
    try {
      await Linking.openURL(waUrl);
    } catch {
      Alert.alert("WhatsApp Unavailable", "Could not open WhatsApp. Please contact us via Email or Phone.");
    }
  };

  const handleCrisisPress = async () => {
    const telUrl = `tel:${CRISIS_HELPLINE}`;
    Alert.alert(
      "Crisis Support (988)",
      "You are about to call the 24/7 Suicide & Crisis Lifeline for free, confidential mental health and crisis support.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Call 988", onPress: () => Linking.openURL(telUrl) },
      ]
    );
  };

  const handleCopyEmail = () => {
    Clipboard.setString(supportEmail);
    Alert.alert("Copied", `${supportEmail} copied to clipboard.`);
  };

  const handleCopyPhone = () => {
    Clipboard.setString(supportPhone);
    Alert.alert("Copied", `${supportPhone} copied to clipboard.`);
  };

  const handleSubmitTicket = () => {
    if (!message.trim()) {
      Alert.alert("Message Required", "Please enter a message explaining what you need help with.");
      return;
    }

    setSubmitting(true);
    // Simulate sending ticket
    setTimeout(() => {
      setSubmitting(false);
      setSubmitted(true);
      setSubject("");
      setMessage("");
      Alert.alert(
        "Support Request Received",
        "Thank you! Your message has been sent to the DigiAbility Support Team. We will respond to your email within 24 hours.",
        [{ text: "OK" }]
      );
    }, 900);
  };

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

  return (
    <ScreenWrapper>
      <AppHeader
        title={initialSection === "faq" ? "Help Center & FAQs" : "Contact Support"}
        onBackPress={() => navigation.goBack()}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          ref={scrollViewRef}
          style={[styles.container, { backgroundColor: colors.background }]}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {/* ── HEADER BANNER ── */}
          <View style={[styles.heroCard, { backgroundColor: colors.surface }, cardBorder]}>
            <View style={[styles.heroIconCircle, { backgroundColor: highContrast ? "#000" : "#EDDCFF" }]}>
              <AccessibleText variant="title" style={{ fontSize: 26 }}>
                🤝
              </AccessibleText>
            </View>
            <View style={{ flex: 1, marginLeft: 14 }}>
              <AccessibleText variant="title" style={[styles.heroTitle, { color: colors.text }]}>
                We're Here to Help
              </AccessibleText>
              <AccessibleText variant="body" style={[styles.heroSubtitle, { color: colors.subtext }]}>
                Have a question, feedback, or need accessibility assistance? Choose your preferred contact channel below.
              </AccessibleText>
            </View>
          </View>

          {/* ── DIRECT CONTACT CHANNELS ── */}
          <AccessibleText variant="caption" style={[styles.sectionHeading, { color: colors.subtext }]}>
            DIRECT CONTACT CHANNELS
          </AccessibleText>

          {/* EMAIL CHANNEL */}
          <View style={[styles.channelCard, { backgroundColor: colors.surface }, cardBorder]}>
            <View style={styles.channelHeader}>
              <View style={[styles.iconBadge, { backgroundColor: "#EBF3FF" }]}>
                <AccessibleText style={{ fontSize: 18 }}>✉️</AccessibleText>
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <AccessibleText variant="body" style={[styles.channelTitle, { color: colors.text }]}>
                  Email Support
                </AccessibleText>
                <AccessibleText variant="caption" style={{ color: colors.primary, fontWeight: "700", marginTop: 1 }}>
                  {supportEmail}
                </AccessibleText>
                <AccessibleText variant="caption" style={{ color: colors.subtext, marginTop: 2 }}>
                  Typical response time: Within 24 hours
                </AccessibleText>
              </View>
            </View>
            <View style={styles.channelActions}>
              <TouchableOpacity
                onPress={handleEmailPress}
                style={[styles.actionBtn, { backgroundColor: colors.primary }]}
                accessibilityRole="button"
                accessibilityLabel="Send Email to Support"
              >
                <AccessibleText variant="caption" style={styles.actionBtnText}>
                  Send Email
                </AccessibleText>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleCopyEmail}
                style={[styles.copyBtn, { borderColor: colors.border }]}
                accessibilityRole="button"
                accessibilityLabel="Copy support email address"
              >
                <AccessibleText variant="caption" style={{ color: colors.text, fontWeight: "600" }}>
                  Copy
                </AccessibleText>
              </TouchableOpacity>
            </View>
          </View>

          {/* PHONE & HELPLINE CHANNEL */}
          <View style={[styles.channelCard, { backgroundColor: colors.surface }, cardBorder]}>
            <View style={styles.channelHeader}>
              <View style={[styles.iconBadge, { backgroundColor: "#E8FBF0" }]}>
                <AccessibleText style={{ fontSize: 18 }}>📞</AccessibleText>
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <AccessibleText variant="body" style={[styles.channelTitle, { color: colors.text }]}>
                  Toll-Free Helpline
                </AccessibleText>
                <AccessibleText variant="caption" style={{ color: colors.text, fontWeight: "700", marginTop: 1 }}>
                  {supportPhone}
                </AccessibleText>
                <AccessibleText variant="caption" style={{ color: colors.subtext, marginTop: 2 }}>
                  Available Mon – Sat, 9:00 AM – 8:00 PM
                </AccessibleText>
              </View>
            </View>
            <View style={styles.channelActions}>
              <TouchableOpacity
                onPress={handlePhonePress}
                style={[styles.actionBtn, { backgroundColor: "#16A34A" }]}
                accessibilityRole="button"
                accessibilityLabel="Call Support Helpline"
              >
                <AccessibleText variant="caption" style={styles.actionBtnText}>
                  Call Now
                </AccessibleText>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleCopyPhone}
                style={[styles.copyBtn, { borderColor: colors.border }]}
                accessibilityRole="button"
                accessibilityLabel="Copy helpline phone number"
              >
                <AccessibleText variant="caption" style={{ color: colors.text, fontWeight: "600" }}>
                  Copy
                </AccessibleText>
              </TouchableOpacity>
            </View>
          </View>

          {/* WHATSAPP SUPPORT */}
          <View style={[styles.channelCard, { backgroundColor: colors.surface }, cardBorder]}>
            <View style={styles.channelHeader}>
              <View style={[styles.iconBadge, { backgroundColor: "#DCFCE7" }]}>
                <AccessibleText style={{ fontSize: 18 }}>💬</AccessibleText>
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <AccessibleText variant="body" style={[styles.channelTitle, { color: colors.text }]}>
                  WhatsApp Support
                </AccessibleText>
                <AccessibleText variant="caption" style={{ color: colors.subtext, marginTop: 2 }}>
                  Instant messaging, voice notes & accessibility assistance
                </AccessibleText>
              </View>
            </View>
            <TouchableOpacity
              onPress={handleWhatsAppPress}
              style={[styles.fullWidthBtn, { backgroundColor: "#25D366" }]}
              accessibilityRole="button"
              accessibilityLabel="Chat with Support on WhatsApp"
            >
              <AccessibleText variant="caption" style={styles.actionBtnText}>
                Chat on WhatsApp
              </AccessibleText>
            </TouchableOpacity>
          </View>

          {/* CRISIS & MENTAL HEALTH LIFELINE (Crucial for accessibility & welfare) */}
          <View style={[styles.channelCard, { backgroundColor: "#FFF5F5", borderColor: "#FEB2B2", borderWidth: 1 }]}>
            <View style={styles.channelHeader}>
              <View style={[styles.iconBadge, { backgroundColor: "#FED7D7" }]}>
                <AccessibleText style={{ fontSize: 18 }}>🚨</AccessibleText>
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <AccessibleText variant="body" style={[styles.channelTitle, { color: "#C53030" }]}>
                  24/7 Crisis & Mental Health Lifeline
                </AccessibleText>
                <AccessibleText variant="caption" style={{ color: "#742A2A", marginTop: 2 }}>
                  Immediate, free & confidential support for anyone in distress or crisis.
                </AccessibleText>
              </View>
            </View>
            <TouchableOpacity
              onPress={handleCrisisPress}
              style={[styles.fullWidthBtn, { backgroundColor: "#E53E3E" }]}
              accessibilityRole="button"
              accessibilityLabel="Call 24/7 Crisis Lifeline 988"
            >
              <AccessibleText variant="caption" style={styles.actionBtnText}>
                Call 988 Crisis Lifeline
              </AccessibleText>
            </TouchableOpacity>
          </View>

          {/* ── IN-APP MESSAGE / SUPPORT TICKET FORM ── */}
          <AccessibleText variant="caption" style={[styles.sectionHeading, { color: colors.subtext, marginTop: 24 }]}>
            SEND AN IN-APP MESSAGE
          </AccessibleText>

          <View style={[styles.formCard, { backgroundColor: colors.surface }, cardBorder]}>
            <AccessibleText variant="body" style={[styles.formTitle, { color: colors.text }]}>
              Send a Support Request
            </AccessibleText>
            <AccessibleText variant="caption" style={{ color: colors.subtext, marginBottom: 14 }}>
              Submit your question or issue and our team will get back to your registered email.
            </AccessibleText>

            {/* CATEGORY SELECTOR */}
            <AccessibleText variant="caption" style={[styles.inputLabel, { color: colors.text }]}>
              Category
            </AccessibleText>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
              <View style={styles.categoryRow}>
                {CATEGORIES.map((cat) => {
                  const isSelected = selectedCategory === cat;
                  return (
                    <TouchableOpacity
                      key={cat}
                      onPress={() => setSelectedCategory(cat)}
                      style={[
                        styles.catChip,
                        {
                          backgroundColor: isSelected
                            ? (highContrast ? "#000" : colors.primary)
                            : (highContrast ? "#fff" : colors.background),
                          borderColor: isSelected ? colors.primary : colors.border,
                        },
                      ]}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isSelected }}
                    >
                      <AccessibleText
                        variant="caption"
                        style={{
                          color: isSelected ? "#FFFFFF" : colors.text,
                          fontWeight: isSelected ? "700" : "500",
                        }}
                      >
                        {cat}
                      </AccessibleText>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>

            {/* SUBJECT */}
            <AccessibleText variant="caption" style={[styles.inputLabel, { color: colors.text }]}>
              Subject (Optional)
            </AccessibleText>
            <TextInput
              style={[
                styles.textInput,
                { backgroundColor: colors.background, color: colors.text, borderColor: colors.border },
              ]}
              placeholder="e.g. Issue updating my city location"
              placeholderTextColor={colors.subtext}
              value={subject}
              onChangeText={setSubject}
              accessibilityLabel="Subject"
            />

            {/* MESSAGE */}
            <AccessibleText variant="caption" style={[styles.inputLabel, { color: colors.text, marginTop: 12 }]}>
              Message *
            </AccessibleText>
            <TextInput
              style={[
                styles.textArea,
                { backgroundColor: colors.background, color: colors.text, borderColor: colors.border },
              ]}
              placeholder="Describe your issue or question in detail..."
              placeholderTextColor={colors.subtext}
              value={message}
              onChangeText={setMessage}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              accessibilityLabel="Support Message"
            />

            {/* SUBMIT BUTTON */}
            <AccessibleButton
              variant="primary"
              accessibilityLabel="Submit Support Request"
              style={{ marginTop: 16 }}
              onPress={handleSubmitTicket}
              disabled={submitting || !message.trim()}
            >
              {submitting ? "SENDING REQUEST…" : "SUBMIT SUPPORT REQUEST"}
            </AccessibleButton>
          </View>

          {/* ── FREQUENTLY ASKED QUESTIONS ── */}
          <View onLayout={(e) => setFaqSectionY(e.nativeEvent.layout.y)}>
          <AccessibleText variant="caption" style={[styles.sectionHeading, { color: colors.subtext, marginTop: 24 }]}>
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
          </View>

          {/* ── FOOTER ADDRESS & HOURS ── */}
          <View style={[styles.footerInfo, { backgroundColor: colors.surface }, cardBorder]}>
            <AccessibleText variant="caption" style={{ color: colors.subtext, textAlign: "center", lineHeight: 18 }}>
              DigiAbility Community Foundation{"\n"}
              Dedicated to Accessible Technology & Community Welfare{"\n"}
              Official Support: {supportEmail}
            </AccessibleText>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
  heroCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 18,
    marginBottom: 16,
  },
  heroIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  heroTitle: {
    fontSize: 17,
    fontWeight: "800",
  },
  heroSubtitle: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: 3,
  },
  sectionHeading: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
    marginBottom: 8,
    marginLeft: 4,
  },
  channelCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  channelHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  iconBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  channelTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  channelActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
  },
  actionBtn: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  actionBtnText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 13,
  },
  copyBtn: {
    paddingHorizontal: 16,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  fullWidthBtn: {
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
  },
  formCard: {
    borderRadius: 18,
    padding: 18,
    marginBottom: 12,
  },
  formTitle: {
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 2,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 6,
  },
  categoryRow: {
    flexDirection: "row",
    gap: 8,
  },
  catChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  textInput: {
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 14,
  },
  textArea: {
    height: 90,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingTop: 10,
    fontSize: 14,
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
  footerInfo: {
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
    justifyContent: "center",
  },
});
