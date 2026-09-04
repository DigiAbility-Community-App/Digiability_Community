import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import ConversationListScreen from '@screens/chats/ConversationListScreen';
import ChatScreen from '@screens/chats/ChatScreen';
import GroupChatScreen from '@screens/chats/GroupChatScreen';
import CreateGroupScreen from '@screens/chats/CreateGroupScreen';
import NewChatScreen from '@screens/chats/NewChatScreen';
import UserProfileScreen from '@screens/chats/UserProfileScreen';
import DiscoverGroupsScreen from '@screens/community/DiscoverGroupsScreen';

// ─────────────────────────────────────────────────────────
// Chat Stack Navigator
//
// Screens:
//   ConversationList → all conversations (DMs + Groups)
//   Chat            → 1:1 direct message thread
//   GroupChat        → group / care-circle thread
//   CreateGroup      → create a new care circle
//   UserProfile      → tapped user's profile
// ─────────────────────────────────────────────────────────

export type ChatsStackParamList = {
  ConversationList: undefined;
  Chat: {
    conversationId: string;
    recipientName: string;
    recipientAvatar?: string;
    isOnline?: boolean;
  };
  GroupChat: {
    conversationId: string;
    groupName: string;
    subType?: 'GENERAL' | 'CARE_CIRCLE' | null;
  };
  CreateGroup: {
    subType: 'GENERAL' | 'CARE_CIRCLE';
  };
  NewChat: undefined;
  DiscoverGroups: {
    subType: 'GENERAL' | 'CARE_CIRCLE';
  };
  GroupInfo: {
    conversationId: string;
  };
  Invites: undefined;
  UserProfile: {
    userId: string;
    userName: string;
  };
};

const Stack = createNativeStackNavigator<ChatsStackParamList>();

const ChatsStack = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ConversationList" component={ConversationListScreen} />
      <Stack.Screen name="Chat" component={ChatScreen} />
      <Stack.Screen name="GroupChat" component={GroupChatScreen} />
      <Stack.Screen name="CreateGroup" component={CreateGroupScreen} />
      <Stack.Screen name="NewChat" component={NewChatScreen} />
      <Stack.Screen name="DiscoverGroups" component={DiscoverGroupsScreen} />
      <Stack.Screen name="GroupInfo" component={require('@screens/chats/GroupInfoScreen').default} />
      <Stack.Screen name="Invites" component={require('@screens/chats/InvitesScreen').default} />
      <Stack.Screen name="UserProfile" component={UserProfileScreen} />
    </Stack.Navigator>
  );
};

export default ChatsStack;
