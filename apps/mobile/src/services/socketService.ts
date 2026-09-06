import { useAuthStore } from '@store/authStore';
import { useChatStore } from '@store/chatStore';
import { chatService, CHAT_BASE_URL } from './chatService';

// ─────────────────────────────────────────────────────────
// WebSocket Client Service
//
// Manages the ws connection to chat-svc. Handles reconnects,
// heartbeat, event dispatching, and message emission.
// ─────────────────────────────────────────────────────────

let socket: WebSocket | null = null;
let reconnectTimer: NodeJS.Timeout | null = null;
let pingTimer: NodeJS.Timeout | null = null;

// Set by closeSocket() right before it closes the socket intentionally (e.g.
// the app was backgrounded, or the user logged out). Without this, the
// onclose handler below would schedule an auto-reconnect a few seconds later
// regardless of *why* the socket closed, undoing the intentional disconnect
// while the access token is still valid.
let manualClose = false;

const RECONNECT_INTERVAL = 3000;
const PING_INTERVAL = 15000;

export const initSocket = () => {
  const token = useAuthStore.getState().accessToken;
  if (!token) return;

  const wsUrl = CHAT_BASE_URL.replace(/^http/, 'ws') + '/ws';

  if (socket?.readyState === WebSocket.OPEN || socket?.readyState === WebSocket.CONNECTING) {
    return;
  }

  // A fresh connection attempt always wants normal auto-reconnect behavior
  // for whatever socket it opens, even if a previous manual close is still
  // in flight.
  manualClose = false;

  // Send the JWT in the Authorization header rather than the URL so it doesn't
  // appear in proxy access logs or server request logs.
  socket = new WebSocket(wsUrl, undefined, {
    headers: { Authorization: `Bearer ${token}` },
  } as any);

  socket.onopen = () => {
    console.log('✅ WebSocket connected to chat-svc');
    useChatStore.getState().setConnectionState('connected');
    
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }

    // Start heartbeat
    pingTimer = setInterval(() => {
      sendSocketMessage('session.ping', { timestamp: Date.now() });
    }, PING_INTERVAL);

    // Request offline sync
    const conversations = Object.values(useChatStore.getState().conversations);
    if (conversations.length > 0) {
      const syncPayload = {
        conversations: conversations.map(c => ({
          conversationId: c.id,
          lastSequenceNo: c.lastMessage ? (c.lastMessage as any).sequenceNo || 0 : 0
        }))
      };
      sendSocketMessage('sync.request', syncPayload);
    }
  };

  socket.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      handleSocketEvent(data);
    } catch (e) {
      console.error('Failed to parse socket message:', e);
    }
  };

  socket.onclose = () => {
    console.log('❌ WebSocket disconnected');
    useChatStore.getState().setConnectionState('disconnected');
    cleanup();
    if (manualClose) {
      // Intentional close (backgrounded / logged out) — don't auto-reconnect.
      manualClose = false;
      return;
    }
    reconnectTimer = setTimeout(initSocket, RECONNECT_INTERVAL);
  };

  socket.onerror = (error) => {
    console.error('WebSocket error:', error);
  };
};

export const closeSocket = () => {
  manualClose = true;
  if (reconnectTimer) clearTimeout(reconnectTimer);
  cleanup();
  if (socket) {
    socket.close();
    socket = null;
  }
};

const cleanup = () => {
  if (pingTimer) {
    clearInterval(pingTimer);
    pingTimer = null;
  }
};

/**
 * Returns true if the payload actually went out over the socket.
 *
 * Callers that send a user's message MUST check this. Returning void here
 * meant a send with a closed socket was dropped with only a console warning,
 * while the optimistic bubble stayed on screen — the sender believed the
 * message had been delivered and nobody else ever received it.
 */
export const sendSocketMessage = (event: string, data: any): boolean => {
  if (socket?.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ event, data, timestamp: Date.now() }));
    return true;
  }
  console.warn('Socket not open. Cannot send:', event);
  return false;
};

// ── Event Handlers ──────────────────────────────────────────

const handleSocketEvent = (message: any) => {
  const store = useChatStore.getState();
  const type = message.event || message.type;
  const payload = message.data || message.payload;

  console.log('[WS-EVENT]', type, JSON.stringify(payload)?.substring(0, 200));

  switch (type) {
    case 'message.new': {
      // Server sends { messageId, conversationId, senderId, content, type, sequenceNo, createdAt }
      const currentUserId = useAuthStore.getState().user?.id;
      
      // Skip messages sent by the current user — they already have the
      // optimistic version. This prevents duplicates from cross-device sync
      // or delivery worker echo.
      if (payload.senderId === currentUserId) {
        console.log('[WS-EVENT] message.new → skipping own message', payload.messageId);
        break;
      }
      
      const mapped = {
        id: payload.messageId,
        clientMessageId: payload.clientMessageId || payload.messageId,
        conversationId: payload.conversationId,
        senderId: payload.senderId,
        content: payload.content,
        type: payload.type || 'TEXT',
        metadata: payload.metadata,
        status: 'delivered' as const,
        createdAt: payload.createdAt,
      };
      console.log('[WS-EVENT] message.new → addMessage', mapped.id, 'conv:', mapped.conversationId);
      // First-ever message of a brand-new conversation someone started with us:
      // the conversation isn't in the store yet, so addMessage's `if (conv)`
      // guard silently skips setting lastMessageText. Fetch + await the fresh
      // conversation list BEFORE addMessage runs (rather than firing both
      // concurrently) so the conversation exists in the store by the time
      // addMessage tries to attach its lastMessage.
      (async () => {
        if (!store.conversations[payload.conversationId]) {
          try {
            const convos = await chatService.getConversations();
            store.setConversations(convos);
          } catch {
            // best-effort — addMessage below still runs even if this fails
          }
        }
        store.addMessage(mapped);
        // Increment unread count
        store.incrementUnreadCount(payload.conversationId);
        // Send delivery receipt to server
        sendSocketMessage('message.delivered', {
          messageId: payload.messageId,
        });
      })();
      break;
    }

    case 'message.ack':
      // Server confirmed our message was accepted into the system
      if (payload.status === 'accepted') {
        console.log('✅ Message accepted by server:', payload.messageId, 'clientMsgId:', payload.clientMessageId);
        // Update the optimistic message with the real server messageId
        store.confirmMessage(payload.clientMessageId, payload.messageId, 'sent');
      } else {
        // Server refused the message (group suspended, blocked, moderation,
        // not a member, ...). Mark it failed instead of leaving the
        // optimistic bubble stuck on "sending" with no explanation — the
        // chat screens watch for a newly-failed message and show a themed
        // dialog with the reason (see ChatScreen/GroupChatScreen).
        console.warn('❌ Message rejected by server:', payload.reason);
        store.failMessage(payload.clientMessageId, payload.reason);
      }
      break;

    case 'message.delivered.receipt':
      console.log('[WS-EVENT] message.delivered.receipt:', payload.messageIds || payload.messageId);
      store.updateMessageStatus(payload.messageIds || [payload.messageId], 'delivered');
      break;

    case 'message.read.receipt':
      // The recipient read our message — update the message status to 'read'
      // so the sender sees the seen (coloured double-tick) in real time.
      console.log('[WS-EVENT] message.read.receipt:', payload.messageId);
      store.updateMessageStatus([payload.messageId], 'read');
      break;

    case 'presence.update':
      store.updatePresence(payload.userId, payload.status, payload.lastSeen);
      break;

    case 'typing.update':
      store.updateTyping(payload.conversationId, payload.userId, payload.isTyping);
      break;

    // Backend broadcasts these two events (no isTyping flag). The old
    // 'typing.update' case above never fires with the real backend.
    case 'typing.start.broadcast':
      store.updateTyping(payload.conversationId, payload.userId, true);
      break;

    case 'typing.stop.broadcast':
      store.updateTyping(payload.conversationId, payload.userId, false);
      break;

    case 'sync.complete':
    case 'sync.response':
      // Sync contains missed messages for a conversation
      if (payload.messages?.length > 0) {
        console.log('[WS-EVENT] sync: received', payload.messages.length, 'missed messages');
        payload.messages.forEach((msg: any) => {
          const mapped = {
            id: msg.messageId || msg.id,
            clientMessageId: msg.clientMessageId || msg.messageId || msg.id,
            conversationId: msg.conversationId,
            senderId: msg.senderId,
            content: msg.content,
            type: msg.type || 'TEXT',
            metadata: msg.metadata,
            status: 'delivered' as const,
            createdAt: msg.createdAt,
          };
          store.addMessage(mapped);
        });
        // Send delivery receipts for missed messages
        const missedMsgIds = payload.messages.map((m: any) => m.messageId || m.id);
        for (const msgId of missedMsgIds) {
          if (msgId) sendSocketMessage('message.delivered', { messageId: msgId });
        }
      }
      store.setLastSyncTime(new Date().toISOString());
      break;

    case 'connection.established':
      console.log('🔗 Session ID:', payload.connId);
      break;

    // ── Group & Invite Events ──────────────────────────────────────
    case 'invite.new':
      console.log('📬 New invite received:', payload);
      // Payload has: inviteId, conversationId, groupName, subType, inviterId, role, message, expiresAt
      store.addPendingInvite({
        id: payload.inviteId,
        conversationId: payload.conversationId,
        inviterId: payload.inviterId,
        inviteeId: useAuthStore.getState().user?.id || '',
        role: payload.role,
        message: payload.message,
        status: 'PENDING',
        expiresAt: payload.expiresAt,
        createdAt: new Date().toISOString(),
        conversation: {
          id: payload.conversationId,
          name: payload.groupName,
          subType: payload.subType,
          type: 'GROUP',
        }
      });
      break;

    case 'invite.accepted':
    case 'invite.declined':
    case 'invite.cancelled':
      console.log(`📪 Invite ${type.split('.')[1]}:`, payload.inviteId);
      store.removePendingInvite(payload.inviteId);
      break;

    case 'member.joined':
      console.log('👤 Member joined:', payload);
      // Refresh conversations to get updated members
      chatService.getConversations().then(convos => store.setConversations(convos));
      break;

    case 'member.left':
    case 'member.removed':
      console.log('👤 Member left/removed:', payload);
      // Refresh conversations to get updated members
      chatService.getConversations().then(convos => store.setConversations(convos));
      break;

    case 'group.settings.updated':
    case 'group.info.updated':
    case 'member.role.updated':
      console.log('⚙️ Group updated:', type, payload);
      // Refresh conversations to get updated info/roles
      chatService.getConversations().then(convos => store.setConversations(convos));
      break;

    case 'message.deleted':
      console.log('[WS-EVENT] message.deleted:', payload);
      if (payload.conversationId && payload.messageId) {
        store.removeMessage(payload.conversationId, payload.messageId);
      }
      break;

    case 'group.deleted':
      console.log('[WS-EVENT] group.deleted:', payload);
      if (payload.conversationId) {
        store.removeConversation(payload.conversationId);
      }
      break;

    case 'error':
      console.error('Socket error event:', payload);
      break;

    default:
      if (type !== 'pong' && type !== 'heartbeat.pong' && type !== 'session.pong') {
        console.log('Unhandled socket event:', type, payload);
      }
  }
};
