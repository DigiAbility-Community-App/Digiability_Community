import { create } from 'zustand';
import { formatMessagePreview } from '../utils/messagePreview';

export interface ChatMessage {
  id: string;
  clientMessageId: string;
  conversationId: string;
  senderId: string;
  content: string;
  type: string;
  metadata?: string; // JSON string: { altText?, durationMs?, mimeType?, ... }
  status: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
  /** Why the server rejected this message (only set when status is 'failed'). */
  failureReason?: string;
  /** True once the rejection dialog has been shown for this message — keeps
   *  it from re-appearing on every remount (e.g. leaving and re-entering the
   *  chat). Lives here rather than in screen-local state because it must
   *  outlive the screen's own mount lifecycle the same way status does. */
  failureAcknowledged?: boolean;
  createdAt: string;
  /** Set when a moderator or the sender removed this message — content is
   *  blanked server-side when this is set, so render a placeholder instead
   *  of the (empty) content. */
  deletedAt?: string | null;
  /** True once the current user has reported this message. Only ever
   *  populated for the reporter's own view — never shown to other members. */
  reportedByMe?: boolean;
}

export interface ConversationParticipant {
  userId: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'CAREGIVER' | 'MENTOR' | 'PROFESSIONAL';
  lastReadSequenceNo?: number;
  isMuted?: boolean;
  user?: { id: string; name: string; avatarUrl?: string; deletedAt?: string | null; isSuspended?: boolean | null };
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
  updatedAt: string;
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
  messages: Record<string, ChatMessage[]>; // keyed by conversationId
  presence: Record<string, { status: string; lastSeen: string }>;
  typing: Record<string, string[]>; // conversationId -> array of userIds typing
  pendingInvites: GroupInvite[];

  setConnectionState: (state: 'connected' | 'disconnected' | 'connecting') => void;
  setLastSyncTime: (time: string) => void;
  
  setConversations: (conversations: Conversation[]) => void;
  addConversation: (conversation: Conversation) => void;
  updateConversation: (conversationId: string, updates: Partial<Conversation>) => void;
  removeConversation: (conversationId: string) => void;
  
  setPendingInvites: (invites: GroupInvite[]) => void;
  addPendingInvite: (invite: GroupInvite) => void;
  removePendingInvite: (inviteId: string) => void;
  
  setMessages: (conversationId: string, messages: ChatMessage[]) => void;
  addMessage: (message: ChatMessage) => void;
  removeMessage: (conversationId: string, messageId: string) => void;
  confirmMessage: (clientMessageId: string, serverMessageId: string, status?: 'sent' | 'delivered' | 'read') => void;
  /** Mark an optimistic message as rejected by the server, with the reason. */
  failMessage: (clientMessageId: string, reason?: string) => void;
  /** Mark a failed message's rejection dialog as already shown to the user. */
  acknowledgeMessageFailure: (clientMessageId: string) => void;
  updateMessageStatus: (messageIds: string[], status: 'delivered' | 'read') => void;
  /** Mark a message as reported by the current user (optimistic, right after
   *  a successful report submission, or bulk-applied on conversation load
   *  from the server's list of previously-reported message ids). */
  markMessageReported: (messageId: string) => void;

  updatePresence: (userId: string, status: string, lastSeen: string) => void;
  updateTyping: (conversationId: string, userId: string, isTyping: boolean) => void;
  
  clearUnreadCount: (conversationId: string) => void;
  incrementUnreadCount: (conversationId: string) => void;

  clearStore: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
  connectionState: 'disconnected',
  lastSyncTime: new Date(0).toISOString(),
  conversations: {},
  messages: {},
  presence: {},
  typing: {},
  pendingInvites: [],

  setConnectionState: (state) => set({ connectionState: state }),
  setLastSyncTime: (time) => set({ lastSyncTime: time }),

  setConversations: (convos) =>
    // Replace (not merge) so a fresh fetch fully reflects the current
    // user's conversations — leftover entries from a previous account
    // or a stale socket event can't survive a reload. The one exception:
    // an optimistic send (or a WS event already applied locally) can be
    // newer than what this REST fetch returns if the fetch raced ahead of
    // chat-svc's async persist worker — in that case keep the locally-set
    // last-message preview instead of regressing it back to blank/stale data.
    set((state) => {
      const newConvos: Record<string, (typeof convos)[number]> = {};
      convos.forEach((c) => {
        const existing = state.conversations[c.id];
        const existingIsNewer =
          existing?.updatedAt && c.updatedAt && new Date(existing.updatedAt) > new Date(c.updatedAt);
        newConvos[c.id] = existingIsNewer
          ? {
              ...c,
              lastMessage: existing.lastMessage,
              lastMessageText: existing.lastMessageText,
              lastMessageAt: existing.lastMessageAt,
              updatedAt: existing.updatedAt,
            }
          : c;
      });
      return { conversations: newConvos };
    }),

  addConversation: (c) =>
    set((state) => ({
      conversations: { ...state.conversations, [c.id]: c },
    })),

  updateConversation: (id, updates) =>
    set((state) => {
      const conv = state.conversations[id];
      if (!conv) return state;
      return {
        conversations: {
          ...state.conversations,
          [id]: { ...conv, ...updates },
        },
      };
    }),

  removeConversation: (id) =>
    set((state) => {
      if (!state.conversations[id]) return state;
      const conversations = { ...state.conversations };
      delete conversations[id];
      const messages = { ...state.messages };
      delete messages[id];
      return { conversations, messages };
    }),

  setPendingInvites: (invites) => set({ pendingInvites: invites }),
  
  addPendingInvite: (invite) =>
    set((state) => {
      const existing = state.pendingInvites.findIndex(i => i.id === invite.id);
      if (existing >= 0) return state; // Avoid duplicates
      return { pendingInvites: [invite, ...state.pendingInvites] };
    }),
    
  removePendingInvite: (inviteId) =>
    set((state) => ({
      pendingInvites: state.pendingInvites.filter((i) => i.id !== inviteId),
    })),

  setMessages: (conversationId, newMessages) =>
    set((state) => ({
      messages: { ...state.messages, [conversationId]: newMessages },
    })),

  addMessage: (message) =>
    set((state) => {
      const convMsgs = state.messages[message.conversationId] || [];
      
      // Deduplicate by both clientMessageId AND server id
      const existingByClientId = convMsgs.findIndex(m => m.clientMessageId === message.clientMessageId);
      const existingById = convMsgs.findIndex(m => m.id === message.id && message.id !== message.clientMessageId);
      
      let newConvMsgs;
      if (existingByClientId >= 0) {
        // Replace optimistic message with server-confirmed version
        newConvMsgs = [...convMsgs];
        newConvMsgs[existingByClientId] = { ...newConvMsgs[existingByClientId], ...message, status: message.status || 'sent' };
      } else if (existingById >= 0) {
        // Already have this server message — skip duplicate
        return state;
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
          lastMessageText: formatMessagePreview(message.type, message.content),
          lastMessageAt: message.createdAt,
          updatedAt: message.createdAt
        };
      }

      return {
        messages: { ...state.messages, [message.conversationId]: newConvMsgs },
        conversations: updatedConversations
      };
    }),

  removeMessage: (conversationId, messageId) =>
    set((state) => ({
      messages: {
        ...state.messages,
        [conversationId]: (state.messages[conversationId] || []).filter(m => m.id !== messageId && m.clientMessageId !== messageId),
      },
    })),

  confirmMessage: (clientMessageId, serverMessageId, status) =>
    set((state) => {
      const newMessages = { ...state.messages };
      for (const convId of Object.keys(newMessages)) {
        const idx = newMessages[convId].findIndex(m => m.clientMessageId === clientMessageId);
        if (idx >= 0) {
          newMessages[convId] = [...newMessages[convId]];
          newMessages[convId][idx] = {
            ...newMessages[convId][idx],
            id: serverMessageId,
            status: status || newMessages[convId][idx].status,
          };
          break;
        }
      }
      return { messages: newMessages };
    }),

  failMessage: (clientMessageId, reason) =>
    set((state) => {
      const newMessages = { ...state.messages };
      for (const convId of Object.keys(newMessages)) {
        const idx = newMessages[convId].findIndex(m => m.clientMessageId === clientMessageId);
        if (idx >= 0) {
          newMessages[convId] = [...newMessages[convId]];
          newMessages[convId][idx] = {
            ...newMessages[convId][idx],
            status: 'failed',
            failureReason: reason,
          };
          break;
        }
      }
      return { messages: newMessages };
    }),

  acknowledgeMessageFailure: (clientMessageId) =>
    set((state) => {
      const newMessages = { ...state.messages };
      for (const convId of Object.keys(newMessages)) {
        const idx = newMessages[convId].findIndex(m => m.clientMessageId === clientMessageId);
        if (idx >= 0) {
          newMessages[convId] = [...newMessages[convId]];
          newMessages[convId][idx] = {
            ...newMessages[convId][idx],
            failureAcknowledged: true,
          };
          break;
        }
      }
      return { messages: newMessages };
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

  markMessageReported: (messageId) =>
    set((state) => {
      const newMessages = { ...state.messages };
      for (const convId of Object.keys(newMessages)) {
        const idx = newMessages[convId].findIndex((m) => m.id === messageId);
        if (idx >= 0) {
          newMessages[convId] = [...newMessages[convId]];
          newMessages[convId][idx] = {
            ...newMessages[convId][idx],
            reportedByMe: true,
          };
          break;
        }
      }
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

  clearUnreadCount: (conversationId) =>
    set((state) => {
      const conv = state.conversations[conversationId];
      if (!conv || conv.unreadCount === 0) return state;
      return {
        conversations: {
          ...state.conversations,
          [conversationId]: { ...conv, unreadCount: 0 }
        }
      };
    }),

  incrementUnreadCount: (conversationId) =>
    set((state) => {
      const conv = state.conversations[conversationId];
      if (!conv) return state;
      return {
        conversations: {
          ...state.conversations,
          [conversationId]: { ...conv, unreadCount: (conv.unreadCount || 0) + 1 }
        }
      };
    }),

  clearStore: () =>
    set({
      connectionState: 'disconnected',
      conversations: {},
      messages: {},
      presence: {},
      typing: {},
      pendingInvites: [],
    }),
}));
