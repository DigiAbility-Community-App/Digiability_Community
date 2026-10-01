// ─────────────────────────────────────────────────────────────
// Data-processing consent notice (DPDP Act §5 notice + §6 consent).
//
// Shown at signup (WelcomeScreen) and, once, to every existing account whose
// consent predates this notice (PolicyReacceptanceGate). The text is
// docs/legal/07-data-processing-notice.md via legal-docs.generated.ts, so the
// app shows exactly the version the server stamps on the consent record.
//
// The checkbox starts unticked and is separate from the Terms checkbox;
// agreeing is impossible until the user ticks it themselves.
// ─────────────────────────────────────────────────────────────

import React, { useState } from "react";
import { ScrollView, StyleSheet, TouchableOpacity, View, ActivityIndicator } from "react-native";
import Markdown from "react-native-markdown-display";
import { Check } from "lucide-react-native";
import { AccessibleText } from "../shared/AccessibleText";
import { AccessibleButton } from "../shared/AccessibleButton";
import { useTheme } from "../../theme/ThemeContext";
import { LEGAL_DOCS } from "../../legal/legal-docs.generated";

interface Props {
  /** Called once the box is ticked and the user confirms. */
  onAgree: () => Promise<void> | void;
  onDecline: () => void;
  agreeLabel: string;
  declineLabel: string;
  busy?: boolean;
  error?: string | null;
}

export function ConsentNoticeContent({ onAgree, onDecline, agreeLabel, declineLabel, busy, error }: Props) {
  const { colors, highContrast } = useTheme();
  const [checked, setChecked] = useState(false);
  const [showPolicy, setShowPolicy] = useState(false);

  const doc = showPolicy ? LEGAL_DOCS["privacy-policy"] : LEGAL_DOCS["data-processing-notice"];

  const markdownStyle = {
    body: { color: colors.text, fontSize: 15, lineHeight: 23 },
    heading1: { color: colors.text, fontSize: 21, fontWeight: "800" as const, marginTop: 4 },
    heading2: { color: colors.text, fontSize: 17, fontWeight: "700" as const, marginTop: 18 },
    link: { color: colors.primary, fontWeight: "600" as const },
    strong: { fontWeight: "700" as const },
    bullet_list_icon: { color: colors.text },
    table: { borderColor: colors.border, borderWidth: 1, borderRadius: 6 },
    th: { padding: 8, backgroundColor: colors.surface },
    td: { padding: 8, borderColor: colors.border },
  };

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll} accessibilityLabel={doc.title}>
        {showPolicy && (
          <AccessibleButton
            variant="outline"
            accessibilityLabel="Back to the data notice"
            onPress={() => setShowPolicy(false)}
            style={{ marginBottom: 12 }}
          >
            Back to the data notice
          </AccessibleButton>
        )}
        <Markdown
          style={markdownStyle}
          onLinkPress={(url) => {
            // Relative links point at sibling legal docs; the only one the
            // notice references is the Privacy Policy. Show it in place.
            if (url.includes("privacy-policy")) setShowPolicy(true);
            return false;
          }}
        >
          {doc.markdown}
        </Markdown>
      </ScrollView>

      <View style={[styles.footer, { borderTopColor: colors.border, backgroundColor: colors.background }]}>
        <TouchableOpacity
          onPress={() => setChecked((v) => !v)}
          style={styles.checkRow}
          accessibilityRole="checkbox"
          accessibilityState={{ checked }}
          accessibilityLabel="I consent to Digiability processing my personal data, including any disability information I choose to share, for the purposes listed in this notice."
        >
          <View
            style={[
              styles.checkbox,
              {
                borderColor: checked ? colors.primary : colors.border,
                backgroundColor: checked ? colors.primary : "transparent",
              },
              highContrast && { borderWidth: 2, borderColor: "#000000" },
            ]}
          >
            {checked && <Check size={14} color="#fff" strokeWidth={3} />}
          </View>
          <AccessibleText variant="caption" style={{ flex: 1, lineHeight: 20 }}>
            I consent to Digiability processing my personal data, including any disability
            information I choose to share, for the purposes listed in this notice.
          </AccessibleText>
        </TouchableOpacity>

        {error ? (
          <AccessibleText variant="caption" style={{ color: colors.error ?? "#BA1A1A", marginBottom: 8 }} accessibilityLiveRegion="polite">
            {error}
          </AccessibleText>
        ) : null}

        <AccessibleButton
          accessibilityLabel={agreeLabel}
          accessibilityHint={checked ? undefined : "Tick the consent box first"}
          onPress={() => onAgree()}
          disabled={!checked || busy}
        >
          {busy ? <ActivityIndicator color="#fff" /> : agreeLabel}
        </AccessibleButton>
        <AccessibleButton
          variant="outline"
          accessibilityLabel={declineLabel}
          onPress={onDecline}
          disabled={busy}
          style={{ marginTop: 10 }}
        >
          {declineLabel}
        </AccessibleButton>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { padding: 20, paddingBottom: 32 },
  footer: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 20, borderTopWidth: 1 },
  checkRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 14, minHeight: 44 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
});
