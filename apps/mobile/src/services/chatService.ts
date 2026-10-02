import apiClient from './apiClient';
import { useAuthStore } from '@store/authStore';
import { CHAT_API_URL } from '@config/env';

export const CHAT_BASE_URL = CHAT_API_URL;

/** True for a URI that points at a file on this device rather than the server. */
export function isLocalMediaUri(uri: string): boolean {
  return /^(file|content|ph|assets-library|data):/i.test(uri);
}

// Resolve a media path/URL returned by the server. New uploads return a
// host-relative path ("/uploads/x.jpg") which each client resolves against its
// own chat-svc base; older absolute URLs pass through unchanged.
export function resolveMediaUrl(pathOrUrl: string): string {
  if (!pathOrUrl) return pathOrUrl;
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  // Device-local URIs (file://, content://, ph://, data:) belong to an image
  // still being uploaded — the optimistic bubble previews it from the device.
  if (isLocalMediaUri(pathOrUrl)) return pathOrUrl;
  return `${CHAT_BASE_URL}${pathOrUrl.startsWith('/') ? '' : '/'}${pathOrUrl}`;
}

export interface CommunityGroup {
  id: string;
  name: string;
  description: string | null;
  subType: string;
  memberCount: number;
  isMember: boolean;
  lastMessageText: string | null;
  lastMessageAt: string | null;
  createdAt: string;
  avatarUrl: string | null;
}

const BOT_USER_ID = '00000000-0000-0000-0000-000000000001';

export interface BatchLookupUser {
  name: string;
}

// user-svc caps /auth/users/batch at 50 ids per request.
const BATCH_LOOKUP_MAX = 50;

export const chatService = {
  /**
   * Batch-resolve display names for a list of user IDs via user-svc's
   * /auth/users/batch endpoint. Shared by getConversations() (current
   * participants), group member history and the group invite list, to avoid
   * N+1 requests.
   *
   * user-svc only returns users the caller shares a conversation or invite
   * with, and never returns deleted accounts. An id missing from the result
   * is therefore treated as an account that no longer exists.
   */
  batchLookupUsers: async (ids: string[]): Promise<Map<string, BatchLookupUser>> => {
    const map = new Map<string, BatchLookupUser>();
    const uniqueIds = [...new Set(ids)].filter((id) => id !== BOT_USER_ID);
    if (uniqueIds.length === 0) return map;

    const chunks: string[][] = [];
    for (let i = 0; i < uniqueIds.length; i += BATCH_LOOKUP_MAX) {
      chunks.push(uniqueIds.slice(i, i + BATCH_LOOKUP_MAX));
    }
    const responses = await Promise.all(
      chunks.map((chunk) => apiClient.post('/api/auth/users/batch', { ids: chunk }))
    );
    for (const res of responses) {
      for (const u of res.data.data.users) {
        map.set(u.id, { name: u.name });
      }
    }
    return map;
  },

  /**
   * Fetch ALL community groups (discovery — not filtered by membership).
   * Each group includes isMember: boolean for the requesting user.
   */
  fetchAllGroups: async (subType: 'GENERAL' | 'CARE_CIRCLE' = 'GENERAL'): Promise<CommunityGroup[]> => {
    const res = await apiClient.get(`${CHAT_BASE_URL}/api/conversations/groups`, {
      params: { subType },
    });
    return res.data.data || [];
  },

  /**
   * Self-join an open community group. When the group has "require approval"
   * enabled, this creates a pending join request instead of joining directly
   * — callers must check the returned status rather than assuming success
   * means membership.
   */
  joinGroup: async (
    conversationId: string
  ): Promise<{ status: 'joined' | 'pending_approval'; inviteId?: string }> => {
    const res = await apiClient.post(`${CHAT_BASE_URL}/api/conversations/${conversationId}/join`);
    return res.data.data;
  },

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
        const userMap = await chatService.batchLookupUsers([...allUserIds]);

        // Attach user info to each participant
        for (const conv of conversations) {
          const members = conv.members || conv.participants || [];
          conv.participants = members.map((m: any) => {
            const isBot = m.userId === BOT_USER_ID;
            const looked = userMap.get(m.userId);
            return {
              ...m,
              user: {
                id: m.userId,
                name: isBot ? 'DigiBot' : (looked?.name ?? ''),
                unavailable: !isBot && !looked,
              },
            };
          });
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
            name: m.userId === BOT_USER_ID ? 'DigiBot' : 'Unknown',
          },
        }));
      }
    }

    return conversations;
  },

  /**
   * Returns membership records — { userId, leftAt } — for EVERY member a
   * group conversation has ever had, including those who have since left or
   * been removed. The normal conversation/participant list only ever
   * contains active members, so a message from someone who later left would
   * otherwise have no name to resolve against. Used by GroupChatScreen to
   * label a former member's historical messages — "(Left)" or "(Removed)"
   * depending on leftReason.
   */
  getConversationMemberHistory: async (
    conversationId: string
  ): Promise<Array<{ userId: string; leftAt: string | null; leftReason: string | null }>> => {
    const res = await apiClient.get(`${CHAT_BASE_URL}/api/conversations/${conversationId}/member-history`);
    return res.data.data || [];
  },

  getMessages: async (conversationId: string) => {
    const res = await apiClient.get(`${CHAT_BASE_URL}/api/messages/${conversationId}/history`);
    const rawMessages = res.data.data || [];
    // Drop soft-deleted messages so a refetch matches what happens live.
    // The server keeps the row (blanking content but leaving type as IMAGE /
    // VIDEO) and this mapper used to discard deletedAt entirely — so a
    // deleted or unsent image came back looking like a live image with an empty
    // URI and rendered as MessageMedia's grey placeholder box. Unsending also
    // removes the message from the store immediately, and it now stays gone on
    // reload.
    const visibleMessages = rawMessages.filter((m: any) => !m.deletedAt);
    // Map REST response to ChatMessage shape
    return visibleMessages.map((m: any) => {
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
        metadata: m.metadata,
        status: computedStatus,
        createdAt: m.createdAt,
      };
    });
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

  createGroup: async (name: string, description: string) => {
    // Create the group with only the creator as a member.
    // Invites are sent separately so members must explicitly accept before joining.
    const res = await apiClient.post(`${CHAT_BASE_URL}/api/conversations`, {
      type: 'GROUP',
      subType: 'GENERAL',
      name,
      description,
      memberIds: [],
    });
    return res.data.data;
  },

  createCareCircle: async (name: string, description: string) => {
    // Same invite-based flow — members join only after accepting the invite.
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

  deleteGroup: async (conversationId: string) => {
    const res = await apiClient.delete(`${CHAT_BASE_URL}/api/conversations/${conversationId}`);
    return res.data;
  },

  // Upload a chat attachment (image or voice note). Returns the public URL.
  //
  // Uses React Native's fetch — NOT axios — for the multipart request.
  // axios' XHR path in RN normalises the Content-Type header without a
  // boundary parameter, and whether the native layer repairs it is
  // platform-dependent ("Network Error" on some devices). RN's fetch
  // builds the multipart body + boundary natively.
  uploadMedia: async (
    file: { uri: string; name: string; type: string },
    field: "image" | "audio" | "video"
  ): Promise<{ url: string; kind: "IMAGE" | "AUDIO" | "VIDEO"; mimeType: string; size: number }> => {
    const form = new FormData();
    // React Native FormData file shape.
    form.append(field, {
      uri: file.uri,
      name: file.name,
      type: file.type,
    } as any);
    const token = useAuthStore.getState().accessToken;
    const res = await fetch(`${CHAT_BASE_URL}/api/media/upload`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      body: form,
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.success) {
      throw new Error(json?.message || `Upload failed (HTTP ${res.status})`);
    }
    return json.data;
  },

  muteConversation: async (conversationId: string, muted: boolean) => {
    const res = await apiClient.patch(`${CHAT_BASE_URL}/api/conversations/${conversationId}/mute`, { muted });
    return res.data;
  },

  pinConversation: async (conversationId: string, pinned: boolean) => {
    const res = await apiClient.patch(`${CHAT_BASE_URL}/api/conversations/${conversationId}/pin`, { pinned });
    return res.data;
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

  // Admin: list this group's invites (incl. AWAITING_APPROVAL join requests),
  // with the requester's display name resolved from user-svc.
  getGroupInvites: async (conversationId: string) => {
    const res = await apiClient.get(`${CHAT_BASE_URL}/api/conversations/${conversationId}/invites`);
    const invites: any[] = res.data.data || [];
    const ids = invites.map((i) => i.inviteeId).filter(Boolean);
    let nameMap = new Map<string, BatchLookupUser>();
    try {
      nameMap = await chatService.batchLookupUsers(ids);
    } catch {
      // names are best-effort
    }
    return invites.map((i) => ({ ...i, inviteeName: nameMap.get(i.inviteeId)?.name || 'Unknown user' }));
  },

  // ─── Admin Controls ──────────────────────────
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

  // Presence is not pushed over WS, so fetch it on demand (e.g. when opening a chat).
  getPresence: async (userId: string): Promise<{ status: string; lastSeen: string } | null> => {
    try {
      const res = await apiClient.get(`${CHAT_BASE_URL}/api/presence/${userId}`);
      return res.data.data;
    } catch {
      return null;
    }
  },

  // ─── Moderation ──────────────────────────────
  blockUser: async (userId: string) => {
    const res = await apiClient.post(`${CHAT_BASE_URL}/api/moderation/block`, { userId });
    return res.data;
  },

  unblockUser: async (userId: string) => {
    const res = await apiClient.delete(`${CHAT_BASE_URL}/api/moderation/block/${userId}`);
    return res.data;
  },

  getBlockedIds: async (): Promise<string[]> => {
    const res = await apiClient.get(`${CHAT_BASE_URL}/api/moderation/blocked`);
    return res.data.data.blockedIds;
  },

  /** Blocked users with display names, for the Blocked Users screen. */
  getBlockedUsers: async (): Promise<
    Array<{ id: string; name: string; blockedAt: string }>
  > => {
    const res = await apiClient.get(`${CHAT_BASE_URL}/api/moderation/blocked`);
    return res.data.data.blocked ?? [];
  },

  reportUser: async (payload: {
    reportedUserId: string;
    conversationId?: string;
    messageId?: string;
    reason: string;
  }) => {
    const res = await apiClient.post(`${CHAT_BASE_URL}/api/moderation/report`, payload);
    return res.data;
  },

  getMyReportedMessageIds: async (conversationId: string): Promise<string[]> => {
    const res = await apiClient.get(
      `${CHAT_BASE_URL}/api/moderation/reports/mine/${encodeURIComponent(conversationId)}`
    );
    return res.data.data.messageIds;
  },
};
