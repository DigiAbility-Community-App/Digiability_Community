import React, { useState } from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { Calendar, MapPin, Shield, Info, ArrowUpRight } from "lucide-react-native";
import { useRoute, useNavigation } from "@react-navigation/native";
import * as WebBrowser from "expo-web-browser";
import ScreenWrapper from "../../components/layout/ScreenWrapper";
import { useTheme } from "../../theme/ThemeContext";
import { AccessibleText } from "../../components/shared/AccessibleText";
import { AccessibleButton } from "../../components/shared/AccessibleButton";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function LeavePortalScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { colors, highContrast } = useTheme();
  const insets = useSafeAreaInsets();

  const { externalUrl, eventTitle, eventDate, eventLocation, organizer } = route.params || {};
  const [loading, setLoading] = useState(false);

  const handleContinue = async () => {
    if (!externalUrl) return;
    try {
      setLoading(true);
      await WebBrowser.openBrowserAsync(externalUrl);
      navigation.goBack();
    } catch {
      // silently ignore
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => navigation.goBack();

  return (
    <ScreenWrapper statusBarStyle="dark">
      {/* DIMMED BACKGROUND AREA (top) */}
      <View style={styles.backdrop} />

      {/* BOTTOM SHEET CARD */}
      <View style={[
        styles.sheet,
        { backgroundColor: colors.card, paddingBottom: Math.max(insets.bottom, 24) }
      ]}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.sheetContent}
          bounces={false}
        >
          {/* ORGANIZER ICON */}
          <View style={[styles.orgIcon, { backgroundColor: highContrast ? "#000" : colors.surface }]}>
            <AccessibleText style={styles.orgEmoji}>🏛️</AccessibleText>
          </View>

          {/* TITLE */}
          <AccessibleText
            variant="heroTitle"
            style={[styles.sheetTitle, { color: colors.text }]}
            accessibilityRole="header"
          >
            You are leaving{"\n"}DigiAbility
          </AccessibleText>

          <AccessibleText variant="body" style={[styles.sheetSubtitle, { color: colors.subtext }]}>
            You will be redirected to {organizer || "Digiability Services"} to complete your registration
          </AccessibleText>

          {/* EVENT SUMMARY CARD */}
          <View style={[styles.eventCard, { backgroundColor: highContrast ? "#f0f0f0" : "#F5F3FF" }]}>
            <View style={styles.eventCardRow}>
              <Calendar color={colors.primary} size={18} style={{ marginRight: 10 }} />
              <AccessibleText variant="title" style={[styles.eventCardTitle, { color: colors.text }]}>
                {eventTitle || "Selected Event"}
              </AccessibleText>
            </View>
            {eventDate ? (
              <View style={styles.eventCardMeta}>
                <Calendar color={colors.subtext} size={14} style={{ marginRight: 6 }} />
                <AccessibleText variant="body" style={{ color: colors.subtext, fontSize: 13 }}>
                  {eventDate}
                </AccessibleText>
              </View>
            ) : null}
            {eventLocation ? (
              <View style={styles.eventCardMeta}>
                <MapPin color={colors.subtext} size={14} style={{ marginRight: 6 }} />
                <AccessibleText variant="body" style={{ color: colors.subtext, fontSize: 13 }}>
                  {eventLocation}
                </AccessibleText>
              </View>
            ) : null}
          </View>

          {/* TRUST INDICATORS */}
          <View style={styles.trustList}>
            <View style={styles.trustRow}>
              <Info color={colors.subtext} size={16} style={{ marginRight: 10 }} />
              <AccessibleText variant="body" style={[styles.trustText, { color: colors.subtext }]}>
                Your DigiAbility profile will not be shared automatically
              </AccessibleText>
            </View>
            <View style={styles.trustRow}>
              <Shield color={colors.subtext} size={16} style={{ marginRight: 10 }} />
              <AccessibleText variant="body" style={[styles.trustText, { color: colors.subtext }]}>
                Digiability is a trusted partner platform
              </AccessibleText>
            </View>
          </View>

          {/* CONTINUE BUTTON */}
          <AccessibleButton
            style={[
              styles.continueBtn,
              highContrast && { backgroundColor: "#000" },
              loading && { opacity: 0.7 },
            ]}
            onPress={handleContinue}
            disabled={loading}
            accessibilityLabel="Continue to Digiability registration portal"
            accessibilityHint="Opens the external Digiability Services website in your browser"
          >
            {loading ? (
              <ActivityIndicator color={highContrast ? "#fff" : "#500088"} />
            ) : (
              <>
                <AccessibleText style={[styles.continueBtnText, highContrast && { color: "#fff" }]}>
                  Continue to Digiability
                </AccessibleText>
                <ArrowUpRight
                  color={highContrast ? "#fff" : "#500088"}
                  size={18}
                  style={{ marginLeft: 6 }}
                />
              </>
            )}
          </AccessibleButton>

          {/* SKIP BUTTON */}
          <AccessibleButton
            variant="outline"
            style={[styles.skipBtn, { borderColor: colors.border }]}
            onPress={handleSkip}
            accessibilityLabel="Skip and return to event details"
            accessibilityHint="Cancels the external navigation and returns to the event page"
          >
            <AccessibleText style={[styles.skipBtnText, { color: colors.text }]}>
              Skip
            </AccessibleText>
          </AccessibleButton>

          {/* FOOTER NOTE */}
          <AccessibleText variant="caption" style={[styles.footerNote, { color: colors.subtext }]}>
            By continuing you agree to Digiability terms
          </AccessibleText>
        </ScrollView>
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  sheet: {
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 16,
  },
  sheetContent: {
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 8,
    alignItems: "center",
  },
  orgIcon: {
    width: 72,
    height: 72,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  orgEmoji: {
    fontSize: 34,
    lineHeight: 44,
  },
  sheetTitle: {
    fontSize: 24,
    fontWeight: "900",
    textAlign: "center",
    lineHeight: 30,
    marginBottom: 8,
  },
  sheetSubtitle: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  eventCard: {
    width: "100%",
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    gap: 8,
  },
  eventCardRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  eventCardTitle: {
    fontSize: 15,
    fontWeight: "800",
    flex: 1,
  },
  eventCardMeta: {
    flexDirection: "row",
    alignItems: "center",
  },
  trustList: {
    width: "100%",
    gap: 10,
    marginBottom: 24,
  },
  trustRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  trustText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  continueBtn: {
    width: "100%",
    minHeight: 56,
    backgroundColor: "#F5C518",
    borderRadius: 16,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
    shadowColor: "#F5C518",
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 5,
  },
  continueBtnText: {
    fontWeight: "800",
    color: "#500088",
    flexShrink: 1,
    textAlign: "center",
  },
  skipBtn: {
    width: "100%",
    minHeight: 52,
    borderRadius: 16,
    borderWidth: 1.5,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  skipBtnText: {
    fontWeight: "700",
  },
  footerNote: {
    fontSize: 11,
    textAlign: "center",
    marginBottom: 8,
  },
});
