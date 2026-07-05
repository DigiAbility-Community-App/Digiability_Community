import { useAuthStore } from '../store/authStore';
import { useChatStore } from '../store/chatStore';
import { chatService } from './chatService';

let socket: WebSocket | null = null;
let reconnectTimer: number | null = null;
let pingTimer: number | null = null;

const RECONNECT_INTERVAL = 3000;
const PING_INTERVAL = 15000;

export const initSocket = () => {
  const token = useAuthStore.getState().accessToken;
  if (!token) return;

  const wsUrl = `ws://localhost:4002/ws?token=${token}`;

  if (socket?.readyState === WebSocket.OPEN || socket?.readyState === WebSocket.CONNECTING) return;

  socket = new WebSocket(wsUrl);

  socket.onopen = () => {
    console.log('✅ WebSocket connected to chat-svc (Web)');
    useChatStore.getState().setConnectionState('connected');

    if (reconnectTimer) {
      window.clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }

    pingTimer = window.setInterval(() => {
      sendSocketMessage('session.ping', { timestamp: Date.now() });
    }, PING_INTERVAL);

    // Request offline sync
    const conversations = Object.values(useChatStore.getState().conversations);
    if (conversations.length > 0) {
      sendSocketMessage('sync.request', {
        conversations: conversations.map((c) => ({
          conversationId: c.id,
          lastSequenceNo: (c.lastMessage as any)?.sequenceNo || 0,
        })),
      });
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
    reconnectTimer = window.setTimeout(initSocket, RECONNECT_INTERVAL);
  };
};

export const closeSocket = () => {
  if (reconnectTimer) window.clearTimeout(reconnectTimer);
  cleanup();
  if (socket) {
    socket.close();
    socket = null;
  }
};

const cleanup = () => {
  if (pingTimer) {
    window.clearInterval(pingTimer);
    pingTimer = null;
  }
};

export const sendSocketMessage = (event: string, data: any) => {
  if (socket?.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ event, data, timestamp: Date.now() }));
  } else {
    console.warn('Socket not open. Cannot send:', event);
  }
};

const handleSocketEvent = (message: any) => {
  const store = useChatStore.getState();
  const type = message.event || message.type;
  const payload = message.data || message.payload;

  console.log('[WS-EVENT]', type, JSON.stringify(payload)?.substring(0, 200));

  switch (type) {
    case 'message.new': {
      const currentUserId = useAuthStore.getState().user?.id;
      if (payload.senderId === currentUserId) break;

      store.addMessage({
        id: payload.messageId,
        clientMessageId: payload.clientMessageId || payload.messageId,
        conversationId: payload.conversationId,
        senderId: payload.senderId,
        content: payload.content,
        type: payload.type || 'TEXT',
        metadata: payload.metadata,
        status: 'delivered',
        createdAt: payload.createdAt,
      });
      store.incrementUnreadCount(payload.conversationId);
      sendSocketMessage('message.delivered', { messageId: payload.messageId });
      break;
    }

    case 'message.ack':
      if (payload.status === 'accepted') {
        store.confirmMessage(payload.clientMessageId, payload.messageId, 'sent');
      }
      break;

    case 'message.delivered.receipt':
      store.updateMessageStatus(payload.messageIds || [payload.messageId], 'delivered');
      break;

    case 'message.read.receipt':
      store.updateMessageStatus(payload.messageIds || [payload.messageId], 'read');
      break;

    case 'message.deleted':
      if (payload.conversationId && payload.messageId) {
        store.removeMessage(payload.conversationId, payload.messageId);
      }
      break;

    case 'group.deleted':
      if (payload.conversationId) {
        store.removeConversation(payload.conversationId);
      }
      break;

    case 'presence.update':
      store.updatePresence(payload.userId, payload.status, payload.lastSeen || new Date().toISOString());
      break;

    case 'typing.update':
    case 'typing.start.broadcast':
      store.updateTyping(payload.conversationId, payload.userId, true);
      break;

    case 'typing.stop.broadcast':
      store.updateTyping(payload.conversationId, payload.userId, false);
      break;

    case 'sync.response':
    case 'sync.complete':
      if (payload.messages?.length > 0) {
        payload.messages.forEach((msg: any) => {
          store.addMessage({
            id: msg.messageId || msg.id,
            clientMessageId: msg.clientMessageId || msg.messageId || msg.id,
            conversationId: msg.conversationId,
            senderId: msg.senderId,
            content: msg.content,
            type: msg.type || 'TEXT',
            metadata: msg.metadata,
            status: 'delivered',
            createdAt: msg.createdAt,
          });
        });
      }
      store.setLastSyncTime(new Date().toISOString());
      break;

    // ── Invite Events ───────────────────────────────────────────
    case 'invite.new':
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
        },
      });
      break;

    case 'invite.accepted':
    case 'invite.declined':
    case 'invite.cancelled':
      store.removePendingInvite(payload.inviteId);
      break;

    // ── Group / Member Events ──────────────────────────────────
    case 'member.joined':
    case 'member.left':
    case 'member.removed':
      // Refresh conversation list to get updated members
      chatService.getConversations().then((convos) => store.setConversations(convos));
      break;

    case 'group.settings.updated':
      if (payload.conversationId) {
        store.updateConversation(payload.conversationId, {
          editGroupInfo: payload.editGroupInfo,
          addMembers: payload.addMembers,
          sendMessages: payload.sendMessages,
          approveNewMembers: payload.approveNewMembers,
        });
      }
      break;

    case 'group.info.updated':
      if (payload.conversationId) {
        store.updateConversation(payload.conversationId, {
          name: payload.name,
          description: payload.description,
        });
      }
      break;

    case 'member.role.updated':
      // Re-fetch conversations to get updated roles
      chatService.getConversations().then((convos) => store.setConversations(convos));
      break;

    case 'connection.established':
      console.log('🔗 Session ID:', payload.connId);
      break;

    case 'error':
      console.error('Socket error event:', payload);
      break;

    default:
      if (type !== 'pong' && type !== 'session.pong' && type !== 'heartbeat.pong') {
        console.log('WS event:', type, payload);
      }
  }
};
