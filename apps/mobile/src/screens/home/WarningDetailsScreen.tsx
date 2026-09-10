// ─────────────────────────────────────────────────────────────
// WarningDetailsScreen — a full-screen read view for moderation
// notifications (warnings, content removals, bans/suspensions). Replaces
// the old NotificationDetailModal popup so these notifications "open"
// somewhere real, the same as every other notification type.
// ─────────────────────────────────────────────────────────────

import React, { useEffect, useState } from "react";
import { View, StyleSheet, ScrollView, TextInput, ActivityIndicator, Alert } from "react-native";
import { AlertTriangle, Ban, ShieldAlert, Scale } from "lucide-react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import { MainStackParamList } from "../../navigation/MainNavigator";
import ScreenWrapper from "../../components/layout/ScreenWrapper";
import AppHeader from "../../components/layout/AppHeader";
import { AccessibleText } from "../../components/shared/AccessibleText";
import { AccessibleButton } from "../../components/shared/AccessibleButton";
import { useTheme } from "../../theme/ThemeContext";
import {
  checkAppealability,
  submitAppeal,
  type Appealability,
} from "@services/appealService";

type Props = {
  navigation: NativeStackNavigationProp<MainStackParamList, "WarningDetails">;
  route: RouteProp<MainStackParamList, "WarningDetails">;
};

// Mirrors the severity mapping the old NotificationDetailModal used —
// "WARNING"/"BANNED" are the account-level suspend/ban admin action
// (apps/admin/app/api/moderation/review/route.ts), a separate code path
// from the "MODERATION_*" family, both routed here identically.
function severityFor(type: string): "info" | "warning" | "danger" {
  if (type === "MODERATION_BAN" || type === "BANNED") return "danger";
  if (type === "MODERATION_WARNING" || type === "MODERATION_CONTENT_REMOVED" || type === "WARNING") return "warning";
  return "info";
}

const WarningDetailsScreen = () => {
  const navigation = useNavigation<Props["navigation"]>();
  const route = useRoute<Props["route"]>();
  const { colors, highContrast } = useTheme();

  const { title, message, type, relatedId, time, auditLogId } = route.params;
  const severity = severityFor(type);

  // ── Appeals (Community Guidelines) ──────────────────────────
  // The Guidelines promise "the Appeal button on the notice we sent you",
  // within 30 days. The notice carries the admin_audit_log id of the decision,
  // so the appeal is tied to a specific dated action by a named admin.
  const [eligibility, setEligibility] = useState<Appealability | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [grounds, setGrounds] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!auditLogId) return;
    let cancelled = false;
    checkAppealability(auditLogId)
      .then((result) => {
        if (!cancelled) setEligibility(result);
      })
      .catch(() => {
        // Non-fatal: the notice still reads fine without the Appeal button.
      });
    return () => {
      cancelled = true;
    };
  }, [auditLogId]);

  const handleSubmitAppeal = async () => {
    if (!auditLogId) return;
    if (!grounds.trim()) {
      Alert.alert("Tell us why", "Please explain why you think this decision was wrong.");
      return;
    }
    setSubmitting(true);
    try {
      const result = await submitAppeal({ auditLogId, grounds: grounds.trim() });
      const due = new Date(result.dueBy).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
      setShowForm(false);
      setGrounds("");
      setEligibility({
        appealable: false,
        reason: "already_appealed",
        existing: { referenceCode: result.referenceCode, status: "SUBMITTED" },
      });
      Alert.alert(
        "Appeal submitted",
        `${result.message}\n\nReference: ${result.referenceCode}\nWe'll respond by ${due}.`
      );
    } catch (err: any) {
      Alert.alert(
        "Couldn't submit",
        err?.response?.data?.message || "Please check your connection and try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const accentColor = severity === "danger" ? "#DC2626" : severity === "warning" ? "#D97706" : "#7C3AED";
  const iconBg = severity === "danger" ? "#FDECEC" : severity === "warning" ? "#FEF3C7" : "#F0EAF9";
  const Icon = severity === "danger" ? Ban : severity === "warning" ? AlertTriangle : ShieldAlert;

  const cardBorder = highContrast
    ? { borderWidth: 2, borderColor: "#000000" as const }
    : { borderWidth: 1, borderColor: "rgba(0,0,0,0.05)" as const };

  return (
    <ScreenWrapper statusBarStyle="dark">
      <AppHeader title="Warning Details" onBackPress={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={[styles.card, { backgroundColor: colors.card }, cardBorder]}>
          <View style={[styles.iconCircle, { backgroundColor: iconBg }]}>
            <Icon size={30} strokeWidth={2} color={accentColor} />
          </View>

          <AccessibleText style={[styles.title, { color: colors.text }]}>{title}</AccessibleText>

          {!!time && (
            <AccessibleText variant="caption" style={[styles.time, { color: colors.subtext }]}>
              {time}
            </AccessibleText>
          )}

          {/* Preserves the \n\n paragraph breaks from buildModerationMessage
              (reason, group, flagged-content preview). */}
          <AccessibleText style={[styles.message, { color: colors.text }]}>{message}</AccessibleText>
        </View>

        {/* APPEAL — only for enforcement notices that carry a decision id. */}
        {!!auditLogId && eligibility && (
          <View style={[styles.card, { backgroundColor: colors.card }, cardBorder]}>
            <View style={[styles.iconCircle, { backgroundColor: "#F0EAF9" }]}>
              <Scale size={26} strokeWidth={2} color="#7C3AED" />
            </View>

            {eligibility.appealable ? (
              <>
                <AccessibleText style={[styles.title, { color: colors.text }]}>
                  Think we got this wrong?
                </AccessibleText>
                <AccessibleText style={[styles.message, { color: colors.subtext }]}>
                  You can appeal this decision until{" "}
                  {new Date(eligibility.deadline).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                  . Someone who wasn't involved in the original decision will review it.
                </AccessibleText>

                {showForm ? (
                  <View style={{ alignSelf: "stretch", marginTop: 14, gap: 10 }}>
                    <TextInput
                      style={[
                        styles.input,
                        {
                          backgroundColor: colors.surface,
                          color: colors.text,
                          borderColor: colors.border,
                        },
                      ]}
                      placeholder="Why do you think this decision was wrong?"
                      placeholderTextColor={colors.subtext}
                      value={grounds}
                      onChangeText={setGrounds}
                      multiline
                      numberOfLines={5}
                      maxLength={5000}
                      textAlignVertical="top"
                      editable={!submitting}
                      accessibilityLabel="Grounds for your appeal"
                    />
                    <AccessibleButton
                      accessibilityLabel="Submit appeal"
                      onPress={handleSubmitAppeal}
                      disabled={submitting}
                    >
                      {submitting ? <ActivityIndicator color="#fff" /> : "Submit appeal"}
                    </AccessibleButton>
                    <AccessibleButton
                      variant="secondary"
                      accessibilityLabel="Cancel appeal"
                      onPress={() => setShowForm(false)}
                      disabled={submitting}
                    >
                      Cancel
                    </AccessibleButton>
                  </View>
                ) : (
                  <AccessibleButton
                    style={[styles.button, { alignSelf: "stretch", marginTop: 14 }]}
                    accessibilityLabel="Appeal this decision"
                    accessibilityHint="Opens a form to explain why you think this decision was wrong"
                    onPress={() => setShowForm(true)}
                  >
                    Appeal this decision
                  </AccessibleButton>
                )}
              </>
            ) : (
              <>
                <AccessibleText style={[styles.title, { color: colors.text }]}>
                  {eligibility.reason === "already_appealed"
                    ? "Appeal submitted"
                    : eligibility.reason === "window_closed"
                      ? "The appeal window has closed"
                      : "Appeals"}
                </AccessibleText>
                <AccessibleText style={[styles.message, { color: colors.subtext }]}>
                  {eligibility.reason === "already_appealed"
                    ? `We've received your appeal (${eligibility.existing?.referenceCode}) and will respond. You'll see the outcome here.`
                    : eligibility.reason === "window_closed"
                      ? "Appeals must be made within 30 days of the decision. You can still contact our Grievance Officer from Profile → Contact Support."
                      : "This decision can't be appealed from here. Contact support if you need help."}
                </AccessibleText>
              </>
            )}
          </View>
        )}

        {!!relatedId && (
          <AccessibleButton
            variant="secondary"
            style={styles.button}
            onPress={() =>
              (navigation as any).navigate("Chats", {
                screen: "GroupChat",
                params: { conversationId: relatedId, groupName: "Group Chat" },
              })
            }
            accessibilityLabel="View conversation"
            accessibilityHint="Opens the group chat this warning refers to"
          >
            View Conversation
          </AccessibleButton>
        )}
      </ScrollView>
    </ScreenWrapper>
  );
};

export default WarningDetailsScreen;

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
  },
  card: {
    borderRadius: 20,
    padding: 22,
    alignItems: "center",
    marginBottom: 20,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 19,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 6,
  },
  time: {
    marginBottom: 16,
  },
  message: {
    fontSize: 14,
    lineHeight: 21,
    textAlign: "left",
    alignSelf: "stretch",
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    fontSize: 14,
    minHeight: 110,
  },
  button: {
    minHeight: 54,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
});
