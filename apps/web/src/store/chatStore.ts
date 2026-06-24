import { create } from 'zustand';

export interface ChatMessage {
  id: string;
  clientMessageId: string;
  conversationId: string;
  senderId: string;
  content: string;
  type: string;
  status: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
  createdAt: string;
}

export interface Conversation {
  id: string;
  type: 'DIRECT' | 'GROUP';
  subType?: 'GENERAL' | 'CARE_CIRCLE' | null;
  name?: string;
  avatarUrl?: string;
  lastMessage?: any;
  lastMessageText?: string;
  lastMessageAt?: string;
  sendMessages?: string;
  participants: any[];
  unreadCount: number;
}

interface ChatState {
  conversations: Record<string, Conversation>;
  messages: Record<string, ChatMessage[]>;
  connectionState: 'connected' | 'disconnected' | 'connecting';
  
  setConversations: (convos: Conversation[]) => void;
  addMessage: (message: ChatMessage) => void;
  confirmMessage: (clientId: string, serverId: string, status: any) => void;
  updateMessageStatus: (messageIds: string[], status: any) => void;
  setConnectionState: (state: any) => void;
  updatePresence: (userId: string, status: string, lastSeen?: string) => void;
  updateTyping: (convId: string, userId: string, isTyping: boolean) => void;
  clearUnreadCount: (conversationId: string) => void;
  incrementUnreadCount: (conversationId: string) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: {},
  messages: {},
  connectionState: 'disconnected',

  setConversations: (convos) => {
    const map = { ...get().conversations };
    convos.forEach(c => map[c.id] = c);
    set({ conversations: map });
  },

  addMessage: (msg) => {
    set((state) => {
      const convMsgs = state.messages[msg.conversationId] || [];
      const exists = convMsgs.some(m => m.id === msg.id || m.clientMessageId === msg.clientMessageId);
      if (exists) return state;

      const conv = state.conversations[msg.conversationId];
      const updatedConversations = { ...state.conversations };
      if (conv) {
        updatedConversations[msg.conversationId] = {
          ...conv,
          lastMessageText: msg.type === 'IMAGE' ? '[Image]' : msg.content,
          lastMessageAt: msg.createdAt,
        };
      }

      return {
        messages: {
          ...state.messages,
          [msg.conversationId]: [...convMsgs, msg].sort((a, b) => 
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          ),
        },
        conversations: updatedConversations,
      };
    });
  },

  confirmMessage: (clientId, serverId, status) => {
    set((state) => {
      const newMessages = { ...state.messages };
      for (const convId in newMessages) {
        newMessages[convId] = newMessages[convId].map(m => 
          m.clientMessageId === clientId ? { ...m, id: serverId, status } : m
        );
      }
      return { messages: newMessages };
    });
  },

  updateMessageStatus: (messageIds, status) => {
    set((state) => {
      const newMessages = { ...state.messages };
      for (const convId in newMessages) {
        newMessages[convId] = newMessages[convId].map(m => 
          messageIds.includes(m.id) ? { ...m, status } : m
        );
      }
      return { messages: newMessages };
    });
  },

  setConnectionState: (state) => set({ connectionState: state }),
  updatePresence: () => {}, // placeholder
  updateTyping: () => {}, // placeholder
  clearUnreadCount: (conversationId) => {
    set((state) => {
      const conv = state.conversations[conversationId];
      if (!conv || conv.unreadCount === 0) return state;
      return {
        conversations: {
          ...state.conversations,
          [conversationId]: { ...conv, unreadCount: 0 }
        }
      };
    });
  },
  incrementUnreadCount: (conversationId) => {
    set((state) => {
      const conv = state.conversations[conversationId];
      if (!conv) return state;
      return {
        conversations: {
          ...state.conversations,
          [conversationId]: { ...conv, unreadCount: (conv.unreadCount || 0) + 1 }
        }
      };
    });
  },
}));
