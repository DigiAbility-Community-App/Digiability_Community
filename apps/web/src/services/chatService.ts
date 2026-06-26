import apiClient from './apiClient';

const CHAT_BASE_URL = 'http://localhost:4002';

export const chatService = {
  getConversations: async () => {
    try {
      await apiClient.post(`${CHAT_BASE_URL}/api/conversations/init-bot`);
    } catch (e) {
      console.warn('Failed to init bot:', e);
    }

    const res = await apiClient.get(`${CHAT_BASE_URL}/api/conversations`);
    const conversations = res.data.data;

    try {
      const allUserIds = new Set<string>();
      for (const conv of conversations) {
        const members = conv.members || conv.participants || [];
        for (const m of members) allUserIds.add(m.userId);
      }

      if (allUserIds.size > 0) {
        const lookupRes = await apiClient.post('/api/auth/users/batch', { ids: [...allUserIds] });
        const userMap = new Map<string, string>();
        for (const u of lookupRes.data.data.users) userMap.set(u.id, u.name);

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
      for (const conv of conversations) {
        const members = conv.members || conv.participants || [];
        conv.participants = members.map((m: any) => ({
          ...m,
          user: {
            id: m.userId,
            name: m.userId === '00000000-0000-0000-0000-000000000001' ? 'DigiBot' : 'Unknown User',
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
      if (m.recipients?.some((r: any) => r.status === 'DELIVERED' || r.status === 'READ')) {
        computedStatus = 'delivered';
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

  searchUsers: async (query: string) => {
    const res = await apiClient.get('/api/auth/users/search', { params: { q: query } });
    return res.data.data.users as { id: string; name: string; email: string }[];
  },

  createDirectChat: async (userId: string) => {
    const res = await apiClient.post(`${CHAT_BASE_URL}/api/conversations`, {
      type: 'DIRECT',
      memberIds: [userId],
    });
    return res.data.data;
  },

  createGroup: async (name: string, description: string, _memberIds: string[]) => {
    const res = await apiClient.post(`${CHAT_BASE_URL}/api/conversations`, {
      type: 'GROUP',
      subType: 'GENERAL',
      name,
      description,
      memberIds: [],
    });
    return res.data.data;
  },

  createCareCircle: async (name: string, description: string, _memberRoles: { userId: string; role: string }[]) => {
    const res = await apiClient.post(`${CHAT_BASE_URL}/api/conversations`, {
      type: 'GROUP',
      subType: 'CARE_CIRCLE',
      name,
      description,
      memberIds: [],
    });
    return res.data.data;
  },

  updateGroupSettings: async (conversationId: string, settings: Record<string, any>) => {
    const res = await apiClient.patch(`${CHAT_BASE_URL}/api/conversations/${conversationId}/settings`, settings);
    return res.data.data;
  },

  updateGroupInfo: async (conversationId: string, info: { name?: string; description?: string }) => {
    const res = await apiClient.patch(`${CHAT_BASE_URL}/api/conversations/${conversationId}`, info);
    return res.data.data;
  },

  updateMemberRole: async (conversationId: string, userId: string, role: string) => {
    const res = await apiClient.patch(
      `${CHAT_BASE_URL}/api/conversations/${conversationId}/members/${userId}/role`,
      { role }
    );
    return res.data;
  },

  sendInvite: async (conversationId: string, userId: string, role = 'MEMBER', message?: string) => {
    const res = await apiClient.post(`${CHAT_BASE_URL}/api/invites/send`, {
      conversationId, userId, role, message,
    });
    return res.data.data;
  },

  respondToInvite: async (inviteId: string, action: 'accept' | 'decline') => {
    const res = await apiClient.post(`${CHAT_BASE_URL}/api/invites/${inviteId}/respond`, { action });
    return res.data.data;
  },

  getPendingInvites: async () => {
    const res = await apiClient.get(`${CHAT_BASE_URL}/api/invites/pending`);
    return res.data.data;
  },

  cancelInvite: async (inviteId: string) => {
    const res = await apiClient.delete(`${CHAT_BASE_URL}/api/invites/${inviteId}`);
    return res.data;
  },

  removeMember: async (conversationId: string, userId: string) => {
    const res = await apiClient.delete(
      `${CHAT_BASE_URL}/api/conversations/${conversationId}/members/${userId}`
    );
    return res.data;
  },

  transferOwnership: async (conversationId: string, newOwnerId: string) => {
    const res = await apiClient.post(
      `${CHAT_BASE_URL}/api/conversations/${conversationId}/transfer-ownership`,
      { userId: newOwnerId }
    );
    return res.data;
  },

  approveJoinRequest: async (inviteId: string, approve: boolean) => {
    const res = await apiClient.post(
      `${CHAT_BASE_URL}/api/conversations/join-requests/${inviteId}/approve`,
      { approve }
    );
    return res.data;
  },

  muteConversation: async (conversationId: string, muted: boolean) => {
    const res = await apiClient.patch(`${CHAT_BASE_URL}/api/conversations/${conversationId}/mute`, { muted });
    return res.data;
  },

  pinConversation: async (conversationId: string, pinned: boolean) => {
    const res = await apiClient.patch(`${CHAT_BASE_URL}/api/conversations/${conversationId}/pin`, { pinned });
    return res.data;
  },

  deleteMessage: async (conversationId: string, messageId: string, deleteFor: 'me' | 'everyone') => {
    // Sent via WebSocket — no REST endpoint; this is a placeholder for the WS emit pattern
    return { conversationId, messageId, deleteFor };
  },
};
