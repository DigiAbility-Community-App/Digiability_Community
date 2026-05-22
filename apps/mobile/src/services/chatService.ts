import apiClient from './apiClient';

const CHAT_BASE_URL = (process.env.EXPO_PUBLIC_API_BASE_URL || 'http://10.0.2.2:4001').replace('4001', '4002');

export const chatService = {
  getConversations: async () => {
    // Initialize the global bot conversation for the user
    try {
      await apiClient.post(`${CHAT_BASE_URL}/api/conversations/init-bot`);
    } catch (e) {
      console.warn('Failed to init bot conversation:', e);
    }

    const res = await apiClient.get(`${CHAT_BASE_URL}/api/conversations`);
    const conversations = res.data.data;

    // ── Enrich participants with user names ──────────────
    // The chat-svc only stores userId references. We batch-fetch
    // names from user-svc and attach them to each participant.
    try {
      // Collect all unique participant userIds
      const allUserIds = new Set<string>();
      for (const conv of conversations) {
        const members = conv.members || conv.participants || [];
        for (const m of members) {
          allUserIds.add(m.userId);
        }
      }

      if (allUserIds.size > 0) {
        // Batch fetch user names from user-svc
        const lookupRes = await apiClient.post('/api/auth/users/batch', {
          ids: [...allUserIds],
        });
        const userMap = new Map<string, string>();
        for (const u of lookupRes.data.data.users) {
          userMap.set(u.id, u.name);
        }

        // Attach user info to each participant
        for (const conv of conversations) {
          const members = conv.members || conv.participants || [];
          conv.participants = members.map((m: any) => ({
            ...m,
            user: {
              id: m.userId,
              name: userMap.get(m.userId) || 'Unknown',
            },
          }));
        }
      }
    } catch (err) {
      console.warn('Failed to enrich participant names:', err);
      // Graceful fallback: conversations still work, just without names
      for (const conv of conversations) {
        const members = conv.members || conv.participants || [];
        conv.participants = members.map((m: any) => ({
          ...m,
          user: { id: m.userId, name: 'Unknown' },
        }));
      }
    }

    return conversations;
  },

  getMessages: async (conversationId: string) => {
    const res = await apiClient.get(`${CHAT_BASE_URL}/api/messages/${conversationId}/history`);
    const rawMessages = res.data.data || [];
    // Map REST response to ChatMessage shape
    return rawMessages.map((m: any) => ({
      id: m.id || m.messageId,
      clientMessageId: m.clientMessageId || m.id || m.messageId,
      conversationId: m.conversationId || conversationId,
      senderId: m.senderId,
      content: m.content,
      type: m.type || 'TEXT',
      status: m.status === 'PERSISTED' ? 'sent' : (m.status || 'sent'),
      createdAt: m.createdAt,
    }));
  },

  searchUsers: async (query: string) => {
    const res = await apiClient.get('/api/auth/users/search', {
      params: { q: query },
    });
    return res.data.data.users as { id: string; name: string; email: string }[];
  },

  createGroup: async (name: string, memberIds: string[]) => {
    const res = await apiClient.post(`${CHAT_BASE_URL}/api/conversations`, {
      type: 'GROUP',
      name,
      memberIds,
    });
    return res.data.data;
  },
};
