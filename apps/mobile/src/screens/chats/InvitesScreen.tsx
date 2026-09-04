import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
} from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { ChatsStackParamList } from "@navigation/ChatsStack";
import { useAuthStore } from "@store/authStore";
import { useChatStore, GroupInvite } from "@store/chatStore";
import { chatService } from "@services/chatService";
import ScreenWrapper from "../../components/layout/ScreenWrapper";
import { ArrowLeft, Users, Accessibility, Inbox } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../theme/ThemeContext";
import { AccessibleText } from "../../components/shared/AccessibleText";
import { AccessibleButton } from "../../components/shared/AccessibleButton";

type Props = {
  navigation: NativeStackNavigationProp<ChatsStackParamList, "Invites">;
};

const InvitesScreen = ({ navigation }: Props) => {
  const insets = useSafeAreaInsets();
  const { colors, highContrast } = useTheme();
  const pendingInvites = useChatStore((s) => s.pendingInvites);
  const setPendingInvites = useChatStore((s) => s.setPendingInvites);
  const removePendingInvite = useChatStore((s) => s.removePendingInvite);
  const setConversations = useChatStore((s) => s.setConversations);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Standard card outline — subtle in normal mode, solid black under high
  // contrast — for card-like containers/list rows.
  const cardBorder = highContrast
    ? { borderWidth: 2, borderColor: "#000000" }
    : { borderWidth: 1, borderColor: "rgba(0,0,0,0.05)" };

  // Always fetch fresh invites when the screen mounts
  useEffect(() => {
    chatService.getPendingInvites()
      .then((invites) => setPendingInvites(invites))
      .catch(console.error);
  }, []);

  const handleRespond = useCallback(async (invite: GroupInvite, action: 'accept' | 'decline') => {
    setProcessingId(invite.id);
    try {
      const result = await chatService.respondToInvite(invite.id, action);

      // Optimistically remove from the pending list
      removePendingInvite(invite.id);

      if (action === 'accept') {
        // Accepting an invite normally joins immediately. If the server says
        // the request still needs an admin's approval, we are NOT a member
        // yet — walking into the chat anyway would just show an empty
        // conversation with no explanation of why.
        if (result?.status === 'AWAITING_APPROVAL') {
          Alert.alert(
            "Request sent",
            "An admin needs to approve your request before you can open this group."
          );
          return;
        }

        // Refresh conversations so the new group appears
        try {
          const convos = await chatService.getConversations();
          setConversations(convos);
        } catch { /* non-fatal */ }

        // Navigate to the group chat
        const subType = invite.conversation?.subType as any;
        navigation.replace('GroupChat', {
          conversationId: invite.conversationId,
          groupName: invite.conversation?.name || 'Group Chat',
          subType,
        });
      }
    } catch (err: any) {
      console.error(`Failed to ${action} invite:`, err);
      Alert.alert("Error", err?.response?.data?.message || `Failed to ${action} invite.`);
    } finally {
      setProcessingId(null);
    }
  }, [navigation, removePendingInvite, setConversations]);

  const renderInvite = ({ item }: { item: GroupInvite }) => {
    const isCareCircle = item.conversation?.subType === 'CARE_CIRCLE';
    const isProcessing = processingId === item.id;

    return (
      <View style={[styles.inviteCard, { backgroundColor: colors.card, shadowColor: colors.primary }, cardBorder]}>
        <View style={styles.inviteHeader}>
          <View style={[styles.groupIcon, { backgroundColor: isCareCircle ? colors.background : colors.surface }]}>
            {isCareCircle ? <Accessibility size={22} color={colors.primary} strokeWidth={2} /> : <Users size={22} color={colors.primary} strokeWidth={2} />}
          </View>
          <View style={styles.inviteInfo}>
            <AccessibleText variant="body" style={[styles.groupName, { color: colors.text }]}>{item.conversation?.name || "Unknown Group"}</AccessibleText>
            <AccessibleText variant="caption" style={[styles.inviterText, { color: colors.subtext }]}>
              Invited as{" "}
              <AccessibleText variant="caption" style={{ fontWeight: '700', color: colors.primary }}>
                {item.role.charAt(0) + item.role.slice(1).toLowerCase()}
              </AccessibleText>
            </AccessibleText>
          </View>
        </View>

        {item.message ? (
          <View style={[styles.messageBox, { backgroundColor: colors.surface, borderLeftColor: colors.primary }]}>
            <AccessibleText variant="body" style={[styles.messageText, { color: colors.text }]}>"{item.message}"</AccessibleText>
          </View>
        ) : null}

        <View style={styles.actionRow}>
          <AccessibleButton
            variant="danger"
            accessibilityLabel={`Decline invite to ${item.conversation?.name || "group"}`}
            style={[styles.btn, styles.btnDecline, isProcessing && styles.btnDisabled]}
            onPress={() => handleRespond(item, 'decline')}
            disabled={isProcessing}
          >
            Decline
          </AccessibleButton>
          <AccessibleButton
            variant="primary"
            accessibilityLabel={`Accept invite to ${item.conversation?.name || "group"}`}
            style={[styles.btn, styles.btnAccept, isProcessing && styles.btnDisabled]}
            onPress={() => handleRespond(item, 'accept')}
            disabled={isProcessing}
          >
            {isProcessing ? <ActivityIndicator color={colors.white} size="small" /> : "Accept"}
          </AccessibleButton>
        </View>
      </View>
    );
  };

  return (
    <ScreenWrapper statusBarStyle="light">
      <View style={[styles.header, { paddingTop: insets.top + 10, backgroundColor: colors.primary }]}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <ArrowLeft size={24} color={colors.white} strokeWidth={2.2} />
        </TouchableOpacity>
        <AccessibleText variant="title" style={[styles.headerTitle, { color: colors.white }]}>Pending Invites</AccessibleText>
        {pendingInvites.length > 0 && (
          <View style={[styles.badge, { backgroundColor: colors.white }]}>
            <AccessibleText variant="caption" style={[styles.badgeText, { color: colors.primary }]}>{pendingInvites.length}</AccessibleText>
          </View>
        )}
      </View>

      <FlatList
        data={pendingInvites}
        keyExtractor={(item) => item.id}
        renderItem={renderInvite}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Inbox size={40} color={colors.subtext} strokeWidth={1.8} style={styles.emptyIcon} />
            <AccessibleText variant="title" style={[styles.emptyTitle, { color: colors.text }]}>No pending invites</AccessibleText>
            <AccessibleText variant="body" style={[styles.emptySubtitle, { color: colors.subtext }]}>You're all caught up!</AccessibleText>
          </View>
        }
      />
    </ScreenWrapper>
  );
};

export default InvitesScreen;

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.15)",
    justifyContent: "center", alignItems: "center", marginRight: 12,
  },
  headerTitle: { fontSize: 20, fontWeight: "800", flex: 1 },
  badge: {
    borderRadius: 12,
    paddingHorizontal: 8, paddingVertical: 2, minWidth: 24, alignItems: "center",
  },
  badgeText: { fontSize: 12, fontWeight: "800" },
  listContent: { padding: 16, paddingBottom: 100 },
  inviteCard: {
    borderRadius: 16, padding: 16, marginBottom: 12,
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 4 }, shadowRadius: 12, elevation: 3,
  },
  inviteHeader: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  groupIcon: {
    width: 48, height: 48, borderRadius: 14,
    justifyContent: "center", alignItems: "center", marginRight: 12,
  },
  inviteInfo: { flex: 1 },
  groupName: { fontSize: 16, fontWeight: "700", marginBottom: 2 },
  inviterText: { fontSize: 13 },
  messageBox: {
    padding: 12, borderRadius: 12,
    marginBottom: 16, borderLeftWidth: 3,
  },
  messageText: { fontSize: 14, fontStyle: "italic" },
  actionRow: { flexDirection: "row", gap: 12 },
  btn: { flex: 1, minHeight: 48, borderRadius: 12, justifyContent: "center", alignItems: "center", paddingVertical: 10 },
  btnDisabled: { opacity: 0.6 },
  // Colors are now owned by AccessibleButton's variant ("danger" / "primary");
  // these stay as empty composition slots for layout-only overrides.
  btnDecline: {},
  btnAccept: {},
  emptyState: { alignItems: "center", paddingTop: 80 },
  emptyIcon: { marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: "700", marginBottom: 8 },
  emptySubtitle: { fontSize: 14 },
});
