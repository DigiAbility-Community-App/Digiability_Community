import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  Alert,
  Platform,
  ActionSheetIOS,
} from "react-native";
import { NativeStackNavigationProp, NativeStackScreenProps } from "@react-navigation/native-stack";
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

  // If conversation isn't loaded for some reason, bail
  if (!conversation) {
    return (
      <ScreenWrapper>
        <Text style={{padding: 20, textAlign: 'center'}}>Group not found</Text>
      </ScreenWrapper>
    );
  }

  const isCareCircle = conversation.subType === 'CARE_CIRCLE';
  const myParticipant = conversation.participants.find(p => p.userId === user?.id);
  const myRole = myParticipant?.role;
  const isOwner = myRole === 'OWNER';
  
  // Permissions based on rules
  const hasAdminRights = isCareCircle 
    ? (myRole === 'OWNER' || myRole === 'CAREGIVER')
    : (myRole === 'OWNER' || myRole === 'ADMIN');

  const canEditInfo = conversation.editGroupInfo === 'ALL_MEMBERS' || hasAdminRights;
  const canAddMembers = conversation.addMembers === 'ALL_MEMBERS' || hasAdminRights;

  const [isUpdatingSettings, setIsUpdatingSettings] = useState(false);

  const handleToggleSetting = async (setting: 'editGroupInfo' | 'addMembers' | 'sendMessages', currentValue: string) => {
    if (!hasAdminRights) {
      Alert.alert("Permission Denied", "Only admins can change group settings.");
      return;
    }

    const newValue = currentValue === 'ALL_MEMBERS' ? 'ADMINS_ONLY' : 'ALL_MEMBERS';
    
    // Optimistic update
    updateConversation(conversationId, { [setting]: newValue });
    setIsUpdatingSettings(true);
    
    try {
      await chatService.updateGroupSettings(conversationId, { [setting]: newValue });
    } catch (err) {
      // Revert on failure
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
    } catch (err) {
      updateConversation(conversationId, { approveNewMembers: !newValue });
      Alert.alert("Error", "Failed to update group settings.");
    } finally {
      setIsUpdatingSettings(false);
    }
  };

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

  const handleMemberAction = (memberId: string, currentRole: string, memberName: string) => {
    if (!hasAdminRights) return;
    if (memberId === user?.id) return;
    
    if (isCareCircle && (myRole === 'OWNER' || myRole === 'CAREGIVER')) {
      // Care Circle role management
      const options = isOwner
        ? ['Cancel', 'Change Role', 'Transfer Ownership', 'Remove Member']
        : ['Cancel', 'Change Role', 'Remove Member'];
      const destructiveIndex = isOwner ? 3 : 2;
      if (Platform.OS === 'ios') {
        ActionSheetIOS.showActionSheetWithOptions(
          { options, cancelButtonIndex: 0, destructiveButtonIndex: destructiveIndex },
          (idx) => {
            if (idx === 1) promptCareCircleRole(memberId, currentRole, memberName);
            if (isOwner && idx === 2) handleTransferOwnership(memberId, memberName);
            if (idx === destructiveIndex) confirmRemoveMember(memberId, memberName);
          }
        );
      }
    } else if (!isCareCircle && isOwner) {
      // General Group role management (only OWNER can promote/demote ADMINS)
      const options = ['Cancel', currentRole === 'ADMIN' ? 'Dismiss as Admin' : 'Make Admin', 'Transfer Ownership', 'Remove Member'];
      if (Platform.OS === 'ios') {
        ActionSheetIOS.showActionSheetWithOptions(
          { options, cancelButtonIndex: 0, destructiveButtonIndex: 3 },
          (idx) => {
            if (idx === 1) changeRole(memberId, currentRole === 'ADMIN' ? 'MEMBER' : 'ADMIN');
            if (idx === 2) handleTransferOwnership(memberId, memberName);
            if (idx === 3) confirmRemoveMember(memberId, memberName);
          }
        );
      }
    } else if (hasAdminRights && currentRole === 'MEMBER') {
      // ADMIN can only remove MEMBERs
      const options = ['Cancel', 'Remove Member'];
      if (Platform.OS === 'ios') {
        ActionSheetIOS.showActionSheetWithOptions(
          { options, cancelButtonIndex: 0, destructiveButtonIndex: 1 },
          (idx) => {
            if (idx === 1) confirmRemoveMember(memberId, memberName);
          }
        );
      }
    }
  };

  const promptCareCircleRole = (memberId: string, currentRole: string, memberName: string) => {
    const roles = ['MEMBER', 'CAREGIVER', 'MENTOR', 'PROFESSIONAL'];
    const options = ['Cancel', ...roles.map(r => r.charAt(0) + r.slice(1).toLowerCase())];
    
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options, cancelButtonIndex: 0 },
        (idx) => {
          if (idx > 0) changeRole(memberId, roles[idx - 1]);
        }
      );
    }
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
      `Are you sure you want to remove ${memberName} from the group?`,
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Remove", 
          style: "destructive",
          onPress: async () => {
            try {
              await chatService.removeMember(conversationId, memberId);
              // Remove from local store
              const updatedParticipants = conversation.participants.filter(p => p.userId !== memberId);
              updateConversation(conversationId, { participants: updatedParticipants } as any);
            } catch (err: any) {
              Alert.alert("Error", err?.response?.data?.message || "Failed to remove member");
            }
          }
        }
      ]
    );
  };

  const getInitials = (name: string) => {
    return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
  };

  return (
    <ScreenWrapper statusBarStyle="light">
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Group Info</Text>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatarLarge}>
            <Text style={styles.avatarEmoji}>{isCareCircle ? '🦽' : '👥'}</Text>
          </View>
          <Text style={styles.groupNameLarge}>{conversation.name}</Text>
          <Text style={styles.memberCountLarge}>
            {isCareCircle ? 'Care Circle' : 'Group'} • {conversation.participants.length} members
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
                  <Text style={styles.settingSub}>Choose who can change group name and description</Text>
                </View>
                <Switch 
                  value={conversation.editGroupInfo === 'ALL_MEMBERS'}
                  onValueChange={() => handleToggleSetting('editGroupInfo', conversation.editGroupInfo || 'ADMINS_ONLY')}
                  disabled={isUpdatingSettings}
                  trackColor={{ true: '#8A38F5', false: '#E8E5F0' }}
                />
              </View>
              <View style={styles.settingDivider} />
              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingTitle}>Add Members</Text>
                  <Text style={styles.settingSub}>Choose who can invite new members</Text>
                </View>
                <Switch 
                  value={conversation.addMembers === 'ALL_MEMBERS'}
                  onValueChange={() => handleToggleSetting('addMembers', conversation.addMembers || 'ADMINS_ONLY')}
                  disabled={isUpdatingSettings}
                  trackColor={{ true: '#8A38F5', false: '#E8E5F0' }}
                />
              </View>
              <View style={styles.settingDivider} />
              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingTitle}>Send Messages</Text>
                  <Text style={styles.settingSub}>Choose who can send messages</Text>
                </View>
                <Switch 
                  value={conversation.sendMessages === 'ALL_MEMBERS'}
                  onValueChange={() => handleToggleSetting('sendMessages', conversation.sendMessages || 'ALL_MEMBERS')}
                  disabled={isUpdatingSettings}
                  trackColor={{ true: '#8A38F5', false: '#E8E5F0' }}
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
                  trackColor={{ true: '#8A38F5', false: '#E8E5F0' }}
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
              <TouchableOpacity style={styles.addMemberBtn}>
                <Text style={styles.addMemberText}>+ Add Member</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.membersCard}>
            {conversation.participants.map((p, index) => (
              <TouchableOpacity 
                key={p.userId} 
                style={[
                  styles.memberRow, 
                  index < conversation.participants.length - 1 && styles.memberBorder
                ]}
                onPress={() => handleMemberAction(p.userId, p.role, p.user?.name || '')}
                disabled={!hasAdminRights || p.userId === user?.id}
              >
                <View style={styles.memberAvatar}>
                  <Text style={styles.memberAvatarText}>{getInitials(p.user?.name || '?')}</Text>
                </View>
                <View style={styles.memberInfo}>
                  <Text style={styles.memberName}>
                    {p.user?.name} {p.userId === user?.id ? "(You)" : ""}
                  </Text>
                  {p.role !== 'MEMBER' && (
                    <Text style={[styles.memberRoleBadge, p.role === 'OWNER' && { color: '#500088' }]}>
                      {p.role}
                    </Text>
                  )}
                </View>
                {hasAdminRights && p.userId !== user?.id && (
                  <Text style={styles.chevron}>›</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
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
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.15)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  backText: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "700",
  },
  headerTitle: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "800",
  },
  content: {
    flex: 1,
    backgroundColor: "#F6F6F6",
  },
  profileCard: {
    alignItems: 'center',
    paddingVertical: 30,
    paddingHorizontal: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E8E5F0',
    marginBottom: 20,
  },
  avatarLarge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F3EAFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarEmoji: {
    fontSize: 40,
  },
  groupNameLarge: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1a1a1a',
    marginBottom: 4,
    textAlign: 'center',
  },
  memberCountLarge: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  groupDescription: {
    marginTop: 12,
    fontSize: 14,
    color: '#444',
    textAlign: 'center',
    lineHeight: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6B21A8',
    marginLeft: 16,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  settingsCard: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#E8E5F0',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  settingDivider: {
    height: 1,
    backgroundColor: '#E8E5F0',
    marginLeft: 16,
  },
  settingInfo: {
    flex: 1,
    paddingRight: 16,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 2,
  },
  settingSub: {
    fontSize: 13,
    color: '#666',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingRight: 16,
  },
  addMemberBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#E8E5F0',
    borderRadius: 12,
    marginBottom: 8,
  },
  addMemberText: {
    color: '#500088',
    fontSize: 12,
    fontWeight: '700',
  },
  membersCard: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#E8E5F0',
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  memberBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#f5f0fa',
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E8E5F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  memberAvatarText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#666',
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  memberRoleBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: '#8A38F5',
    marginTop: 2,
  },
  chevron: {
    fontSize: 20,
    color: '#ccc',
    paddingLeft: 10,
  },
});
