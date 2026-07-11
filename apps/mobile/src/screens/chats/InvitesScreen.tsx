import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
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

type Props = {
  navigation: NativeStackNavigationProp<ChatsStackParamList, "Invites">;
};

const InvitesScreen = ({ navigation }: Props) => {
  const insets = useSafeAreaInsets();
  const pendingInvites = useChatStore((s) => s.pendingInvites);
  const setPendingInvites = useChatStore((s) => s.setPendingInvites);
  const removePendingInvite = useChatStore((s) => s.removePendingInvite);
  const setConversations = useChatStore((s) => s.setConversations);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Always fetch fresh invites when the screen mounts
  useEffect(() => {
    chatService.getPendingInvites()
      .then((invites) => setPendingInvites(invites))
      .catch(console.error);
  }, []);

  const handleRespond = useCallback(async (invite: GroupInvite, action: 'accept' | 'decline') => {
    setProcessingId(invite.id);
    try {
      await chatService.respondToInvite(invite.id, action);

      // Optimistically remove from the pending list
      removePendingInvite(invite.id);

      if (action === 'accept') {
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
      <View style={styles.inviteCard}>
        <View style={styles.inviteHeader}>
          <View style={[styles.groupIcon, isCareCircle && styles.groupIconCare]}>
            isCareCircle ? <Accessibility size={22} color="#8A38F5" strokeWidth={2} /> : <Users size={22} color="#8A38F5" strokeWidth={2} />
          </View>
          <View style={styles.inviteInfo}>
            <Text style={styles.groupName}>{item.conversation?.name || "Unknown Group"}</Text>
            <Text style={styles.inviterText}>
              Invited as <Text style={{ fontWeight: '700', color: '#500088' }}>
                {item.role.charAt(0) + item.role.slice(1).toLowerCase()}
              </Text>
            </Text>
          </View>
        </View>

        {item.message ? (
          <View style={styles.messageBox}>
            <Text style={styles.messageText}>"{item.message}"</Text>
          </View>
        ) : null}

        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.btn, styles.btnDecline, isProcessing && styles.btnDisabled]}
            onPress={() => handleRespond(item, 'decline')}
            disabled={isProcessing}
          >
            <Text style={styles.btnTextDecline}>Decline</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.btn, styles.btnAccept, isProcessing && styles.btnDisabled]}
            onPress={() => handleRespond(item, 'accept')}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.btnTextAccept}>Accept</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <ScreenWrapper statusBarStyle="light">
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <ArrowLeft size={24} color="#fff" strokeWidth={2.2} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Pending Invites</Text>
        {pendingInvites.length > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{pendingInvites.length}</Text>
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
            <Inbox size={40} color="#B9A9D6" strokeWidth={1.8} style={styles.emptyIcon} />
            <Text style={styles.emptyTitle}>No pending invites</Text>
            <Text style={styles.emptySubtitle}>You're all caught up!</Text>
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
    backgroundColor: "#500088",
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
  backText: { color: "#fff", fontSize: 20, fontWeight: "700" },
  headerTitle: { color: "#fff", fontSize: 20, fontWeight: "800", flex: 1 },
  badge: {
    backgroundColor: "#fff", borderRadius: 12,
    paddingHorizontal: 8, paddingVertical: 2, minWidth: 24, alignItems: "center",
  },
  badgeText: { color: "#500088", fontSize: 12, fontWeight: "800" },
  listContent: { padding: 16, paddingBottom: 100 },
  inviteCard: {
    backgroundColor: "#fff", borderRadius: 16, padding: 16, marginBottom: 12,
    shadowColor: "#8A38F5", shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 4 }, shadowRadius: 12, elevation: 3,
  },
  inviteHeader: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  groupIcon: {
    width: 48, height: 48, borderRadius: 14, backgroundColor: "#E8E5F0",
    justifyContent: "center", alignItems: "center", marginRight: 12,
  },
  groupIconCare: { backgroundColor: "#F3EAFF" },
  groupIconText: { fontSize: 24 },
  inviteInfo: { flex: 1 },
  groupName: { fontSize: 16, fontWeight: "700", color: "#1a1a1a", marginBottom: 2 },
  inviterText: { fontSize: 13, color: "#666" },
  messageBox: {
    backgroundColor: "#F8F9FA", padding: 12, borderRadius: 12,
    marginBottom: 16, borderLeftWidth: 3, borderLeftColor: "#8A38F5",
  },
  messageText: { fontSize: 14, color: "#444", fontStyle: "italic" },
  actionRow: { flexDirection: "row", gap: 12 },
  btn: { flex: 1, height: 44, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  btnDisabled: { opacity: 0.6 },
  btnDecline: { backgroundColor: "#FEE2E2" },
  btnAccept: { backgroundColor: "#500088" },
  btnTextDecline: { color: "#EF4444", fontWeight: "700", fontSize: 15 },
  btnTextAccept: { color: "#fff", fontWeight: "700", fontSize: 15 },
  emptyState: { alignItems: "center", paddingTop: 80 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: "#1a1a1a", marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: "#666" },
});
