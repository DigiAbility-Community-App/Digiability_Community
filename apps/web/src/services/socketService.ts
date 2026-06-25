import { useAuthStore } from '../store/authStore';
import { useChatStore } from '../store/chatStore';

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
    default:
      if (type !== 'pong' && type !== 'session.pong') {
        console.log('WS event:', type);
      }
  }
};
