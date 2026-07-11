import React, { useState, useCallback, useRef, useEffect } from "react";
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
import { ArrowLeft, Users, Accessibility, SquarePen, Bell, BellOff, ChevronRight, X, Plus } from "lucide-react-native";

type Props = NativeStackScreenProps<ChatsStackParamList, "GroupInfo">;

const GroupInfoScreen = ({ navigation, route }: Props) => {
  const { conversationId } = route.params;
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);

  const conversation = useChatStore((s) => s.conversations[conversationId]);
  const updateConversation = useChatStore((s) => s.updateConversation);
  const setConversations = useChatStore((s) => s.setConversations);

  const [isUpdatingSettings, setIsUpdatingSettings] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [memberSearch, setMemberSearch] = useState("");
  const [memberSearchResults, setMemberSearchResults] = useState<{id:string;name:string;email:string}[]>([]);
  const [isSearchingMembers, setIsSearchingMembers] = useState(false);
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);

  // Edit group info form
  const [isEditingInfo, setIsEditingInfo] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [isSavingInfo, setIsSavingInfo] = useState(false);

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

  // ── Join requests (admin approval) ───────────────────────────
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [processingRequestId, setProcessingRequestId] = useState<string | null>(null);

  const loadPendingRequests = useCallback(async () => {
    if (!hasAdminRights) return;
    try {
      const invites = await chatService.getGroupInvites(conversationId);
      setPendingRequests(invites.filter((i: any) => i.status === "AWAITING_APPROVAL"));
    } catch (err) {
      console.error("Failed to load join requests", err);
    }
  }, [conversationId, hasAdminRights]);

  useEffect(() => {
    loadPendingRequests();
  }, [loadPendingRequests]);

  const handleRespondToRequest = async (inviteId: string, approve: boolean) => {
    setProcessingRequestId(inviteId);
    try {
      await chatService.approveJoinRequest(inviteId, approve);
      setPendingRequests((prev) => prev.filter((r) => r.id !== inviteId));
      if (approve) {
        // Refresh members so the newly-approved user shows up.
        chatService.getConversations().then((convos) => setConversations(convos)).catch(() => {});
      }
    } catch (err: any) {
      Alert.alert("Error", err?.response?.data?.message || "Could not process the request.");
    } finally {
      setProcessingRequestId(null);
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

  // ── Edit Group Info (name / description) ──────────────────────
  const openEditInfo = () => {
    if (!canEditInfo) {
      Alert.alert("Permission Denied", "You don't have permission to edit group info.");
      return;
    }
    setEditName(conversation.name || "");
    setEditDesc(conversation.description || "");
    setIsEditingInfo(true);
  };

  const handleSaveInfo = async () => {
    const name = editName.trim();
    if (!name) {
      Alert.alert("Name Required", "Group name cannot be empty.");
      return;
    }
    setIsSavingInfo(true);
    const prev = { name: conversation.name, description: conversation.description };
    updateConversation(conversationId, { name, description: editDesc.trim() });
    try {
      await chatService.updateGroupInfo(conversationId, { name, description: editDesc.trim() });
      setIsEditingInfo(false);
    } catch (err: any) {
      updateConversation(conversationId, prev as any);
      Alert.alert("Error", err?.response?.data?.message || "Failed to update group info.");
    } finally {
      setIsSavingInfo(false);
    }
  };

  // ── Mute / Unmute ─────────────────────────────────────────────
  const isMuted = myParticipant?.isMuted ?? false;
  const handleToggleMute = async () => {
    const newValue = !isMuted;
    // Optimistic update on the participant
    const updatedParticipants = conversation.participants.map((p) =>
      p.userId === user?.id ? { ...p, isMuted: newValue } : p
    );
    updateConversation(conversationId, { participants: updatedParticipants } as any);
    try {
      await chatService.muteConversation(conversationId, newValue);
    } catch {
      updateConversation(conversationId, { participants: conversation.participants } as any);
      Alert.alert("Error", "Failed to update mute setting.");
    }
  };

  // ── Delete Group (owner only) ─────────────────────────────────
  const handleDeleteGroup = () => {
    Alert.alert(
      "Delete Group",
      `Permanently delete "${conversation.name}"? This removes it for all members and cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await chatService.deleteGroup(conversationId);
              navigation.popToTop();
            } catch (err: any) {
              Alert.alert("Error", err?.response?.data?.message || "Failed to delete group.");
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
          <ArrowLeft size={24} color="#fff" strokeWidth={2.2} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Group Info</Text>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatarLarge}>
            {isCareCircle
              ? <Accessibility size={40} color="#8A38F5" strokeWidth={1.9} />
              : <Users size={40} color="#8A38F5" strokeWidth={1.9} />}
          </View>

          {isEditingInfo ? (
            <View style={styles.editForm}>
              <TextInput
                style={styles.editNameInput}
                value={editName}
                onChangeText={setEditName}
                placeholder="Group name"
                placeholderTextColor="#999"
                maxLength={100}
                autoFocus
              />
              <TextInput
                style={styles.editDescInput}
                value={editDesc}
                onChangeText={setEditDesc}
                placeholder="Add a description (optional)"
                placeholderTextColor="#999"
                maxLength={500}
                multiline
              />
              <View style={styles.editActions}>
                <TouchableOpacity style={styles.editCancelBtn} onPress={() => setIsEditingInfo(false)} disabled={isSavingInfo}>
                  <Text style={styles.editCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.editSaveBtn} onPress={handleSaveInfo} disabled={isSavingInfo}>
                  {isSavingInfo ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.editSaveText}>Save</Text>}
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <>
              <View style={styles.nameRow}>
                <Text style={styles.groupNameLarge}>{conversation.name}</Text>
                {canEditInfo && (
                  <TouchableOpacity style={styles.editIconBtn} onPress={openEditInfo}>
                    <SquarePen size={17} color="#500088" strokeWidth={2} />
                  </TouchableOpacity>
                )}
              </View>
              <Text style={styles.memberCountLarge}>
                {isCareCircle ? "Care Circle" : "Group"} • {conversation.participants.length} members
              </Text>
              {conversation.description ? (
                <Text style={styles.groupDescription}>{conversation.description}</Text>
              ) : null}
            </>
          )}

          {/* Mute toggle — available to all members */}
          <TouchableOpacity style={styles.muteRow} onPress={handleToggleMute}>
            {isMuted
              ? <Bell size={16} color="#500088" strokeWidth={2} />
              : <BellOff size={16} color="#500088" strokeWidth={2} />}
            <Text style={styles.muteText}>{isMuted ? "Unmute Notifications" : "Mute Notifications"}</Text>
          </TouchableOpacity>
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

        {/* Pending Join Requests (admins only) */}
        {hasAdminRights && pendingRequests.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>
              Pending Requests ({pendingRequests.length})
            </Text>
            {pendingRequests.map((req) => (
              <View key={req.id} style={styles.requestRow}>
                <View style={styles.requestAvatar}>
                  <Text style={styles.requestAvatarText}>
                    {(req.inviteeName || "?").charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.requestName} numberOfLines={1}>{req.inviteeName}</Text>
                  <Text style={styles.requestSub}>wants to join</Text>
                </View>
                {processingRequestId === req.id ? (
                  <ActivityIndicator size="small" color="#8A38F5" />
                ) : (
                  <View style={styles.requestActions}>
                    <TouchableOpacity
                      style={styles.rejectBtn}
                      onPress={() => handleRespondToRequest(req.id, false)}
                    >
                      <Text style={styles.rejectBtnText}>Reject</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.approveBtn}
                      onPress={() => handleRespondToRequest(req.id, true)}
                    >
                      <Text style={styles.approveBtnText}>Approve</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Members Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionLabel}>Members</Text>
            {canAddMembers && (
              <TouchableOpacity style={[styles.addMemberBtn, { flexDirection: "row", alignItems: "center", gap: 4 }]} onPress={() => setShowAddMember(!showAddMember)}>
                {showAddMember ? <X size={14} color="#500088" strokeWidth={2.4} /> : <Plus size={14} color="#500088" strokeWidth={2.4} />}
                <Text style={styles.addMemberText}>{showAddMember ? "Close" : "Add Member"}</Text>
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
                    <ChevronRight size={20} color="#ccc" strokeWidth={2} style={{ marginLeft: 10 }} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Leave Group — non-owners; Delete Group — owner */}
        <View style={styles.section}>
          {isOwner ? (
            <TouchableOpacity style={styles.deleteBtn} onPress={handleDeleteGroup}>
              <Text style={styles.deleteBtnText}>Delete Group</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.leaveBtn} onPress={handleLeaveGroup}>
              <Text style={styles.leaveBtnText}>Leave Group</Text>
            </TouchableOpacity>
          )}
        </View>
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
  requestRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: "#fff", paddingVertical: 12, paddingHorizontal: 16,
    borderTopWidth: 1, borderColor: "#E8E5F0",
  },
  requestAvatar: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: "#F3EAFF",
    justifyContent: "center", alignItems: "center",
  },
  requestAvatarText: { color: "#8A38F5", fontWeight: "700", fontSize: 16 },
  requestName: { fontSize: 15, fontWeight: "600", color: "#1a1a1a" },
  requestSub: { fontSize: 12, color: "#888" },
  requestActions: { flexDirection: "row", gap: 8 },
  rejectBtn: {
    paddingVertical: 7, paddingHorizontal: 12, borderRadius: 8,
    borderWidth: 1, borderColor: "#e0d7f0",
  },
  rejectBtnText: { color: "#666", fontWeight: "600", fontSize: 13 },
  approveBtn: {
    paddingVertical: 7, paddingHorizontal: 14, borderRadius: 8,
    backgroundColor: "#8A38F5",
  },
  approveBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
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
  deleteBtn: {
    marginHorizontal: 16, paddingVertical: 16, backgroundColor: "#dc2626",
    borderRadius: 16, alignItems: "center",
  },
  deleteBtnText: { fontSize: 16, fontWeight: "700", color: "#fff" },
  // Name row with edit icon
  nameRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  editIconBtn: { padding: 4 },
  editIconText: { fontSize: 16 },
  // Edit form
  editForm: { width: "100%", paddingHorizontal: 8 },
  editNameInput: {
    borderWidth: 1, borderColor: "#E8E5F0", borderRadius: 12, paddingHorizontal: 14,
    paddingVertical: 10, fontSize: 18, fontWeight: "700", color: "#1a1a1a", marginBottom: 10, textAlign: "center",
  },
  editDescInput: {
    borderWidth: 1, borderColor: "#E8E5F0", borderRadius: 12, paddingHorizontal: 14,
    paddingVertical: 10, fontSize: 14, color: "#444", minHeight: 60, textAlignVertical: "top",
  },
  editActions: { flexDirection: "row", justifyContent: "center", gap: 12, marginTop: 12 },
  editCancelBtn: { paddingHorizontal: 24, paddingVertical: 10, borderRadius: 12, backgroundColor: "#F3F4F6" },
  editCancelText: { fontSize: 14, fontWeight: "700", color: "#6B7280" },
  editSaveBtn: { paddingHorizontal: 28, paddingVertical: 10, borderRadius: 12, backgroundColor: "#500088", minWidth: 80, alignItems: "center" },
  editSaveText: { fontSize: 14, fontWeight: "700", color: "#fff" },
  // Mute toggle
  muteRow: { marginTop: 16, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 12, backgroundColor: "#F3EAFF", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  muteText: { fontSize: 14, fontWeight: "600", color: "#500088" },
});
