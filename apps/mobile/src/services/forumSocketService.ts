import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '../store/authStore';
import { useForumStore } from '../store/forumStore';

let socket: Socket | null = null;

export const forumSocketService = {
  connect: () => {
    const token = useAuthStore.getState().accessToken;
    if (!token) return;

    if (socket?.connected) return;

    const baseUrl =
      process.env.EXPO_PUBLIC_FORUM_API_URL ||
      (process.env.EXPO_PUBLIC_API_BASE_URL || 'http://10.0.2.2:4001').replace('4001', '4003');

    console.log(`[ForumSocket] Connecting to ${baseUrl}...`);

    socket = io(baseUrl, {
      auth: { token },
      transports: ['websocket'],
      reconnectionAttempts: 3,
    });

    socket.on('connect', () => {
      console.log('[ForumSocket] Connected to forum-svc successfully');
    });

    socket.on('connect_error', (error) => {
      // Silenced because forum-svc is not running by default
      // console.warn('[ForumSocket] Connection error:', error.message);
    });

    // Register forum-svc events
    socket.on('question_created', (data) => {
      useForumStore.getState().onSocketQuestionCreated(data);
    });

    socket.on('question_deleted', (data) => {
      useForumStore.getState().onSocketQuestionDeleted(data);
    });

    socket.on('question_reopened', (data) => {
      useForumStore.getState().onSocketQuestionReopened(data);
    });

    socket.on('answer_created', (data) => {
      useForumStore.getState().onSocketAnswerCreated(data);
    });

    socket.on('answer_updated', (data) => {
      useForumStore.getState().onSocketAnswerUpdated(data);
    });

    socket.on('answer_deleted', (data) => {
      useForumStore.getState().onSocketAnswerDeleted(data);
    });

    socket.on('answer_voted', (data) => {
      useForumStore.getState().onSocketAnswerVoted(data);
    });

    socket.on('answer_accepted', (data) => {
      useForumStore.getState().onSocketAnswerAccepted(data);
    });

    socket.on('notification', (data) => {
      useForumStore.getState().onSocketNotification(data);
    });

    socket.on('disconnect', (reason) => {
      console.log('[ForumSocket] Disconnected:', reason);
    });
  },

  disconnect: () => {
    if (socket) {
      socket.disconnect();
      socket = null;
      console.log('[ForumSocket] Connection closed');
    }
  }
};
