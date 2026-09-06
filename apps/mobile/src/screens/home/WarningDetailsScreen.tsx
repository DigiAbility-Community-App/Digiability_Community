// ─────────────────────────────────────────────────────────────
// WarningDetailsScreen — a full-screen read view for moderation
// notifications (warnings, content removals, bans/suspensions). Replaces
// the old NotificationDetailModal popup so these notifications "open"
// somewhere real, the same as every other notification type.
// ─────────────────────────────────────────────────────────────

import React from "react";
import { View, StyleSheet, ScrollView } from "react-native";
import { AlertTriangle, Ban, ShieldAlert } from "lucide-react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import { MainStackParamList } from "../../navigation/MainNavigator";
import ScreenWrapper from "../../components/layout/ScreenWrapper";
import AppHeader from "../../components/layout/AppHeader";
import { AccessibleText } from "../../components/shared/AccessibleText";
import { AccessibleButton } from "../../components/shared/AccessibleButton";
import { useTheme } from "../../theme/ThemeContext";

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

  const { title, message, type, relatedId, time } = route.params;
  const severity = severityFor(type);

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
  button: {
    minHeight: 54,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
});
