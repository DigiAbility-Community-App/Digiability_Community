// ─────────────────────────────────────────────────────────────
// View my data (DPDP Act §11 — right of access).
//
// Shows the same bundle "Download a copy" exports, as readable labelled
// sections rather than a raw JSON file, so a screen-reader user can review it
// in the app. Correcting anything goes through EditProfile.
// ─────────────────────────────────────────────────────────────

import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useTheme } from "../../theme/ThemeContext";
import { AccessibleText } from "../../components/shared/AccessibleText";
import { AccessibleButton } from "../../components/shared/AccessibleButton";
import ScreenWrapper from "../../components/layout/ScreenWrapper";
import AppHeader from "../../components/layout/AppHeader";
import { exportMyData, DataExportBundle } from "../../services/privacyService";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

/** "dateOfBirth" → "Date of birth", "isEmailVerified" → "Is email verified" */
function humanize(key: string): string {
  const spaced = key
    .replace(/_/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "Not provided";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "string" && ISO_DATE.test(value)) return new Date(value).toLocaleString();
  if (Array.isArray(value)) return value.length ? value.map(formatValue).join(", ") : "None";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

interface Section {
  title: string;
  /** One record (key → value) or a list of records. */
  data: Record<string, unknown> | Array<Record<string, unknown>> | null | undefined;
  emptyText: string;
}

export default function MyDataScreen() {
  const { colors, highContrast } = useTheme();
  const navigation = useNavigation<any>();
  const [bundle, setBundle] = useState<DataExportBundle | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setBundle(await exportMyData());
    } catch {
      setError("We couldn't load your data. Please check your connection and try again.");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const cardBorder = highContrast ? { borderWidth: 2, borderColor: "#000000" } : {};

  const renderRecord = (record: Record<string, unknown>, key: string) => (
    <View key={key} style={styles.record}>
      {Object.entries(record).map(([field, value]) => (
        <View key={field} style={styles.row} accessible accessibilityLabel={`${humanize(field)}: ${formatValue(value)}`}>
          <AccessibleText variant="caption" style={{ color: colors.subtext }}>
            {humanize(field)}
          </AccessibleText>
          <AccessibleText variant="body" style={{ color: colors.text }}>
            {formatValue(value)}
          </AccessibleText>
        </View>
      ))}
    </View>
  );

  const renderSection = ({ title, data, emptyText }: Section) => {
    const records = Array.isArray(data) ? data : data ? [data] : [];
    return (
      <View key={title} style={[styles.card, { backgroundColor: colors.card }, cardBorder]}>
        <AccessibleText variant="title" style={{ color: colors.text, fontSize: 16, marginBottom: 8 }} accessibilityRole="header">
          {title}
        </AccessibleText>
        {records.length === 0 ? (
          <AccessibleText variant="body" style={{ color: colors.subtext }}>
            {emptyText}
          </AccessibleText>
        ) : (
          records.map((r, i) => renderRecord(r, `${title}-${i}`))
        )}
      </View>
    );
  };

  return (
    <ScreenWrapper>
      <AppHeader title="View my data" />
      <ScrollView contentContainerStyle={styles.scroll}>
        {error ? (
          <View style={[styles.card, { backgroundColor: colors.card }, cardBorder]}>
            <AccessibleText variant="body" style={{ color: colors.text, marginBottom: 12 }} accessibilityLiveRegion="polite">
              {error}
            </AccessibleText>
            <AccessibleButton accessibilityLabel="Try again" onPress={load}>
              Try again
            </AccessibleButton>
          </View>
        ) : !bundle ? (
          <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} accessibilityLabel="Loading your data" />
        ) : (
          <>
            <AccessibleText variant="body" style={{ color: colors.subtext, marginBottom: 12 }}>
              This is the personal data we hold about you, as of {new Date(bundle.exportedAt).toLocaleString()}.
            </AccessibleText>

            {[
              { title: "Account", data: bundle.account, emptyText: "No account details." },
              { title: "Profile", data: bundle.profile, emptyText: "You haven't added profile details." },
              { title: "Mentor profile", data: bundle.mentorProfile, emptyText: "You don't have a mentor profile." },
              { title: "Mentor reviews you gave", data: bundle.mentorReviewsGiven, emptyText: "None." },
              { title: "Consents", data: bundle.consents, emptyText: "No consent records." },
              { title: "Guardian confirmations", data: bundle.guardianAttestations, emptyText: "None." },
              { title: "Reports you filed", data: bundle.reportsFiled, emptyText: "None." },
              { title: "Devices registered for notifications", data: bundle.deviceTokens, emptyText: "None." },
              { title: "Sign-in sessions", data: bundle.sessions, emptyText: "None." },
            ].map(renderSection)}

            <View style={[styles.card, { backgroundColor: colors.card }, cardBorder]}>
              <AccessibleText variant="title" style={{ color: colors.text, fontSize: 16, marginBottom: 8 }} accessibilityRole="header">
                Messages and forum posts
              </AccessibleText>
              <AccessibleText variant="body" style={{ color: colors.subtext }}>
                {bundle.crossServiceData.chatService} {bundle.crossServiceData.forumService}
              </AccessibleText>
            </View>

            <AccessibleButton
              accessibilityLabel="Correct my details"
              accessibilityHint="Opens your profile so you can fix anything that's wrong"
              onPress={() => navigation.navigate("EditProfile")}
            >
              Correct my details
            </AccessibleButton>
          </>
        )}
      </ScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 16, paddingBottom: 40 },
  card: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  record: { gap: 8, paddingVertical: 4 },
  row: { gap: 2 },
});
