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
              name: m.userId === '00000000-0000-0000-0000-000000000001' 
                ? 'DigiBot' 
                : (userMap.get(m.userId) || 'Unknown'),
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
          user: { 
            id: m.userId, 
            name: m.userId === '00000000-0000-0000-0000-000000000001' ? 'DigiBot' : 'Unknown' 
          },
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

  createDirectChat: async (userId: string) => {
    const res = await apiClient.post(`${CHAT_BASE_URL}/api/conversations`, {
      type: 'DIRECT',
      memberIds: [userId],
    });
    return res.data.data;
  },

  createGroup: async (name: string, description: string, memberIds: string[]) => {
    // Only pass memberIds on create to match chat-svc logic (which will only add creator).
    // Note: The UI will follow up by sending invites to these memberIds.
    const res = await apiClient.post(`${CHAT_BASE_URL}/api/conversations`, {
      type: 'GROUP',
      subType: 'GENERAL',
      name,
      description,
      memberIds: [], // We rely on invites now, but schema allows passing them
    });
    return res.data.data;
  },

  createCareCircle: async (
    name: string,
    description: string,
    memberRoles: { userId: string; role: string }[]
  ) => {
    // Care Circles add members via invites too
    const res = await apiClient.post(`${CHAT_BASE_URL}/api/conversations`, {
      type: 'GROUP',
      subType: 'CARE_CIRCLE',
      name,
      description,
      memberIds: [],
    });
    return res.data.data;
  },

  // ─── Group Settings & Member Management ──────────────
  updateGroupSettings: async (conversationId: string, settings: any) => {
    const res = await apiClient.patch(`${CHAT_BASE_URL}/api/conversations/${conversationId}/settings`, settings);
    return res.data.data;
  },

  updateGroupInfo: async (conversationId: string, info: { name?: string; description?: string }) => {
    const res = await apiClient.patch(`${CHAT_BASE_URL}/api/conversations/${conversationId}`, info);
    return res.data.data;
  },

  updateMemberRole: async (conversationId: string, userId: string, role: string) => {
    const res = await apiClient.patch(`${CHAT_BASE_URL}/api/conversations/${conversationId}/members/${userId}/role`, { role });
    return res.data;
  },

  // ─── Invite System ──────────────
  sendInvite: async (conversationId: string, userId: string, role: string = 'MEMBER', message?: string) => {
    const res = await apiClient.post(`${CHAT_BASE_URL}/api/invites/send`, {
      conversationId,
      userId,
      role,
      message,
    });
    return res.data.data;
  },

  respondToInvite: async (inviteId: string, action: 'accept' | 'decline') => {
    const res = await apiClient.post(`${CHAT_BASE_URL}/api/invites/${inviteId}/respond`, { action });
    return res.data.data;
  },

  getPendingInvites: async () => {
    const res = await apiClient.get(`${CHAT_BASE_URL}/api/invites/pending`);
    return res.data.data; // GroupInvite[]
  },

  cancelInvite: async (inviteId: string) => {
    const res = await apiClient.delete(`${CHAT_BASE_URL}/api/invites/${inviteId}`);
    return res.data;
  },
};
