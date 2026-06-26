import React, { useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  Alert,
  TextInput,
  ActivityIndicator,
  Platform,
  ActionSheetIOS,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ChatsStackParamList } from "@navigation/ChatsStack";
import { useAuthStore } from "@store/authStore";
import { useChatStore } from "@store/chatStore";
import { chatService } from "@services/chatService";
import ScreenWrapper from "../../components/layout/ScreenWrapper";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Props = NativeStackScreenProps<ChatsStackParamList, "GroupInfo">;

const GroupInfoScreen = ({ navigation, route }: Props) => {
  const { conversationId } = route.params;
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);

  const conversation = useChatStore((s) => s.conversations[conversationId]);
  const updateConversation = useChatStore((s) => s.updateConversation);

  const [isUpdatingSettings, setIsUpdatingSettings] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [memberSearch, setMemberSearch] = useState("");
  const [memberSearchResults, setMemberSearchResults] = useState<{id:string;name:string;email:string}[]>([]);
  const [isSearchingMembers, setIsSearchingMembers] = useState(false);
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);

  if (!conversation) {
    return (
      <ScreenWrapper>
        <Text style={{ padding: 20, textAlign: "center" }}>Group not found</Text>
      </ScreenWrapper>
    );
  }

  const isCareCircle = conversation.subType === "CARE_CIRCLE";
  const myParticipant = conversation.participants.find((p) => p.userId === user?.id);
  const myRole = myParticipant?.role;
  const isOwner = myRole === "OWNER";

  const hasAdminRights = isCareCircle
    ? myRole === "OWNER" || myRole === "CAREGIVER"
    : myRole === "OWNER" || myRole === "ADMIN";

  const canEditInfo = conversation.editGroupInfo === "ALL_MEMBERS" || hasAdminRights;
  const canAddMembers = conversation.addMembers === "ALL_MEMBERS" || hasAdminRights;

  // ── Settings Toggles ──────────────────────────────────────────
  const handleToggleSetting = async (
    setting: "editGroupInfo" | "addMembers" | "sendMessages",
    currentValue: string
  ) => {
    if (!hasAdminRights) {
      Alert.alert("Permission Denied", "Only admins can change group settings.");
      return;
    }
    const newValue = currentValue === "ALL_MEMBERS" ? "ADMINS_ONLY" : "ALL_MEMBERS";
    updateConversation(conversationId, { [setting]: newValue });
    setIsUpdatingSettings(true);
    try {
      await chatService.updateGroupSettings(conversationId, { [setting]: newValue });
    } catch {
      updateConversation(conversationId, { [setting]: currentValue });
      Alert.alert("Error", "Failed to update group settings.");
    } finally {
      setIsUpdatingSettings(false);
    }
  };

  const handleToggleApproveMembers = async () => {
    if (!hasAdminRights) {
      Alert.alert("Permission Denied", "Only admins can change group settings.");
      return;
    }
    const newValue = !(conversation.approveNewMembers ?? false);
    updateConversation(conversationId, { approveNewMembers: newValue });
    setIsUpdatingSettings(true);
    try {
      await chatService.updateGroupSettings(conversationId, { approveNewMembers: newValue });
    } catch {
      updateConversation(conversationId, { approveNewMembers: !newValue });
      Alert.alert("Error", "Failed to update group settings.");
    } finally {
      setIsUpdatingSettings(false);
    }
  };

  // ── Leave Group ───────────────────────────────────────────────
  const handleLeaveGroup = () => {
    Alert.alert(
      "Leave Group",
      `Are you sure you want to leave "${conversation.name}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Leave",
          style: "destructive",
          onPress: async () => {
            try {
              await chatService.removeMember(conversationId, user!.id);
              navigation.popToTop();
            } catch (err: any) {
              Alert.alert("Error", err?.response?.data?.message || "Failed to leave group.");
            }
          },
        },
      ]
    );
  };

  // ── Add Member Search ─────────────────────────────────────────
  const handleMemberSearchChange = useCallback((text: string) => {
    setMemberSearch(text);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (text.trim().length < 1) {
      setMemberSearchResults([]);
      return;
    }
    searchTimeout.current = setTimeout(async () => {
      setIsSearchingMembers(true);
      try {
        const results = await chatService.searchUsers(text.trim());
        const existingIds = new Set(conversation.participants.map((p) => p.userId));
        setMemberSearchResults(results.filter((r) => !existingIds.has(r.id)));
      } catch {
        setMemberSearchResults([]);
      } finally {
        setIsSearchingMembers(false);
      }
    }, 400);
  }, [conversation.participants]);

  const handleInviteMember = async (member: { id: string; name: string }) => {
    try {
      await chatService.sendInvite(conversationId, member.id, "MEMBER", `Join ${conversation.name}!`);
      Alert.alert("Invite Sent", `Invite sent to ${member.name}.`);
      setShowAddMember(false);
      setMemberSearch("");
      setMemberSearchResults([]);
    } catch (err: any) {
      Alert.alert("Error", err?.response?.data?.message || "Failed to send invite.");
    }
  };

  // ── Role / Member Actions ─────────────────────────────────────
  const handleTransferOwnership = (memberId: string, memberName: string) => {
    Alert.alert(
      "Transfer Ownership",
      `Transfer group ownership to ${memberName}? You will become an Admin.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Transfer",
          style: "destructive",
          onPress: async () => {
            try {
              await chatService.transferOwnership(conversationId, memberId);
              Alert.alert("Success", `Ownership transferred to ${memberName}`);
            } catch (err: any) {
              Alert.alert("Error", err?.response?.data?.message || "Failed to transfer ownership");
            }
          },
        },
      ]
    );
  };

  const changeRole = async (memberId: string, newRole: string) => {
    try {
      await chatService.updateMemberRole(conversationId, memberId, newRole);
    } catch (err: any) {
      Alert.alert("Error", err?.response?.data?.message || "Failed to update role");
    }
  };

  const confirmRemoveMember = (memberId: string, memberName: string) => {
    Alert.alert(
      "Remove Member",
      `Remove ${memberName} from the group?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              await chatService.removeMember(conversationId, memberId);
              updateConversation(conversationId, {
                participants: conversation.participants.filter((p) => p.userId !== memberId),
              } as any);
            } catch (err: any) {
              Alert.alert("Error", err?.response?.data?.message || "Failed to remove member");
            }
          },
        },
      ]
    );
  };

  const promptCareCircleRole = (memberId: string, _currentRole: string, memberName: string) => {
    const roles = ["MEMBER", "CAREGIVER", "MENTOR", "PROFESSIONAL"];
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ["Cancel", ...roles.map((r) => r.charAt(0) + r.slice(1).toLowerCase())], cancelButtonIndex: 0 },
        (idx) => { if (idx > 0) changeRole(memberId, roles[idx - 1]); }
      );
    } else {
      Alert.alert("Change Role", `Select a role for ${memberName}`, [
        ...roles.map((r) => ({ text: r.charAt(0) + r.slice(1).toLowerCase(), onPress: () => changeRole(memberId, r) })),
        { text: "Cancel", style: "cancel" },
      ]);
    }
  };

  const handleMemberAction = (memberId: string, currentRole: string, memberName: string) => {
    if (!hasAdminRights) return;
    if (memberId === user?.id) return;

    if (isCareCircle && (myRole === "OWNER" || myRole === "CAREGIVER")) {
      const options = isOwner
        ? ["Cancel", "Change Role", "Transfer Ownership", "Remove Member"]
        : ["Cancel", "Change Role", "Remove Member"];
      const destructiveIndex = isOwner ? 3 : 2;

      if (Platform.OS === "ios") {
        ActionSheetIOS.showActionSheetWithOptions(
          { options, cancelButtonIndex: 0, destructiveButtonIndex: destructiveIndex },
          (idx) => {
            if (idx === 1) promptCareCircleRole(memberId, currentRole, memberName);
            if (isOwner && idx === 2) handleTransferOwnership(memberId, memberName);
            if (idx === destructiveIndex) confirmRemoveMember(memberId, memberName);
          }
        );
      } else {
        const alertButtons: any[] = [
          { text: "Change Role", onPress: () => promptCareCircleRole(memberId, currentRole, memberName) },
          ...(isOwner ? [{ text: "Transfer Ownership", onPress: () => handleTransferOwnership(memberId, memberName) }] : []),
          { text: "Remove Member", style: "destructive", onPress: () => confirmRemoveMember(memberId, memberName) },
          { text: "Cancel", style: "cancel" },
        ];
        Alert.alert(memberName, "Choose an action", alertButtons);
      }
    } else if (!isCareCircle && isOwner) {
      const promoteLabel = currentRole === "ADMIN" ? "Dismiss as Admin" : "Make Admin";
      if (Platform.OS === "ios") {
        ActionSheetIOS.showActionSheetWithOptions(
          { options: ["Cancel", promoteLabel, "Transfer Ownership", "Remove Member"], cancelButtonIndex: 0, destructiveButtonIndex: 3 },
          (idx) => {
            if (idx === 1) changeRole(memberId, currentRole === "ADMIN" ? "MEMBER" : "ADMIN");
            if (idx === 2) handleTransferOwnership(memberId, memberName);
            if (idx === 3) confirmRemoveMember(memberId, memberName);
          }
        );
      } else {
        Alert.alert(memberName, "Choose an action", [
          { text: promoteLabel, onPress: () => changeRole(memberId, currentRole === "ADMIN" ? "MEMBER" : "ADMIN") },
          { text: "Transfer Ownership", onPress: () => handleTransferOwnership(memberId, memberName) },
          { text: "Remove Member", style: "destructive", onPress: () => confirmRemoveMember(memberId, memberName) },
          { text: "Cancel", style: "cancel" },
        ]);
      }
    } else if (hasAdminRights && currentRole === "MEMBER") {
      if (Platform.OS === "ios") {
        ActionSheetIOS.showActionSheetWithOptions(
          { options: ["Cancel", "Remove Member"], cancelButtonIndex: 0, destructiveButtonIndex: 1 },
          (idx) => { if (idx === 1) confirmRemoveMember(memberId, memberName); }
        );
      } else {
        Alert.alert(memberName, "Choose an action", [
          { text: "Remove Member", style: "destructive", onPress: () => confirmRemoveMember(memberId, memberName) },
          { text: "Cancel", style: "cancel" },
        ]);
      }
    }
  };

  const getInitials = (name: string) =>
    name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'OWNER': return 'Group admin';
      case 'ADMIN': return 'Admin';
      case 'CAREGIVER': return 'Caregiver';
      case 'MENTOR': return 'Mentor';
      case 'PROFESSIONAL': return 'Professional';
      default: return null;
    }
  };

  const getRoleBadgeStyle = (role: string) => {
    switch (role) {
      case 'OWNER': return { backgroundColor: '#EDE9FE', color: '#6B21A8' };
      case 'ADMIN': return { backgroundColor: '#DBEAFE', color: '#1D4ED8' };
      case 'CAREGIVER': return { backgroundColor: '#D1FAE5', color: '#065F46' };
      case 'MENTOR': return { backgroundColor: '#FEF3C7', color: '#92400E' };
      case 'PROFESSIONAL': return { backgroundColor: '#FEE2E2', color: '#991B1B' };
      default: return null;
    }
  };

  return (
    <ScreenWrapper statusBarStyle="light">
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Group Info</Text>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatarLarge}>
            <Text style={styles.avatarEmoji}>{isCareCircle ? "🦽" : "👥"}</Text>
          </View>
          <Text style={styles.groupNameLarge}>{conversation.name}</Text>
          <Text style={styles.memberCountLarge}>
            {isCareCircle ? "Care Circle" : "Group"} • {conversation.participants.length} members
          </Text>
          {conversation.description && (
            <Text style={styles.groupDescription}>{conversation.description}</Text>
          )}
        </View>

        {/* Group Settings Section */}
        {hasAdminRights && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Group Settings</Text>
            <View style={styles.settingsCard}>
              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingTitle}>Edit Group Info</Text>
                  <Text style={styles.settingSub}>Who can change group name and description</Text>
                </View>
                <Switch
                  value={conversation.editGroupInfo === "ALL_MEMBERS"}
                  onValueChange={() => handleToggleSetting("editGroupInfo", conversation.editGroupInfo || "ADMINS_ONLY")}
                  disabled={isUpdatingSettings}
                  trackColor={{ true: "#8A38F5", false: "#E8E5F0" }}
                />
              </View>
              <View style={styles.settingDivider} />
              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingTitle}>Add Members</Text>
                  <Text style={styles.settingSub}>Who can invite new members</Text>
                </View>
                <Switch
                  value={conversation.addMembers === "ALL_MEMBERS"}
                  onValueChange={() => handleToggleSetting("addMembers", conversation.addMembers || "ADMINS_ONLY")}
                  disabled={isUpdatingSettings}
                  trackColor={{ true: "#8A38F5", false: "#E8E5F0" }}
                />
              </View>
              <View style={styles.settingDivider} />
              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingTitle}>Send Messages</Text>
                  <Text style={styles.settingSub}>Who can send messages</Text>
                </View>
                <Switch
                  value={conversation.sendMessages === "ALL_MEMBERS"}
                  onValueChange={() => handleToggleSetting("sendMessages", conversation.sendMessages || "ALL_MEMBERS")}
                  disabled={isUpdatingSettings}
                  trackColor={{ true: "#8A38F5", false: "#E8E5F0" }}
                />
              </View>
              <View style={styles.settingDivider} />
              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingTitle}>Approve New Members</Text>
                  <Text style={styles.settingSub}>Admin approval required before joining</Text>
                </View>
                <Switch
                  value={conversation.approveNewMembers ?? false}
                  onValueChange={handleToggleApproveMembers}
                  disabled={isUpdatingSettings}
                  trackColor={{ true: "#8A38F5", false: "#E8E5F0" }}
                />
              </View>
            </View>
          </View>
        )}

        {/* Members Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionLabel}>Members</Text>
            {canAddMembers && (
              <TouchableOpacity style={styles.addMemberBtn} onPress={() => setShowAddMember(!showAddMember)}>
                <Text style={styles.addMemberText}>{showAddMember ? "✕ Close" : "+ Add Member"}</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Inline Add Member Search */}
          {showAddMember && (
            <View style={styles.addMemberSearch}>
              <TextInput
                style={styles.searchInput}
                placeholder="Search by name..."
                placeholderTextColor="#999"
                value={memberSearch}
                onChangeText={handleMemberSearchChange}
                autoFocus
              />
              {isSearchingMembers && <ActivityIndicator size="small" color="#8A38F5" style={{ marginTop: 8 }} />}
              {memberSearchResults.map((r) => (
                <TouchableOpacity key={r.id} style={styles.searchResultRow} onPress={() => handleInviteMember(r)}>
                  <View style={styles.memberAvatar}>
                    <Text style={styles.memberAvatarText}>{getInitials(r.name)}</Text>
                  </View>
                  <View style={styles.memberInfo}>
                    <Text style={styles.memberName}>{r.name}</Text>
                    <Text style={styles.memberEmail}>{r.email}</Text>
                  </View>
                  <Text style={styles.inviteBtn}>Invite</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <View style={styles.membersCard}>
            {conversation.participants.map((p, index) => {
              const roleLabel = getRoleLabel(p.role);
              const roleBadge = getRoleBadgeStyle(p.role);
              const name = p.user?.name || 'Unknown';
              const isMe = p.userId === user?.id;
              return (
                <TouchableOpacity
                  key={p.userId}
                  style={[styles.memberRow, index < conversation.participants.length - 1 && styles.memberBorder]}
                  onPress={() => handleMemberAction(p.userId, p.role, name)}
                  disabled={!hasAdminRights || isMe}
                  activeOpacity={0.7}
                >
                  <View style={styles.memberAvatar}>
                    <Text style={styles.memberAvatarText}>{getInitials(name)}</Text>
                  </View>
                  <View style={styles.memberInfo}>
                    <Text style={styles.memberName}>
                      {name}{isMe ? <Text style={styles.youTag}> (You)</Text> : null}
                    </Text>
                    {roleLabel && roleBadge && (
                      <View style={[styles.rolePill, { backgroundColor: roleBadge.backgroundColor }]}>
                        <Text style={[styles.rolePillText, { color: roleBadge.color }]}>{roleLabel}</Text>
                      </View>
                    )}
                  </View>
                  {hasAdminRights && !isMe && p.role !== 'OWNER' && (
                    <Text style={styles.chevron}>›</Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Leave Group — only for non-owners */}
        {!isOwner && (
          <View style={styles.section}>
            <TouchableOpacity style={styles.leaveBtn} onPress={handleLeaveGroup}>
              <Text style={styles.leaveBtnText}>Leave Group</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </ScreenWrapper>
  );
};

export default GroupInfoScreen;

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
  headerTitle: { color: "#fff", fontSize: 20, fontWeight: "800" },
  content: { flex: 1, backgroundColor: "#F6F6F6" },
  profileCard: {
    alignItems: "center", paddingVertical: 30, paddingHorizontal: 20,
    backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#E8E5F0", marginBottom: 20,
  },
  avatarLarge: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: "#F3EAFF",
    justifyContent: "center", alignItems: "center", marginBottom: 16,
  },
  avatarEmoji: { fontSize: 40 },
  groupNameLarge: { fontSize: 24, fontWeight: "800", color: "#1a1a1a", marginBottom: 4, textAlign: "center" },
  memberCountLarge: { fontSize: 14, color: "#666", fontWeight: "500" },
  groupDescription: { marginTop: 12, fontSize: 14, color: "#444", textAlign: "center", lineHeight: 20 },
  section: { marginBottom: 24 },
  sectionLabel: {
    fontSize: 14, fontWeight: "700", color: "#6B21A8",
    marginLeft: 16, marginBottom: 8, textTransform: "uppercase",
  },
  settingsCard: { backgroundColor: "#fff", borderTopWidth: 1, borderBottomWidth: 1, borderColor: "#E8E5F0" },
  settingRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 14, paddingHorizontal: 16 },
  settingDivider: { height: 1, backgroundColor: "#E8E5F0", marginLeft: 16 },
  settingInfo: { flex: 1, paddingRight: 16 },
  settingTitle: { fontSize: 16, fontWeight: "600", color: "#1a1a1a", marginBottom: 2 },
  settingSub: { fontSize: 13, color: "#666" },
  sectionHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingRight: 16 },
  addMemberBtn: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: "#E8E5F0", borderRadius: 12, marginBottom: 8 },
  addMemberText: { color: "#500088", fontSize: 12, fontWeight: "700" },
  addMemberSearch: {
    marginHorizontal: 16, marginBottom: 12, backgroundColor: "#fff",
    borderRadius: 16, padding: 12, borderWidth: 1, borderColor: "#E8E5F0",
  },
  searchInput: {
    backgroundColor: "#F6F6F6", borderRadius: 12, paddingHorizontal: 12,
    paddingVertical: 10, fontSize: 15, color: "#1a1a1a",
  },
  searchResultRow: {
    flexDirection: "row", alignItems: "center", paddingVertical: 10, borderTopWidth: 1, borderTopColor: "#f5f0fa",
  },
  membersCard: { backgroundColor: "#fff", borderTopWidth: 1, borderBottomWidth: 1, borderColor: "#E8E5F0" },
  memberRow: { flexDirection: "row", alignItems: "center", paddingVertical: 12, paddingHorizontal: 16 },
  memberBorder: { borderBottomWidth: 1, borderBottomColor: "#f5f0fa" },
  memberAvatar: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: "#E8E5F0",
    justifyContent: "center", alignItems: "center", marginRight: 12,
  },
  memberAvatarText: { fontSize: 14, fontWeight: "700", color: "#666" },
  memberInfo: { flex: 1 },
  memberName: { fontSize: 16, fontWeight: "600", color: "#1a1a1a" },
  memberEmail: { fontSize: 12, color: "#999", marginTop: 1 },
  youTag: { fontSize: 13, fontWeight: "400", color: "#999" },
  rolePill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8, paddingVertical: 2,
    borderRadius: 10, marginTop: 3,
  },
  rolePillText: { fontSize: 11, fontWeight: "700" },
  chevron: { fontSize: 20, color: "#ccc", paddingLeft: 10 },
  inviteBtn: { fontSize: 13, fontWeight: "700", color: "#500088", paddingHorizontal: 8 },
  leaveBtn: {
    marginHorizontal: 16, paddingVertical: 16, backgroundColor: "#fff",
    borderRadius: 16, borderWidth: 1, borderColor: "#fca5a5", alignItems: "center",
  },
  leaveBtnText: { fontSize: 16, fontWeight: "700", color: "#dc2626" },
});
