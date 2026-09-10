import React, { useState } from "react";
import { Modal, View, StyleSheet, ScrollView, ActivityIndicator, Alert } from "react-native";
import { useNavigation, useNavigationState } from "@react-navigation/native";
import { FileText } from "lucide-react-native";
import { useAuthStore } from "@store/authStore";
import { acceptPolicies } from "@services/privacyService";
import { getMe } from "@services/authService";
import { useTheme } from "../../theme/ThemeContext";
import { AccessibleText } from "../shared/AccessibleText";
import { AccessibleButton } from "../shared/AccessibleButton";

// ─────────────────────────────────────────────────────────────
// Policy Re-acceptance Gate
//
// Shown when /api/auth/me reports policyReacceptanceRequired — i.e. the user
// has never accepted the Terms/Guidelines, or accepted an older version.
//
// This is the single interception point for "you must agree before you carry
// on". Bumping POLICY_VERSION in docs/legal/manifest.json puts every existing
// user through here, which is also how the annual-notice obligation is met.
//
// Deliberately not dismissable via a close button or backdrop tap — the
// acceptance gate is the point, and skipping it isn't an option. But that
// only holds up if the user can actually READ what they're agreeing to:
// "Read Terms of Use" navigates to the Legal screen, and since this Modal
// lives at the navigator root (not inside any one screen), its native
// overlay would otherwise stay rendered on top of Legal too, making the
// policy text itself unreadable — forcing a blind "I agree". So the gate
// hides itself specifically while the Legal screen is focused, and
// reappears the moment the user navigates away from it (back button),
// since policyReacceptanceRequired is still true until they actually agree.
// ─────────────────────────────────────────────────────────────

function getFocusedRouteName(state: any): string | undefined {
  if (!state) return undefined;
  const route = state.routes?.[state.index ?? 0];
  return route?.state ? getFocusedRouteName(route.state) : route?.name;
}

export function PolicyReacceptanceGate() {
  const { colors, highContrast } = useTheme();
  const navigation = useNavigation<any>();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const [submitting, setSubmitting] = useState(false);
  const focusedRouteName = useNavigationState(getFocusedRouteName);

  const visible = Boolean(user?.policyReacceptanceRequired) && focusedRouteName !== "Legal";

  const handleAccept = async () => {
    setSubmitting(true);
    try {
      await acceptPolicies();
      // Re-read from the server rather than flipping the flag locally, so the
      // client can't disagree with what was actually recorded.
      const refreshed = await getMe();
      setUser(refreshed);
    } catch {
      Alert.alert(
        "Couldn't save",
        "We couldn't record your acceptance just now. Please check your connection and try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const openDoc = (doc: "terms" | "community-guidelines") =>
    navigation.navigate("Legal", { doc });

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => {}}>
      <View style={styles.backdrop}>
        <View
          style={[
            styles.card,
            { backgroundColor: colors.card },
            highContrast && { borderWidth: 2, borderColor: "#000000" },
          ]}
        >
          <ScrollView contentContainerStyle={styles.body}>
            <View style={[styles.iconCircle, { backgroundColor: colors.surface }]}>
              <FileText size={26} color={colors.primary} strokeWidth={2} />
            </View>

            <AccessibleText variant="subtitle" style={{ color: colors.text, textAlign: "center" }}>
              We've updated our policies
            </AccessibleText>

            <AccessibleText
              variant="body"
              style={{ color: colors.subtext, textAlign: "center", lineHeight: 21 }}
            >
              Please review and accept the latest Terms of Use and Community Guidelines to
              continue using DigiAbility Community.
            </AccessibleText>

            <AccessibleButton
              variant="secondary"
              accessibilityLabel="Read the Terms of Use"
              style={styles.linkBtn}
              onPress={() => openDoc("terms")}
            >
              <AccessibleText variant="button" style={{ color: colors.primary }}>
                Read Terms of Use
              </AccessibleText>
            </AccessibleButton>

            <AccessibleButton
              variant="secondary"
              accessibilityLabel="Read the Community Guidelines"
              style={styles.linkBtn}
              onPress={() => openDoc("community-guidelines")}
            >
              <AccessibleText variant="button" style={{ color: colors.primary }}>
                Read Community Guidelines
              </AccessibleText>
            </AccessibleButton>

            <AccessibleButton
              accessibilityLabel="Accept and continue"
              accessibilityHint="Records your acceptance of the updated policies"
              onPress={handleAccept}
              disabled={submitting}
              style={styles.acceptBtn}
            >
              {submitting ? <ActivityIndicator color="#fff" /> : "I agree — continue"}
            </AccessibleButton>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    padding: 24,
  },
  card: { borderRadius: 18, maxHeight: "85%", overflow: "hidden" },
  body: { padding: 24, gap: 14, alignItems: "stretch" },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
  },
  linkBtn: { paddingVertical: 12 },
  acceptBtn: { marginTop: 6 },
});
