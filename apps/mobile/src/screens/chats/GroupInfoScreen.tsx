import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  Alert,
  TextInput,
  ActivityIndicator,
  Platform,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ChatsStackParamList } from "@navigation/ChatsStack";
import { useAuthStore } from "@store/authStore";
import { useChatStore } from "@store/chatStore";
import { chatService } from "@services/chatService";
import ScreenWrapper from "../../components/layout/ScreenWrapper";
import { SheetKeyboardAvoidingView } from "../../components/shared/SheetKeyboardAvoidingView";
import { ActionSheet, ActionSheetOption } from "../../components/chat/ActionSheet";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft, Users, Accessibility, SquarePen, Bell, BellOff, ChevronRight, X, Plus } from "lucide-react-native";
import { useTheme, getFontScale } from "../../theme/ThemeContext";
import { AccessibleText } from "../../components/shared/AccessibleText";
import { AccessibleButton } from "../../components/shared/AccessibleButton";
import { formatUserDisplayName } from "../../utils/formatUserName";

type Props = NativeStackScreenProps<ChatsStackParamList, "GroupInfo">;

const GroupInfoScreen = ({ navigation, route }: Props) => {
  const { conversationId } = route.params;
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const { colors, highContrast, textSize } = useTheme();
  const fs = getFontScale(textSize);

  const conversation = useChatStore((s) => s.conversations[conversationId]);
  const updateConversation = useChatStore((s) => s.updateConversation);
  const setConversations = useChatStore((s) => s.setConversations);

  const [isUpdatingSettings, setIsUpdatingSettings] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [showAllMembers, setShowAllMembers] = useState(false);
  const [memberSearch, setMemberSearch] = useState("");
  const [memberSearchResults, setMemberSearchResults] = useState<{id:string;name:string;email:string}[]>([]);
  const [isSearchingMembers, setIsSearchingMembers] = useState(false);
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);

  const MEMBERS_PAGE_SIZE = 12;

  // Member action / role-picker popups — routed through the shared
  // ActionSheet (instead of raw ActionSheetIOS/Alert.alert) so they can be
  // dismissed by tapping outside or Cancel, not just by picking an option.
  const [memberActionSheet, setMemberActionSheet] = useState<{
    visible: boolean;
    title: string;
    options: ActionSheetOption[];
  }>({ visible: false, title: "", options: [] });
  const closeMemberActionSheet = () =>
    setMemberActionSheet((prev) => ({ ...prev, visible: false }));

  // Edit group info form
  const [isEditingInfo, setIsEditingInfo] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [isSavingInfo, setIsSavingInfo] = useState(false);

  // Standard card outline — subtle in normal mode, solid black under high
  // contrast — for card-like containers/list rows across this screen.
  const cardBorder = highContrast
    ? { borderWidth: 2, borderColor: "#000000" }
    : { borderWidth: 1, borderColor: "rgba(0,0,0,0.05)" };

  // ── Derived State (Safe for undefined conversation) ───────────
  const isCareCircle = conversation?.subType === "CARE_CIRCLE";
  const myParticipant = conversation?.participants?.find((p) => p.userId === user?.id);
  const myRole = myParticipant?.role;
  const isOwner = myRole === "OWNER";

  const hasAdminRights = isCareCircle
    ? myRole === "OWNER" || myRole === "CAREGIVER"
    : myRole === "OWNER" || myRole === "ADMIN";

  const canEditInfo = conversation?.editGroupInfo === "ALL_MEMBERS" || hasAdminRights;
  const canAddMembers = conversation?.addMembers === "ALL_MEMBERS" || hasAdminRights;

  // ── Join requests (admin approval) Hooks ──────────────────────
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
        const existingIds = new Set(conversation?.participants?.map((p) => p.userId) || []);
        setMemberSearchResults(results.filter((r) => !existingIds.has(r.id)));
      } catch {
        setMemberSearchResults([]);
      } finally {
        setIsSearchingMembers(false);
      }
    }, 400);
  }, [conversation?.participants]);

  if (!conversation) {
    return (
      <ScreenWrapper>
        <AccessibleText variant="body" style={{ padding: 20, textAlign: "center" }}>Group not found</AccessibleText>
      </ScreenWrapper>
    );
  }

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
    // Copy follows the conversation type — this screen previously said
    // "Leave Group" even inside a Care Circle.
    const noun = isCareCircle ? "Care Circle" : "Group";
    Alert.alert(
      `Leave ${noun}`,
      `Are you sure you want to leave "${conversation.name}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Leave",
          style: "destructive",
          onPress: async () => {
            try {
              await chatService.removeMember(conversationId, user!.id);
              // Confirm before navigating away: leaving used to pop straight
              // back to the list with no acknowledgement at all, so it wasn't
              // clear whether it had worked.
              Alert.alert(
                `Left ${noun}`,
                `You have successfully left "${conversation.name}".`,
                [{ text: "OK", onPress: () => navigation.popToTop() }]
              );
            } catch (err: any) {
              Alert.alert(
                "Error",
                err?.response?.data?.message || `Failed to leave ${noun.toLowerCase()}.`
              );
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
    setMemberActionSheet({
      visible: true,
      title: `Change role for ${memberName}`,
      options: roles.map((r) => ({
        label: r.charAt(0) + r.slice(1).toLowerCase(),
        onPress: () => changeRole(memberId, r),
      })),
    });
  };

  const handleMemberAction = (memberId: string, currentRole: string, memberName: string) => {
    if (!hasAdminRights) return;
    if (memberId === user?.id) return;

    if (isCareCircle && (myRole === "OWNER" || myRole === "CAREGIVER")) {
      const options: ActionSheetOption[] = [
        { label: "Change Role", onPress: () => promptCareCircleRole(memberId, currentRole, memberName) },
        ...(isOwner
          ? [{ label: "Transfer Ownership", onPress: () => handleTransferOwnership(memberId, memberName) }]
          : []),
        { label: "Remove Member", destructive: true, onPress: () => confirmRemoveMember(memberId, memberName) },
      ];
      setMemberActionSheet({ visible: true, title: memberName, options });
    } else if (!isCareCircle && isOwner) {
      const promoteLabel = currentRole === "ADMIN" ? "Dismiss as Admin" : "Make Admin";
      setMemberActionSheet({
        visible: true,
        title: memberName,
        options: [
          { label: promoteLabel, onPress: () => changeRole(memberId, currentRole === "ADMIN" ? "MEMBER" : "ADMIN") },
          { label: "Transfer Ownership", onPress: () => handleTransferOwnership(memberId, memberName) },
          { label: "Remove Member", destructive: true, onPress: () => confirmRemoveMember(memberId, memberName) },
        ],
      });
    } else if (hasAdminRights && currentRole === "MEMBER") {
      setMemberActionSheet({
        visible: true,
        title: memberName,
        options: [
          { label: "Remove Member", destructive: true, onPress: () => confirmRemoveMember(memberId, memberName) },
        ],
      });
    }
  };

  const getInitials = (name: string) =>
    name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);

  const isAdminRole = (role: string) =>
    role === 'OWNER' || role === 'ADMIN' || role === 'CAREGIVER';

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

  // Role badges are semantically meaningful (distinct color per role), so we
  // keep each role visually distinct rather than collapsing them into one
  // brand color — but every pair now has an explicit high-contrast branch
  // (white fill + solid black border + black text) instead of being frozen
  // hex literals untouched by the contrast toggle. OWNER/ADMIN route through
  // the theme's primary/secondary accents; CAREGIVER/MENTOR/PROFESSIONAL
  // keep semantic green/amber/red tints consistent with their original hues.
  const getRoleBadgeStyle = (role: string) => {
    switch (role) {
      case 'OWNER':
        return {
          backgroundColor: highContrast ? '#FFFFFF' : '#EDE9FE',
          borderWidth: highContrast ? 1 : 0,
          borderColor: '#000000',
          color: colors.primary,
        };
      case 'ADMIN':
        return {
          backgroundColor: highContrast ? '#FFFFFF' : '#DBEAFE',
          borderWidth: highContrast ? 1 : 0,
          borderColor: '#000000',
          color: colors.secondary,
        };
      case 'CAREGIVER':
        return {
          backgroundColor: highContrast ? '#FFFFFF' : '#D1FAE5',
          borderWidth: highContrast ? 1 : 0,
          borderColor: '#000000',
          color: highContrast ? '#000000' : '#065F46',
        };
      case 'MENTOR':
        return {
          backgroundColor: highContrast ? '#FFFFFF' : '#FEF3C7',
          borderWidth: highContrast ? 1 : 0,
          borderColor: '#000000',
          color: highContrast ? '#000000' : '#92400E',
        };
      case 'PROFESSIONAL':
        return {
          backgroundColor: highContrast ? '#FFFFFF' : '#FEE2E2',
          borderWidth: highContrast ? 1 : 0,
          borderColor: '#000000',
          color: highContrast ? '#000000' : '#991B1B',
        };
      default:
        return null;
    }
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
        <AccessibleText variant="title" style={[styles.headerTitle, { color: colors.white }]}>Group Info</AccessibleText>
      </View>

      {/* Android offset must be 0: app.json sets softwareKeyboardLayoutMode
          "resize" (adjustResize), so the window already shrinks by the
          keyboard height. SheetKeyboardAvoidingView uses behavior="height" on
          Android, which subtracts again — with a non-zero offset the keyboard
          terms cancel and ~offset px of blank background is left above the
          keyboard (the reported white box). AltTextModal already uses 0 here. */}
      <SheetKeyboardAvoidingView
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === "ios" ? insets.top + 60 : 0}
      >
      <ScrollView style={[styles.content, { backgroundColor: colors.background }]} contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        {/* Profile Card */}
        <View style={[styles.profileCard, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <View style={[styles.avatarLarge, { backgroundColor: colors.surface }]}>
            {isCareCircle
              ? <Accessibility size={40} color={colors.primary} strokeWidth={1.9} />
              : <Users size={40} color={colors.primary} strokeWidth={1.9} />}
          </View>

          {isEditingInfo ? (
            <View style={styles.editForm}>
              <TextInput
                style={[styles.editNameInput, { fontSize: fs(18), color: colors.text }, cardBorder]}
                value={editName}
                onChangeText={setEditName}
                placeholder="Group name"
                placeholderTextColor={colors.subtext}
                maxLength={100}
                autoFocus
                accessibilityLabel="Group name"
              />
              <TextInput
                style={[styles.editDescInput, { color: colors.text }, cardBorder]}
                value={editDesc}
                onChangeText={setEditDesc}
                placeholder="Add a description (optional)"
                placeholderTextColor={colors.subtext}
                maxLength={500}
                multiline
                accessibilityLabel="Group description"
              />
              <View style={styles.editActions}>
                <AccessibleButton
                  variant="outline"
                  accessibilityLabel="Cancel editing group info"
                  style={styles.editCancelBtn}
                  onPress={() => setIsEditingInfo(false)}
                  disabled={isSavingInfo}
                >
                  Cancel
                </AccessibleButton>
                <AccessibleButton
                  variant="primary"
                  accessibilityLabel="Save group info"
                  style={styles.editSaveBtn}
                  onPress={handleSaveInfo}
                  disabled={isSavingInfo}
                >
                  {isSavingInfo ? <ActivityIndicator size="small" color={colors.white} /> : "Save"}
                </AccessibleButton>
              </View>
            </View>
          ) : (
            <>
              <View style={styles.nameRow}>
                <AccessibleText variant="title" style={[styles.groupNameLarge, { fontSize: fs(24), color: colors.text }]}>
                  {conversation.name}
                </AccessibleText>
                {canEditInfo && (
                  <TouchableOpacity
                    style={styles.editIconBtn}
                    onPress={openEditInfo}
                    accessibilityRole="button"
                    accessibilityLabel="Edit group info"
                  >
                    <SquarePen size={17} color={colors.primary} strokeWidth={2} />
                  </TouchableOpacity>
                )}
              </View>
              <AccessibleText variant="body" style={[styles.memberCountLarge, { color: colors.subtext }]}>
                {isCareCircle ? "Care Circle" : "Group"} • {conversation.participants.length} members
              </AccessibleText>
              {conversation.description ? (
                <AccessibleText variant="body" style={[styles.groupDescription, { color: colors.text }]}>
                  {conversation.description}
                </AccessibleText>
              ) : null}
            </>
          )}

          {/* Mute toggle — available to all members */}
          <TouchableOpacity
            style={[styles.muteRow, { backgroundColor: colors.surface }]}
            onPress={handleToggleMute}
            accessibilityRole="button"
            accessibilityLabel={isMuted ? "Unmute notifications" : "Mute notifications"}
          >
            {isMuted
              ? <Bell size={16} color={colors.primary} strokeWidth={2} />
              : <BellOff size={16} color={colors.primary} strokeWidth={2} />}
            <AccessibleText variant="body" style={[styles.muteText, { color: colors.primary }]}>
              {isMuted ? "Unmute Notifications" : "Mute Notifications"}
            </AccessibleText>
          </TouchableOpacity>
        </View>

        {/* Group Settings Section */}
        {hasAdminRights && (
          <View style={styles.section}>
            <AccessibleText variant="label" style={[styles.sectionLabel, { fontSize: fs(14), color: colors.secondary }]}>Group Settings</AccessibleText>
            <View style={[styles.settingsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <AccessibleText variant="body" style={[styles.settingTitle, { color: colors.text }]}>Edit Group Info</AccessibleText>
                  <AccessibleText variant="caption" style={[styles.settingSub, { color: colors.subtext }]}>Who can change group name and description</AccessibleText>
                </View>
                <Switch
                  value={conversation.editGroupInfo === "ALL_MEMBERS"}
                  onValueChange={() => handleToggleSetting("editGroupInfo", conversation.editGroupInfo || "ADMINS_ONLY")}
                  disabled={isUpdatingSettings}
                  trackColor={{ false: highContrast ? "#7E7383" : "#CFC2D4", true: highContrast ? "#000000" : colors.primary }}
                  thumbColor="#FFFFFF"
                  accessibilityLabel="Edit group info permission"
                  accessibilityHint="Toggles whether all members or only admins can edit group info"
                />
              </View>
              <View style={[styles.settingDivider, { backgroundColor: colors.border }]} />
              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <AccessibleText variant="body" style={[styles.settingTitle, { color: colors.text }]}>Add Members</AccessibleText>
                  <AccessibleText variant="caption" style={[styles.settingSub, { color: colors.subtext }]}>Who can invite new members</AccessibleText>
                </View>
                <Switch
                  value={conversation.addMembers === "ALL_MEMBERS"}
                  onValueChange={() => handleToggleSetting("addMembers", conversation.addMembers || "ADMINS_ONLY")}
                  disabled={isUpdatingSettings}
                  trackColor={{ false: highContrast ? "#7E7383" : "#CFC2D4", true: highContrast ? "#000000" : colors.primary }}
                  thumbColor="#FFFFFF"
                  accessibilityLabel="Add members permission"
                  accessibilityHint="Toggles whether all members or only admins can add new members"
                />
              </View>
              <View style={[styles.settingDivider, { backgroundColor: colors.border }]} />
              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <AccessibleText variant="body" style={[styles.settingTitle, { color: colors.text }]}>Send Messages</AccessibleText>
                  <AccessibleText variant="caption" style={[styles.settingSub, { color: colors.subtext }]}>Who can send messages</AccessibleText>
                </View>
                <Switch
                  value={conversation.sendMessages === "ALL_MEMBERS"}
                  onValueChange={() => handleToggleSetting("sendMessages", conversation.sendMessages || "ALL_MEMBERS")}
                  disabled={isUpdatingSettings}
                  trackColor={{ false: highContrast ? "#7E7383" : "#CFC2D4", true: highContrast ? "#000000" : colors.primary }}
                  thumbColor="#FFFFFF"
                  accessibilityLabel="Send messages permission"
                  accessibilityHint="Toggles whether all members or only admins can send messages"
                />
              </View>
              <View style={[styles.settingDivider, { backgroundColor: colors.border }]} />
              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <AccessibleText variant="body" style={[styles.settingTitle, { color: colors.text }]}>Approve New Members</AccessibleText>
                  <AccessibleText variant="caption" style={[styles.settingSub, { color: colors.subtext }]}>Admin approval required before joining</AccessibleText>
                </View>
                <Switch
                  value={conversation.approveNewMembers ?? false}
                  onValueChange={handleToggleApproveMembers}
                  disabled={isUpdatingSettings}
                  trackColor={{ false: highContrast ? "#7E7383" : "#CFC2D4", true: highContrast ? "#000000" : colors.primary }}
                  thumbColor="#FFFFFF"
                  accessibilityLabel="Approve new members permission"
                  accessibilityHint="Toggles whether new members require admin approval before joining"
                />
              </View>
            </View>
          </View>
        )}

        {/* Pending Join Requests (admins only) */}
        {hasAdminRights && pendingRequests.length > 0 && (
          <View style={styles.section}>
            <AccessibleText variant="label" style={[styles.sectionLabel, { fontSize: fs(14), color: colors.secondary }]}>
              Pending Requests ({pendingRequests.length})
            </AccessibleText>
            {pendingRequests.map((req) => (
              <View key={req.id} style={[styles.requestRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={[styles.requestAvatar, { backgroundColor: colors.surface }]}>
                  <AccessibleText variant="subtitle" style={[styles.requestAvatarText, { color: colors.primary }]}>
                    {(req.inviteeName || "?").charAt(0).toUpperCase()}
                  </AccessibleText>
                </View>
                <View style={{ flex: 1 }}>
                  <AccessibleText variant="body" style={[styles.requestName, { color: colors.text }]} numberOfLines={1}>{req.inviteeName}</AccessibleText>
                  <AccessibleText variant="caption" style={[styles.requestSub, { color: colors.subtext }]}>wants to join</AccessibleText>
                </View>
                {processingRequestId === req.id ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <View style={styles.requestActions}>
                    <TouchableOpacity
                      style={[styles.rejectBtn, { borderColor: colors.border }]}
                      onPress={() => handleRespondToRequest(req.id, false)}
                      accessibilityRole="button"
                      accessibilityLabel={`Reject ${req.inviteeName}'s join request`}
                    >
                      <AccessibleText variant="caption" style={[styles.rejectBtnText, { color: colors.subtext }]}>Reject</AccessibleText>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.approveBtn, { backgroundColor: colors.primary }]}
                      onPress={() => handleRespondToRequest(req.id, true)}
                      accessibilityRole="button"
                      accessibilityLabel={`Approve ${req.inviteeName}'s join request`}
                    >
                      <AccessibleText variant="caption" style={[styles.approveBtnText, { color: colors.white }]}>Approve</AccessibleText>
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
            <AccessibleText variant="label" style={[styles.sectionLabel, { fontSize: fs(14), color: colors.secondary }]}>Members</AccessibleText>
            {canAddMembers && (
              <TouchableOpacity
                style={[styles.addMemberBtn, { backgroundColor: colors.surface, flexDirection: "row", alignItems: "center", gap: 4 }]}
                onPress={() => setShowAddMember(!showAddMember)}
                accessibilityRole="button"
                accessibilityLabel={showAddMember ? "Close add member search" : "Add member"}
              >
                {showAddMember ? <X size={14} color={colors.primary} strokeWidth={2.4} /> : <Plus size={14} color={colors.primary} strokeWidth={2.4} />}
                <AccessibleText variant="caption" style={[styles.addMemberText, { color: colors.primary }]}>{showAddMember ? "Close" : "Add Member"}</AccessibleText>
              </TouchableOpacity>
            )}
          </View>

          {/* Inline Add Member Search */}
          {showAddMember && (
            <View style={[styles.addMemberSearch, { backgroundColor: colors.card }, cardBorder]}>
              <TextInput
                style={[styles.searchInput, { backgroundColor: colors.background, color: colors.text }]}
                placeholder="Search by name..."
                placeholderTextColor={colors.subtext}
                value={memberSearch}
                onChangeText={handleMemberSearchChange}
                autoFocus
                accessibilityLabel="Search members by name"
              />
              {isSearchingMembers && <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: 8 }} />}
              {memberSearchResults.map((r) => (
                <TouchableOpacity
                  key={r.id}
                  style={[styles.searchResultRow, { borderTopColor: colors.border }]}
                  onPress={() => handleInviteMember(r)}
                  accessibilityRole="button"
                  accessibilityLabel={`Invite ${r.name}`}
                >
                  <View style={[styles.memberAvatar, { backgroundColor: colors.surface }]}>
                    <AccessibleText variant="label" style={[styles.memberAvatarText, { color: colors.subtext }]}>{getInitials(r.name)}</AccessibleText>
                  </View>
                  <View style={styles.memberInfo}>
                    <AccessibleText variant="body" style={[styles.memberName, { color: colors.text }]}>{r.name}</AccessibleText>
                    <AccessibleText variant="caption" style={[styles.memberEmail, { color: colors.subtext }]}>{r.email}</AccessibleText>
                  </View>
                  <AccessibleText variant="label" style={[styles.inviteBtn, { color: colors.primary }]}>Invite</AccessibleText>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {(() => {
            // Sort: admins first, then alphabetically by name within each group
            const sorted = [...(conversation.participants || [])].sort((a, b) => {
              const aAdmin = isAdminRole(a.role) ? 0 : 1;
              const bAdmin = isAdminRole(b.role) ? 0 : 1;
              if (aAdmin !== bAdmin) return aAdmin - bAdmin;
              return (a.user?.name || '').localeCompare(b.user?.name || '');
            });
            const displayedMembers = showAllMembers ? sorted : sorted.slice(0, MEMBERS_PAGE_SIZE);
            const remaining = sorted.length - MEMBERS_PAGE_SIZE;

            return (
              <>
                <View style={[styles.membersCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  {displayedMembers.map((p, index) => {
                    const roleLabel = getRoleLabel(p.role);
                    const roleBadge = getRoleBadgeStyle(p.role);
                    const name = formatUserDisplayName(p.user);
                    const isMe = p.userId === user?.id;
                    const isAdmin = isAdminRole(p.role);
                    return (
                      <TouchableOpacity
                        key={p.userId}
                        style={[
                          styles.memberRow,
                          index < displayedMembers.length - 1 && [styles.memberBorder, { borderBottomColor: colors.border }],
                        ]}
                        onPress={() => handleMemberAction(p.userId, p.role, name)}
                        disabled={!hasAdminRights || isMe}
                        activeOpacity={0.7}
                        accessibilityRole="button"
                        accessibilityLabel={`${name}${isMe ? " (you)" : ""}${roleLabel ? `, ${roleLabel}` : ", Member"}`}
                        accessibilityHint={hasAdminRights && !isMe ? "Opens member actions" : undefined}
                      >
                        <View style={[styles.memberAvatar, { backgroundColor: isAdmin ? (highContrast ? '#000' : '#EDE9FE') : colors.surface }]}>
                          <AccessibleText variant="label" style={[styles.memberAvatarText, { color: isAdmin ? colors.primary : colors.subtext }]}>{getInitials(name)}</AccessibleText>
                        </View>
                        <View style={styles.memberInfo}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                            <AccessibleText variant="body" style={[styles.memberName, { color: colors.text }]}>
                              {name}{isMe ? <AccessibleText variant="caption" style={[styles.youTag, { color: colors.subtext }]}> (You)</AccessibleText> : null}
                            </AccessibleText>
                            {/* Admin/Member badge */}
                            <View style={[
                              styles.memberTypePill,
                              isAdmin
                                ? { backgroundColor: highContrast ? '#000' : '#EDE9FE' }
                                : { backgroundColor: highContrast ? '#000' : '#F3F4F6' }
                            ]}>
                              <AccessibleText variant="label" style={[
                                styles.memberTypePillText,
                                { color: isAdmin ? colors.primary : (highContrast ? '#fff' : '#6B7280') }
                              ]}>
                                {isAdmin ? 'Admin' : 'Member'}
                              </AccessibleText>
                            </View>
                          </View>
                          {roleLabel && roleBadge && (
                            <View style={[styles.rolePill, { backgroundColor: roleBadge.backgroundColor, borderWidth: roleBadge.borderWidth, borderColor: roleBadge.borderColor }]}>
                              <AccessibleText variant="label" style={[styles.rolePillText, { color: roleBadge.color }]}>{roleLabel}</AccessibleText>
                            </View>
                          )}
                        </View>
                        {hasAdminRights && !isMe && p.role !== 'OWNER' && (
                          <ChevronRight size={20} color={colors.subtext} strokeWidth={2} style={{ marginLeft: 10 }} />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
                {sorted.length > MEMBERS_PAGE_SIZE && (
                  <TouchableOpacity
                    style={[styles.showMoreBtn, { backgroundColor: colors.surface }]}
                    onPress={() => setShowAllMembers((v) => !v)}
                    accessibilityRole="button"
                    accessibilityLabel={showAllMembers ? 'Show fewer members' : `Show ${remaining} more members`}
                  >
                    <AccessibleText variant="body" style={[styles.showMoreText, { color: colors.primary }]}>
                      {showAllMembers ? 'Show less' : `Show ${remaining} more member${remaining === 1 ? '' : 's'}`}
                    </AccessibleText>
                  </TouchableOpacity>
                )}
              </>
            );
          })()}
        </View>

        {/* Leave Group — non-owners; Delete Group — owner */}
        <View style={styles.section}>
          {isOwner ? (
            <AccessibleButton
              variant="danger"
              accessibilityLabel="Delete group"
              accessibilityHint={`Permanently deletes ${conversation.name} for all members`}
              style={styles.deleteBtn}
              onPress={handleDeleteGroup}
            >
              Delete Group
            </AccessibleButton>
          ) : (
            <AccessibleButton
              variant="danger"
              accessibilityLabel={isCareCircle ? "Leave care circle" : "Leave group"}
              accessibilityHint={`Leaves ${conversation.name}`}
              style={styles.leaveBtn}
              onPress={handleLeaveGroup}
            >
              {isCareCircle ? "Leave Care Circle" : "Leave Group"}
            </AccessibleButton>
          )}
        </View>
      </ScrollView>
      </SheetKeyboardAvoidingView>

      <ActionSheet
        visible={memberActionSheet.visible}
        title={memberActionSheet.title}
        options={memberActionSheet.options}
        onClose={closeMemberActionSheet}
      />
    </ScreenWrapper>
  );
};

export default GroupInfoScreen;

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
  headerTitle: { fontSize: 20, fontWeight: "800" },
  content: { flex: 1 },
  profileCard: {
    alignItems: "center", paddingVertical: 30, paddingHorizontal: 20,
    borderBottomWidth: 1, marginBottom: 20,
  },
  avatarLarge: {
    width: 80, height: 80, borderRadius: 40,
    justifyContent: "center", alignItems: "center", marginBottom: 16,
  },
  groupNameLarge: { fontSize: 24, fontWeight: "800", marginBottom: 4, textAlign: "center" },
  memberCountLarge: { fontSize: 14, fontWeight: "500" },
  groupDescription: { marginTop: 12, fontSize: 14, textAlign: "center", lineHeight: 20 },
  section: { marginBottom: 24 },
  sectionLabel: {
    fontSize: 14, fontWeight: "700",
    marginLeft: 16, marginBottom: 8, textTransform: "uppercase",
  },
  requestRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingVertical: 12, paddingHorizontal: 16,
    borderTopWidth: 1,
  },
  requestAvatar: {
    width: 40, height: 40, borderRadius: 20,
    justifyContent: "center", alignItems: "center",
  },
  requestAvatarText: { fontWeight: "700" },
  requestName: { fontSize: 15, fontWeight: "600" },
  requestSub: { fontSize: 12 },
  requestActions: { flexDirection: "row", gap: 8 },
  rejectBtn: {
    paddingVertical: 7, paddingHorizontal: 12, borderRadius: 8,
    borderWidth: 1,
  },
  rejectBtnText: { fontWeight: "600", fontSize: 13 },
  approveBtn: {
    paddingVertical: 7, paddingHorizontal: 14, borderRadius: 8,
  },
  approveBtnText: { fontWeight: "700", fontSize: 13 },
  settingsCard: { borderTopWidth: 1, borderBottomWidth: 1 },
  settingRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 14, paddingHorizontal: 16 },
  settingDivider: { height: 1, marginLeft: 16 },
  settingInfo: { flex: 1, paddingRight: 16 },
  settingTitle: { fontSize: 16, fontWeight: "600", marginBottom: 2 },
  settingSub: { fontSize: 13 },
  sectionHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingRight: 16 },
  addMemberBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, marginBottom: 8 },
  addMemberText: { fontSize: 12, fontWeight: "700" },
  addMemberSearch: {
    marginHorizontal: 16, marginBottom: 12,
    borderRadius: 16, padding: 12,
  },
  searchInput: {
    borderRadius: 12, paddingHorizontal: 12,
    paddingVertical: 10, fontSize: 15,
  },
  searchResultRow: {
    flexDirection: "row", alignItems: "center", paddingVertical: 10, borderTopWidth: 1,
  },
  membersCard: { borderTopWidth: 1, borderBottomWidth: 1 },
  memberRow: { flexDirection: "row", alignItems: "center", paddingVertical: 12, paddingHorizontal: 16 },
  memberBorder: { borderBottomWidth: 1 },
  memberAvatar: {
    width: 40, height: 40, borderRadius: 20,
    justifyContent: "center", alignItems: "center", marginRight: 12,
  },
  memberAvatarText: { fontSize: 14, fontWeight: "700" },
  memberInfo: { flex: 1 },
  memberName: { fontSize: 16, fontWeight: "600" },
  memberEmail: { fontSize: 12, marginTop: 1 },
  youTag: { fontSize: 13, fontWeight: "400" },
  rolePill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8, paddingVertical: 2,
    borderRadius: 10, marginTop: 3,
  },
  rolePillText: { fontSize: 11, fontWeight: "700" },
  memberTypePill: {
    paddingHorizontal: 7, paddingVertical: 2,
    borderRadius: 8, alignSelf: 'flex-start',
  },
  memberTypePillText: { fontSize: 10, fontWeight: "700", letterSpacing: 0.3 },
  showMoreBtn: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  showMoreText: { fontSize: 14, fontWeight: '600' },
  inviteBtn: { fontSize: 13, fontWeight: "700", paddingHorizontal: 8 },
  leaveBtn: {
    marginHorizontal: 16, paddingVertical: 16,
    borderRadius: 16, alignItems: "center",
  },
  deleteBtn: {
    marginHorizontal: 16, paddingVertical: 16,
    borderRadius: 16, alignItems: "center",
  },
  // Name row with edit icon
  nameRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  editIconBtn: { padding: 4 },
  // Edit form
  editForm: { width: "100%", paddingHorizontal: 8 },
  editNameInput: {
    borderRadius: 12, paddingHorizontal: 14,
    paddingVertical: 10, fontSize: 18, fontWeight: "700", marginBottom: 10, textAlign: "center",
  },
  editDescInput: {
    borderRadius: 12, paddingHorizontal: 14,
    paddingVertical: 10, fontSize: 14, minHeight: 60, textAlignVertical: "top",
  },
  editActions: { flexDirection: "row", justifyContent: "center", gap: 12, marginTop: 12 },
  editCancelBtn: { paddingHorizontal: 24, paddingVertical: 10, borderRadius: 12 },
  editSaveBtn: { paddingHorizontal: 28, paddingVertical: 10, borderRadius: 12, minWidth: 80, alignItems: "center" },
  // Mute toggle
  muteRow: { marginTop: 16, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  muteText: { fontSize: 14, fontWeight: "600" },
});
