import React, { useEffect, useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  ActivityIndicator,
} from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RouteProp } from "@react-navigation/native";
import { ChatsStackParamList } from "@navigation/ChatsStack";

import ScreenWrapper from "../../components/layout/ScreenWrapper";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft, User, MessageCircle, Phone, Video, FileText, Ban, Flag } from "lucide-react-native";
import { submitReport } from "@services/reportService";
import { chatService } from "@services/chatService";
import { REPORT_REASONS, ReportReason } from "../../constants/reportReasons";
import { useTheme } from "../../theme/ThemeContext";
import { AccessibleText } from "../../components/shared/AccessibleText";
import { AccessibleButton } from "../../components/shared/AccessibleButton";

// ─────────────────────────────────────────────────────────
// User Profile Screen
//
// Shown when tapping on a user's avatar or name in a chat.
// Shows basic profile info + quick actions (message, call).
// ─────────────────────────────────────────────────────────

type Props = {
  navigation: NativeStackNavigationProp<ChatsStackParamList, "UserProfile">;
  route: RouteProp<ChatsStackParamList, "UserProfile">;
};


const UserProfileScreen = ({ navigation, route }: Props) => {
  const { userId, userName } = route.params;
  const insets = useSafeAreaInsets();
  const { colors, highContrast } = useTheme();
  const [showReportSheet, setShowReportSheet] = useState(false);
  const [submittingReport, setSubmittingReport] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [blockBusy, setBlockBusy] = useState(false);

  // Reflect existing block state so the button can offer Unblock. Without this
  // the only way to reverse a block was to have never made it.
  useEffect(() => {
    let cancelled = false;
    chatService
      .getBlockedIds()
      .then((ids) => {
        if (!cancelled) setIsBlocked(ids.includes(userId));
      })
      .catch(() => {
        // Non-fatal: the button still works, it just opens as "Block".
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const handleToggleBlock = () => {
    if (blockBusy) return;

    if (isBlocked) {
      Alert.alert("Unblock user", `Unblock ${userName}? You will be able to message each other again.`, [
        { text: "Cancel", style: "cancel" },
        {
          text: "Unblock",
          onPress: async () => {
            setBlockBusy(true);
            try {
              await chatService.unblockUser(userId);
              setIsBlocked(false);
            } catch {
              Alert.alert("Error", "Could not unblock this user. Please try again.");
            } finally {
              setBlockBusy(false);
            }
          },
        },
      ]);
      return;
    }

    Alert.alert(
      `Block ${userName}?`,
      // Blocking is mutual on the server (isBlockedEitherWay), so say so rather
      // than implying it only stops them contacting you.
      "They won't be able to message you, and you won't be able to message them. You can undo this from Settings.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Block",
          style: "destructive",
          onPress: async () => {
            setBlockBusy(true);
            try {
              await chatService.blockUser(userId);
              setIsBlocked(true);
              Alert.alert("Blocked", `You have blocked ${userName}.`);
            } catch {
              Alert.alert("Error", "Could not block this user. Please try again.");
            } finally {
              setBlockBusy(false);
            }
          },
        },
      ]
    );
  };

  // Standard card outline — subtle in normal mode, solid black under high
  // contrast — for card-like containers.
  const cardBorder = highContrast
    ? { borderWidth: 2, borderColor: "#000000" }
    : { borderWidth: 1, borderColor: "rgba(0,0,0,0.05)" };

  const handleReportUser = () => setShowReportSheet(true);

  const handleSelectReason = async (reason: ReportReason) => {
    setShowReportSheet(false);
    setSubmittingReport(true);
    try {
      const { referenceCode } = await submitReport({
        targetType: "USER",
        targetId: userId,
        reason,
      });
      Alert.alert(
        "Report submitted",
        `Thank you. Our moderation team will review this report.\n\nReference: ${referenceCode}`,
        [{ text: "OK" }]
      );
    } catch {
      Alert.alert("Error", "Could not submit report. Please try again.");
    } finally {
      setSubmittingReport(false);
    }
  };

  return (
    <ScreenWrapper statusBarStyle="light">
      {/* ── Header with gradient ─────────────────────────── */}
      <View style={[styles.header, { paddingTop: insets.top + 8, backgroundColor: colors.primary }]}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <ArrowLeft size={24} color={colors.white} strokeWidth={2.2} />
        </TouchableOpacity>
        <AccessibleText variant="subtitle" style={[styles.headerTitle, { color: colors.white }]}>Profile</AccessibleText>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* ── Avatar Card ──────────────────────────────────── */}
        <View style={[styles.profileCard, { backgroundColor: colors.card, shadowColor: colors.primary }, cardBorder]}>
          <View style={[styles.avatarLarge, { backgroundColor: colors.surface, borderColor: colors.primary }]}>
            <User size={44} color={colors.primary} strokeWidth={1.9} />
          </View>
          <AccessibleText variant="title" style={[styles.profileName, { color: colors.text }]}>{userName}</AccessibleText>
          <AccessibleText variant="body" style={[styles.profileRole, { color: colors.subtext }]}>Therapist • Physiotherapy</AccessibleText>

          <View style={styles.statusRow}>
            <View style={[styles.onlineDot, { backgroundColor: highContrast ? colors.text : "#22C55E" }]} />
            <AccessibleText variant="caption" style={[styles.statusText, { color: highContrast ? colors.text : "#22C55E" }]}>Online</AccessibleText>
          </View>

          {/* Quick Actions */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: colors.surface }]}
              accessibilityRole="button"
              accessibilityLabel="Message"
              accessibilityHint="Opens a direct message conversation with this user"
            >
              <MessageCircle size={22} color={colors.primary} strokeWidth={2} style={styles.actionIcon} />
              <AccessibleText variant="caption" style={[styles.actionLabel, { color: colors.primary }]}>Message</AccessibleText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: colors.surface }]}
              accessibilityRole="button"
              accessibilityLabel="Call"
              accessibilityHint="Voice calling is not yet available"
            >
              <Phone size={22} color={colors.primary} strokeWidth={2} style={styles.actionIcon} />
              <AccessibleText variant="caption" style={[styles.actionLabel, { color: colors.primary }]}>Call</AccessibleText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: colors.surface }]}
              accessibilityRole="button"
              accessibilityLabel="Video call"
              accessibilityHint="Video calling is not yet available"
            >
              <Video size={22} color={colors.primary} strokeWidth={2} style={styles.actionIcon} />
              <AccessibleText variant="caption" style={[styles.actionLabel, { color: colors.primary }]}>Video</AccessibleText>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Info Section ─────────────────────────────────── */}
        <View style={[styles.infoSection, { backgroundColor: colors.card }, cardBorder]}>
          <AccessibleText variant="subtitle" style={[styles.sectionTitle, { color: colors.text }]}>About</AccessibleText>
          <AccessibleText variant="body" style={[styles.infoText, { color: colors.text }]}>
            Helping individuals with mobility challenges achieve their
            fullest potential through personalized therapy programs. 10+
            years of experience in rehabilitation medicine.
          </AccessibleText>
        </View>

        <View style={[styles.infoSection, { backgroundColor: colors.card }, cardBorder]}>
          <AccessibleText variant="subtitle" style={[styles.sectionTitle, { color: colors.text }]}>Details</AccessibleText>

          <View style={[styles.infoRow, { borderBottomColor: colors.border }]}>
            <AccessibleText variant="body" style={[styles.infoLabel, { color: colors.subtext }]}>Location</AccessibleText>
            <AccessibleText variant="body" style={[styles.infoValue, { color: colors.text }]}>Mumbai, India</AccessibleText>
          </View>
          <View style={[styles.infoRow, { borderBottomColor: colors.border }]}>
            <AccessibleText variant="body" style={[styles.infoLabel, { color: colors.subtext }]}>Member since</AccessibleText>
            <AccessibleText variant="body" style={[styles.infoValue, { color: colors.text }]}>January 2024</AccessibleText>
          </View>
          <View style={[styles.infoRow, { borderBottomColor: colors.border }]}>
            <AccessibleText variant="body" style={[styles.infoLabel, { color: colors.subtext }]}>Shared groups</AccessibleText>
            <AccessibleText variant="body" style={[styles.infoValue, { color: colors.text }]}>3 groups</AccessibleText>
          </View>
        </View>

        {/* ── Shared Media ─────────────────────────────────── */}
        <View style={[styles.infoSection, { backgroundColor: colors.card }, cardBorder]}>
          <View style={styles.sectionHeader}>
            <AccessibleText variant="subtitle" style={[styles.sectionTitle, { color: colors.text }]}>Shared Media</AccessibleText>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="View all shared media">
              <AccessibleText variant="caption" style={[styles.viewAll, { color: colors.primary }]}>View All</AccessibleText>
            </TouchableOpacity>
          </View>
          <View style={styles.mediaGrid}>
            {[1, 2, 3, 4].map((i) => (
              <View key={i} style={[styles.mediaThumbnail, { backgroundColor: colors.surface }]}>
                <FileText size={26} color={colors.subtext} strokeWidth={1.8} />
              </View>
            ))}
          </View>
        </View>

        {/* ── Danger Zone ──────────────────────────────────── */}
        <View style={styles.dangerSection}>
          <AccessibleButton
            variant="danger"
            accessibilityLabel={isBlocked ? "Unblock user" : "Block user"}
            accessibilityHint={
              isBlocked
                ? `Lets you and ${userName} message each other again`
                : `Stops you and ${userName} messaging each other`
            }
            style={styles.dangerBtn}
            onPress={handleToggleBlock}
            disabled={blockBusy}
          >
            {blockBusy ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Ban size={17} color={colors.white} strokeWidth={2} />
                <AccessibleText variant="button" style={{ color: colors.white }}>
                  {isBlocked ? "Unblock User" : "Block User"}
                </AccessibleText>
              </View>
            )}
          </AccessibleButton>
          <AccessibleButton
            variant="danger"
            accessibilityLabel="Report user"
            accessibilityHint="Report this user to the moderation team"
            style={styles.dangerBtn}
            onPress={handleReportUser}
            disabled={submittingReport}
          >
            {submittingReport ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Flag size={17} color={colors.white} strokeWidth={2} />
                <AccessibleText variant="button" style={{ color: colors.white }}>Report User</AccessibleText>
              </View>
            )}
          </AccessibleButton>
        </View>
      </ScrollView>

      {/* ── Report Reason Sheet ──────────────────────────── */}
      <Modal
        visible={showReportSheet}
        transparent
        animationType="slide"
        onRequestClose={() => setShowReportSheet(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowReportSheet(false)}
        >
          <View style={[styles.reasonSheet, { backgroundColor: colors.card }]}>
            <AccessibleText variant="subtitle" style={[styles.reasonTitle, { color: colors.text, borderBottomColor: colors.border }]}>
              Why are you reporting {userName}?
            </AccessibleText>
            {REPORT_REASONS.map(({ key: reason, label }) => (
              <TouchableOpacity
                key={reason}
                style={[styles.reasonRow, { borderBottomColor: colors.border }]}
                onPress={() => handleSelectReason(reason)}
                accessibilityRole="button"
                accessibilityLabel={label}
              >
                <AccessibleText variant="body" style={[styles.reasonLabel, { color: colors.error }]}>{label}</AccessibleText>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={[styles.reasonRow, styles.cancelRow]}
              onPress={() => setShowReportSheet(false)}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
            >
              <AccessibleText variant="body" style={[styles.cancelLabel, { color: colors.subtext }]}>Cancel</AccessibleText>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </ScreenWrapper>
  );
};

export default UserProfileScreen;

const styles = StyleSheet.create({
  // ── Header ──────────────────────────────────────────────
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
  },

  // ── Content ─────────────────────────────────────────────
  content: {
    paddingBottom: 40,
  },

  // ── Profile Card ────────────────────────────────────────
  profileCard: {
    marginHorizontal: 16,
    marginTop: -10,
    borderRadius: 20,
    alignItems: "center",
    paddingVertical: 24,
    paddingHorizontal: 20,
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 16,
    elevation: 4,
  },
  avatarLarge: {
    width: 88,
    height: 88,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 14,
    borderWidth: 3,
  },
  profileName: {
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 4,
  },
  profileRole: {
    fontSize: 14,
    marginBottom: 10,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 20,
  },
  onlineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusText: {
    fontSize: 13,
    fontWeight: "600",
  },

  // Actions
  actions: {
    flexDirection: "row",
    gap: 16,
  },
  actionBtn: {
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 14,
  },
  actionIcon: {
    marginBottom: 4,
  },
  actionLabel: {
    fontSize: 12,
    fontWeight: "600",
  },

  // ── Info Sections ───────────────────────────────────────
  infoSection: {
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 16,
    padding: 18,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 10,
  },
  viewAll: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 10,
  },
  infoText: {
    fontSize: 14,
    lineHeight: 22,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  infoLabel: {
    fontSize: 14,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: "600",
  },

  // ── Media Grid ──────────────────────────────────────────
  mediaGrid: {
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap",
  },
  mediaThumbnail: {
    width: 72,
    height: 72,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },

  // ── Danger Zone ─────────────────────────────────────────
  dangerSection: {
    marginHorizontal: 16,
    marginTop: 20,
    gap: 8,
  },
  dangerBtn: {
    padding: 16,
    borderRadius: 14,
    alignItems: "center",
    minHeight: 52,
    justifyContent: "center",
  },

  // ── Report Reason Sheet ──────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  reasonSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 32,
    paddingTop: 8,
  },
  reasonTitle: {
    fontSize: 15,
    fontWeight: "700",
    textAlign: "center",
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
  },
  reasonRow: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
  },
  reasonLabel: {
    fontSize: 15,
    textAlign: "center",
  },
  cancelRow: {
    marginTop: 8,
    borderBottomWidth: 0,
  },
  cancelLabel: {
    fontSize: 15,
    textAlign: "center",
    fontWeight: "600",
  },
});
