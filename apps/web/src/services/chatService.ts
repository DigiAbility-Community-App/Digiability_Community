import apiClient from './apiClient';

const CHAT_BASE_URL = 'http://localhost:4002'; // Web uses 4002 for chat locally

export const chatService = {
  getConversations: async () => {
    try {
      await apiClient.post(`${CHAT_BASE_URL}/api/conversations/init-bot`);
    } catch (e) {
      console.warn('Failed to init bot:', e);
    }

    const res = await apiClient.get(`${CHAT_BASE_URL}/api/conversations`);
    const conversations = res.data.data;

    // ── Enrich participants with user names ──────────────
    // The chat-svc only stores userId references. We batch-fetch
    // names from user-svc and attach them to each participant.
    try {
      const allUserIds = new Set<string>();
      for (const conv of conversations) {
        const members = conv.members || conv.participants || [];
        for (const m of members) {
          allUserIds.add(m.userId);
        }
      }

      if (allUserIds.size > 0) {
        // Batch fetch user names from user-svc
        // We use apiClient which targets user-svc by default on web
        const lookupRes = await apiClient.post('/api/auth/users/batch', {
          ids: [...allUserIds],
        });
        const userMap = new Map<string, string>();
        for (const u of lookupRes.data.data.users) {
          userMap.set(u.id, u.name);
        }

        for (const conv of conversations) {
          const members = conv.members || conv.participants || [];
          conv.participants = members.map((m: any) => ({
            ...m,
            user: {
              id: m.userId,
              name: m.userId === '00000000-0000-0000-0000-000000000001' 
                ? 'DigiBot' 
                : (userMap.get(m.userId) || 'Unknown User'),
            },
          }));
        }
      }
    } catch (err) {
      console.warn('Failed to enrich participant names:', err);
      // Fallback
      for (const conv of conversations) {
        const members = conv.members || conv.participants || [];
        conv.participants = members.map((m: any) => ({
          ...m,
          user: { 
            id: m.userId, 
            name: m.userId === '00000000-0000-0000-0000-000000000001' ? 'DigiBot' : 'Unknown User' 
          },
        }));
      }
    }

    return conversations;
  },

  getMessages: async (conversationId: string) => {
    const res = await apiClient.get(`${CHAT_BASE_URL}/api/messages/${conversationId}/history`);
    return res.data.data.map((m: any) => {
      let computedStatus = m.status === 'PERSISTED' ? 'sent' : (m.status || 'sent');
      if (m.recipients && Array.isArray(m.recipients) && m.recipients.length > 0) {
        if (m.recipients.some((r: any) => r.status === 'DELIVERED' || r.status === 'READ')) {
          computedStatus = 'delivered';
        }
      }

      return {
        id: m.id || m.messageId,
        clientMessageId: m.clientMessageId || m.id || m.messageId,
        conversationId: m.conversationId || conversationId,
        senderId: m.senderId,
        content: m.content,
        type: m.type || 'TEXT',
        status: computedStatus,
        createdAt: m.createdAt,
      };
    });
  },
};
