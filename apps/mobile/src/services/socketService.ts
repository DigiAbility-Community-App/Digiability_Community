import { useAuthStore } from '@store/authStore';
import { useChatStore } from '@store/chatStore';
import { chatService } from './chatService';

// ─────────────────────────────────────────────────────────
// WebSocket Client Service
//
// Manages the ws connection to chat-svc. Handles reconnects,
// heartbeat, event dispatching, and message emission.
// ─────────────────────────────────────────────────────────

let socket: WebSocket | null = null;
let reconnectTimer: NodeJS.Timeout | null = null;
let pingTimer: NodeJS.Timeout | null = null;

const RECONNECT_INTERVAL = 3000;
const PING_INTERVAL = 15000;

export const initSocket = () => {
  const token = useAuthStore.getState().accessToken;
  if (!token) return;

  const baseUrl = (process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://10.0.2.2:4001').replace('http', 'ws');
  // Hack: our chat-svc runs on port 4002 locally. If BASE_URL is 4001, switch it.
  const wsUrl = baseUrl.replace('4001', '4002') + `/ws?token=${token}`;

  socket = new WebSocket(wsUrl);

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
    reconnectTimer = setTimeout(initSocket, RECONNECT_INTERVAL);
  };

  socket.onerror = (error) => {
    console.error('WebSocket error:', error);
  };
};

export const closeSocket = () => {
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

export const sendSocketMessage = (event: string, data: any) => {
  if (socket?.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ event, data, timestamp: Date.now() }));
  } else {
    console.warn('Socket not open. Cannot send:', event);
    // Queue offline messages in store? (Advanced: implement later)
  }
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
        status: 'delivered' as const,
        createdAt: payload.createdAt,
      };
      console.log('[WS-EVENT] message.new → addMessage', mapped.id, 'conv:', mapped.conversationId);
      store.addMessage(mapped);
      // Send delivery receipt to server
      sendSocketMessage('message.delivered', {
        messageId: payload.messageId,
      });
      break;
    }

    case 'message.ack':
      // Server confirmed our message was accepted into the system
      if (payload.status === 'accepted') {
        console.log('✅ Message accepted by server:', payload.messageId, 'clientMsgId:', payload.clientMessageId);
        // Update the optimistic message with the real server messageId
        store.confirmMessage(payload.clientMessageId, payload.messageId, 'sent');
      } else {
        console.warn('❌ Message rejected by server:', payload.reason);
      }
      break;

    case 'message.delivered':
      console.log('[WS-EVENT] message.delivered:', payload.messageIds || payload.messageId);
      store.updateMessageStatus(payload.messageIds || [payload.messageId], 'delivered');
      break;

    case 'message.read':
      store.updateMessageStatus(payload.messageIds || [payload.messageId], 'read');
      break;

    case 'presence.update':
      store.updatePresence(payload.userId, payload.status, payload.lastSeen);
      break;

    case 'typing.update':
      store.updateTyping(payload.conversationId, payload.userId, payload.isTyping);
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

    case 'error':
      console.error('Socket error event:', payload);
      break;

    default:
      if (type !== 'pong' && type !== 'heartbeat.pong' && type !== 'session.pong') {
        console.log('Unhandled socket event:', type, payload);
      }
  }
};
