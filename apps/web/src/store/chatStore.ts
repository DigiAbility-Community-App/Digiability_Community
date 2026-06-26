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

export interface ConversationParticipant {
  userId: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'CAREGIVER' | 'MENTOR' | 'PROFESSIONAL';
  lastReadSequenceNo?: number;
  isMuted?: boolean;
  user?: { id: string; name: string; avatarUrl?: string };
}

export interface Conversation {
  id: string;
  type: 'DIRECT' | 'GROUP';
  subType?: 'GENERAL' | 'CARE_CIRCLE' | null;
  name?: string;
  description?: string;
  avatarUrl?: string;
  maxMembers?: number;
  editGroupInfo?: 'ADMINS_ONLY' | 'ALL_MEMBERS';
  addMembers?: 'ADMINS_ONLY' | 'ALL_MEMBERS';
  sendMessages?: 'ADMINS_ONLY' | 'ALL_MEMBERS';
  approveNewMembers?: boolean;
  participants: ConversationParticipant[];
  lastMessage?: ChatMessage;
  lastMessageText?: string;
  lastMessageAt?: string;
  unreadCount: number;
  updatedAt?: string;
}

export interface GroupInvite {
  id: string;
  conversationId: string;
  inviterId: string;
  inviteeId: string;
  role: string;
  message?: string;
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED' | 'CANCELLED';
  expiresAt: string;
  createdAt: string;
  conversation?: {
    id: string;
    name?: string;
    subType?: string;
    type: string;
  };
}

interface ChatState {
  connectionState: 'connected' | 'disconnected' | 'connecting';
  lastSyncTime: string;
  conversations: Record<string, Conversation>;
  messages: Record<string, ChatMessage[]>;
  presence: Record<string, { status: string; lastSeen: string }>;
  typing: Record<string, string[]>;
  pendingInvites: GroupInvite[];

  setConnectionState: (state: 'connected' | 'disconnected' | 'connecting') => void;
  setLastSyncTime: (time: string) => void;

  setConversations: (conversations: Conversation[]) => void;
  addConversation: (conversation: Conversation) => void;
  updateConversation: (conversationId: string, updates: Partial<Conversation>) => void;

  setPendingInvites: (invites: GroupInvite[]) => void;
  addPendingInvite: (invite: GroupInvite) => void;
  removePendingInvite: (inviteId: string) => void;

  setMessages: (conversationId: string, messages: ChatMessage[]) => void;
  addMessage: (message: ChatMessage) => void;
  removeMessage: (conversationId: string, messageId: string) => void;
  confirmMessage: (clientId: string, serverId: string, status?: 'sent' | 'delivered' | 'read') => void;
  updateMessageStatus: (messageIds: string[], status: 'delivered' | 'read') => void;

  updatePresence: (userId: string, status: string, lastSeen: string) => void;
  updateTyping: (conversationId: string, userId: string, isTyping: boolean) => void;

  clearUnreadCount: (conversationId: string) => void;
  incrementUnreadCount: (conversationId: string) => void;

  clearStore: () => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  connectionState: 'disconnected',
  lastSyncTime: new Date(0).toISOString(),
  conversations: {},
  messages: {},
  presence: {},
  typing: {},
  pendingInvites: [],

  setConnectionState: (state) => set({ connectionState: state }),
  setLastSyncTime: (time) => set({ lastSyncTime: time }),

  setConversations: (convos) => {
    const map = { ...get().conversations };
    convos.forEach((c) => { map[c.id] = c; });
    set({ conversations: map });
  },

  addConversation: (c) =>
    set((state) => ({ conversations: { ...state.conversations, [c.id]: c } })),

  updateConversation: (id, updates) =>
    set((state) => {
      const conv = state.conversations[id];
      if (!conv) return state;
      return { conversations: { ...state.conversations, [id]: { ...conv, ...updates } } };
    }),

  setPendingInvites: (invites) => set({ pendingInvites: invites }),

  addPendingInvite: (invite) =>
    set((state) => {
      if (state.pendingInvites.some((i) => i.id === invite.id)) return state;
      return { pendingInvites: [invite, ...state.pendingInvites] };
    }),

  removePendingInvite: (inviteId) =>
    set((state) => ({ pendingInvites: state.pendingInvites.filter((i) => i.id !== inviteId) })),

  setMessages: (conversationId, msgs) =>
    set((state) => ({ messages: { ...state.messages, [conversationId]: msgs } })),

  addMessage: (msg) =>
    set((state) => {
      const convMsgs = state.messages[msg.conversationId] || [];
      const existsByClientId = convMsgs.findIndex((m) => m.clientMessageId === msg.clientMessageId);
      const existsById = convMsgs.findIndex((m) => m.id === msg.id && msg.id !== msg.clientMessageId);

      let newConvMsgs;
      if (existsByClientId >= 0) {
        newConvMsgs = [...convMsgs];
        newConvMsgs[existsByClientId] = { ...newConvMsgs[existsByClientId], ...msg, status: msg.status || 'sent' };
      } else if (existsById >= 0) {
        return state;
      } else {
        newConvMsgs = [...convMsgs, msg].sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
      }

      const conv = state.conversations[msg.conversationId];
      const updatedConversations = { ...state.conversations };
      if (conv) {
        updatedConversations[msg.conversationId] = {
          ...conv,
          lastMessage: msg,
          lastMessageText: msg.type === 'IMAGE' ? '[Image]' : msg.content,
          lastMessageAt: msg.createdAt,
        };
      }

      return {
        messages: { ...state.messages, [msg.conversationId]: newConvMsgs },
        conversations: updatedConversations,
      };
    }),

  removeMessage: (conversationId, messageId) =>
    set((state) => ({
      messages: {
        ...state.messages,
        [conversationId]: (state.messages[conversationId] || []).filter(
          (m) => m.id !== messageId && m.clientMessageId !== messageId
        ),
      },
    })),

  confirmMessage: (clientId, serverId, status) =>
    set((state) => {
      const newMessages = { ...state.messages };
      for (const convId in newMessages) {
        const idx = newMessages[convId].findIndex((m) => m.clientMessageId === clientId);
        if (idx >= 0) {
          newMessages[convId] = [...newMessages[convId]];
          newMessages[convId][idx] = { ...newMessages[convId][idx], id: serverId, status: status || newMessages[convId][idx].status };
          break;
        }
      }
      return { messages: newMessages };
    }),

  updateMessageStatus: (messageIds, status) =>
    set((state) => {
      const newMessages = { ...state.messages };
      for (const convId in newMessages) {
        newMessages[convId] = newMessages[convId].map((m) =>
          messageIds.includes(m.id) ? { ...m, status } : m
        );
      }
      return { messages: newMessages };
    }),

  updatePresence: (userId, status, lastSeen) =>
    set((state) => ({ presence: { ...state.presence, [userId]: { status, lastSeen } } })),

  updateTyping: (conversationId, userId, isTyping) =>
    set((state) => {
      const current = state.typing[conversationId] || [];
      const updated = isTyping
        ? Array.from(new Set([...current, userId]))
        : current.filter((id) => id !== userId);
      return { typing: { ...state.typing, [conversationId]: updated } };
    }),

  clearUnreadCount: (conversationId) =>
    set((state) => {
      const conv = state.conversations[conversationId];
      if (!conv || conv.unreadCount === 0) return state;
      return { conversations: { ...state.conversations, [conversationId]: { ...conv, unreadCount: 0 } } };
    }),

  incrementUnreadCount: (conversationId) =>
    set((state) => {
      const conv = state.conversations[conversationId];
      if (!conv) return state;
      return {
        conversations: {
          ...state.conversations,
          [conversationId]: { ...conv, unreadCount: (conv.unreadCount || 0) + 1 },
        },
      };
    }),

  clearStore: () =>
    set({ connectionState: 'disconnected', conversations: {}, messages: {}, presence: {}, typing: {}, pendingInvites: [] }),
}));
