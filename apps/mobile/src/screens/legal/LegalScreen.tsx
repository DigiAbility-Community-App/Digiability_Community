// ─────────────────────────────────────────────────────────────
// Legal document viewer.
//
// Renders whichever document docs/legal/manifest.json declares, from the
// markdown text baked into legal-docs.generated.ts by `npm run sync:legal`.
//
// This used to be ~230 lines of hand-written JSX duplicating (and drifting
// from) apps/web/src/features/legal/*.tsx. Two hand-maintained copies of the
// same legal text is exactly the failure mode docs/legal/ exists to prevent —
// one edit to the source markdown now updates every surface.
// ─────────────────────────────────────────────────────────────

import React from "react";
import { ScrollView, StyleSheet } from "react-native";
import Markdown from "react-native-markdown-display";
import { useRoute } from "@react-navigation/native";
import ScreenWrapper from "../../components/layout/ScreenWrapper";
import AppHeader from "../../components/layout/AppHeader";
import { AccessibleText } from "../../components/shared/AccessibleText";
import { useTheme } from "../../theme/ThemeContext";
import { getLegalDocBySlug, ALL_LEGAL_DOCS, type LegalDoc } from "../../legal/legal-docs.generated";

export default function LegalScreen() {
  const { colors } = useTheme();
  // Read via hook rather than props to match the other auth-stack screens and
  // avoid importing AuthStackParamList, which would be a circular import.
  const route = useRoute<any>();
  const doc: LegalDoc | undefined = getLegalDocBySlug(route.params?.doc);

  if (!doc) {
    return (
      <ScreenWrapper>
        <AppHeader title="Not found" />
        <ScrollView contentContainerStyle={styles.content}>
          <AccessibleText variant="body" style={{ color: colors.text }}>
            That document isn't available. Known documents:{" "}
            {ALL_LEGAL_DOCS.map((d) => d.slug).join(", ")}.
          </AccessibleText>
        </ScrollView>
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper>
      <AppHeader title={doc.title} />
      <ScrollView contentContainerStyle={styles.content}>
        <Markdown
          style={{
            body: { color: colors.text, fontSize: 15, lineHeight: 23 },
            heading1: { color: colors.text, fontSize: 22, fontWeight: "800", marginTop: 4 },
            heading2: { color: colors.text, fontSize: 18, fontWeight: "700", marginTop: 20 },
            heading3: { color: colors.text, fontSize: 16, fontWeight: "700", marginTop: 16 },
            link: { color: colors.primary, fontWeight: "600" },
            strong: { fontWeight: "700" },
            table: { borderColor: colors.border, borderWidth: 1, borderRadius: 6 },
            th: { padding: 8, backgroundColor: colors.surface },
            td: { padding: 8, borderColor: colors.border },
            hr: { backgroundColor: colors.border },
            blockquote: {
              backgroundColor: colors.surface,
              borderLeftColor: colors.primary,
              borderLeftWidth: 3,
              paddingHorizontal: 12,
              paddingVertical: 4,
            },
            code_inline: { backgroundColor: colors.surface, color: colors.text },
          }}
        >
          {doc.markdown}
        </Markdown>
      </ScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 48 },
});
