import { create } from 'zustand';

export interface ChatMessage {
  id: string;
  clientMessageId: string;
  conversationId: string;
  senderId: string;
  content: string;
  type: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  createdAt: string;
}

export interface ConversationParticipant {
  userId: string;
  role: string;
  lastReadSequenceNo?: number;
  isMuted?: boolean;
  user?: { id: string; name: string };
}

export interface Conversation {
  id: string;
  type: 'DIRECT' | 'GROUP';
  name?: string;
  participants: ConversationParticipant[];
  lastMessage?: ChatMessage;
  unreadCount: number;
  updatedAt: string;
}

interface ChatState {
  connectionState: 'connected' | 'disconnected' | 'connecting';
  lastSyncTime: string;
  conversations: Record<string, Conversation>;
  messages: Record<string, ChatMessage[]>; // keyed by conversationId
  presence: Record<string, { status: string; lastSeen: string }>;
  typing: Record<string, string[]>; // conversationId -> array of userIds typing

  setConnectionState: (state: 'connected' | 'disconnected' | 'connecting') => void;
  setLastSyncTime: (time: string) => void;
  
  setConversations: (conversations: Conversation[]) => void;
  addConversation: (conversation: Conversation) => void;
  
  setMessages: (conversationId: string, messages: ChatMessage[]) => void;
  addMessage: (message: ChatMessage) => void;
  updateMessageStatus: (messageIds: string[], status: 'delivered' | 'read') => void;

  updatePresence: (userId: string, status: string, lastSeen: string) => void;
  updateTyping: (conversationId: string, userId: string, isTyping: boolean) => void;
  
  clearStore: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
  connectionState: 'disconnected',
  lastSyncTime: new Date(0).toISOString(),
  conversations: {},
  messages: {},
  presence: {},
  typing: {},

  setConnectionState: (state) => set({ connectionState: state }),
  setLastSyncTime: (time) => set({ lastSyncTime: time }),

  setConversations: (convos) =>
    set((state) => {
      const newConvos = { ...state.conversations };
      convos.forEach((c) => {
        newConvos[c.id] = c;
      });
      return { conversations: newConvos };
    }),

  addConversation: (c) =>
    set((state) => ({
      conversations: { ...state.conversations, [c.id]: c },
    })),

  setMessages: (conversationId, newMessages) =>
    set((state) => ({
      messages: { ...state.messages, [conversationId]: newMessages },
    })),

  addMessage: (message) =>
    set((state) => {
      const convMsgs = state.messages[message.conversationId] || [];
      // Replace optimistic message if clientMessageId matches
      const existingIdx = convMsgs.findIndex(m => m.clientMessageId === message.clientMessageId);
      
      let newConvMsgs;
      if (existingIdx >= 0) {
        newConvMsgs = [...convMsgs];
        newConvMsgs[existingIdx] = { ...newConvMsgs[existingIdx], ...message, status: message.status || 'sent' };
      } else {
        newConvMsgs = [...convMsgs, message];
      }
      
      // Update last message in conversation
      const conv = state.conversations[message.conversationId];
      const updatedConversations = { ...state.conversations };
      if (conv) {
        updatedConversations[message.conversationId] = {
          ...conv,
          lastMessage: message,
          updatedAt: message.createdAt
        };
      }

      return {
        messages: { ...state.messages, [message.conversationId]: newConvMsgs },
        conversations: updatedConversations
      };
    }),

  updateMessageStatus: (messageIds, status) =>
    set((state) => {
      const newMessages = { ...state.messages };
      Object.keys(newMessages).forEach((convId) => {
        newMessages[convId] = newMessages[convId].map((m) =>
          messageIds.includes(m.id) ? { ...m, status } : m
        );
      });
      return { messages: newMessages };
    }),

  updatePresence: (userId, status, lastSeen) =>
    set((state) => ({
      presence: { ...state.presence, [userId]: { status, lastSeen } },
    })),

  updateTyping: (conversationId, userId, isTyping) =>
    set((state) => {
      const currentTyping = state.typing[conversationId] || [];
      const newTyping = isTyping
        ? Array.from(new Set([...currentTyping, userId]))
        : currentTyping.filter((id) => id !== userId);
      return {
        typing: { ...state.typing, [conversationId]: newTyping },
      };
    }),

  clearStore: () =>
    set({
      connectionState: 'disconnected',
      conversations: {},
      messages: {},
      presence: {},
      typing: {},
    }),
}));
