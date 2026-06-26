import apiClient from "./apiClient";

const FORUM_BASE_URL =
  process.env.EXPO_PUBLIC_FORUM_API_URL ??
  (process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://10.0.2.2:4001').replace('4001', '4003');

export interface QuestionFilters {
  search?: string;
  category?: string;
  tag?: string;
  status?: "SOLVED" | "UNSOLVED";
  sort?: "newest" | "popular" | "answers";
  page?: number;
  limit?: number;
  cursor?: string | null;
}

export const forumService = {
  /**
   * List forum questions with optional filters and sorting
   */
  listQuestions: async (filters: QuestionFilters = {}) => {
    const res = await apiClient.get(`${FORUM_BASE_URL}/api/forum/questions`, {
      params: filters
    });
    return res.data;
  },

  /**
   * Get complete details of a question, including its answers
   */
  getQuestionDetails: async (id: string) => {
    const res = await apiClient.get(`${FORUM_BASE_URL}/api/forum/questions/${id}`);
    return res.data.data;
  },

  /**
   * Check for similar existing questions to prevent duplicates
   */
  checkDuplicates: async (title: string) => {
    const res = await apiClient.get(`${FORUM_BASE_URL}/api/forum/questions/check-duplicates`, {
      params: { title }
    });
    return res.data.data;
  },

  /**
   * Create a new forum question (with optional image)
   */
  /**
   * Create a new forum question (with optional image)
   */
  createQuestion: async (payload: {
    title: string;
    description?: string;
    category: string;
    tags?: string;
    imageUri?: string | null;
    altText?: string | null;
    audioUrl?: string | null;
  }) => {
    const { title, description, category, tags, imageUri, altText, audioUrl } = payload;
    const body: any = new FormData();
    body.append("title", title);
    body.append("category", category);
    if (description) body.append("description", description);
    if (tags) body.append("tags", tags);
    if (altText) body.append("altText", altText);

    if (audioUrl) {
      if (audioUrl.startsWith("file://") || audioUrl.startsWith("/")) {
        const filename = audioUrl.split("/").pop() || "audio.m4a";
        body.append("audio", {
          uri: audioUrl,
          name: filename,
          type: "audio/x-m4a"
        } as any);
      } else {
        body.append("audioUrl", audioUrl);
      }
    }

    if (imageUri) {
      const filename = imageUri.split("/").pop() || "photo.jpg";
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : `image/jpeg`;
      body.append("image", {
        uri: imageUri,
        name: filename,
        type
      } as any);
    }

    const res = await apiClient.post(`${FORUM_BASE_URL}/api/forum/questions`, body, {
      headers: {
        "Content-Type": "multipart/form-data"
      }
    });
    return res.data.data;
  },

  /**
   * Post an answer to a question (with optional image)
   */
  createAnswer: async (params: {
    questionId: string;
    content: string;
    imageUri?: string | null;
    altText?: string | null;
    audioUrl?: string | null;
  }) => {
    const { questionId, content, imageUri, altText, audioUrl } = params;
    const body: any = new FormData();
    body.append("content", content);
    if (altText) body.append("altText", altText);

    if (audioUrl) {
      if (audioUrl.startsWith("file://") || audioUrl.startsWith("/")) {
        const filename = audioUrl.split("/").pop() || "audio.m4a";
        body.append("audio", {
          uri: audioUrl,
          name: filename,
          type: "audio/x-m4a"
        } as any);
      } else {
        body.append("audioUrl", audioUrl);
      }
    }

    if (imageUri) {
      const filename = imageUri.split("/").pop() || "answer.jpg";
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : `image/jpeg`;
      body.append("image", {
        uri: imageUri,
        name: filename,
        type
      } as any);
    }

    const res = await apiClient.post(
      `${FORUM_BASE_URL}/api/forum/questions/${questionId}/answers`,
      body,
      {
        headers: {
          "Content-Type": "multipart/form-data"
        }
      }
    );
    return res.data.data;
  },

  /**
   * Edit an existing answer
   */
  editAnswer: async (id: string, content: string) => {
    const res = await apiClient.put(`${FORUM_BASE_URL}/api/forum/answers/${id}`, {
      content
    });
    return res.data.data;
  },

  /**
   * Delete an answer
   */
  deleteAnswer: async (id: string) => {
    await apiClient.delete(`${FORUM_BASE_URL}/api/forum/answers/${id}`);
  },

  /**
   * Delete a question
   */
  deleteQuestion: async (id: string) => {
    await apiClient.delete(`${FORUM_BASE_URL}/api/forum/questions/${id}`);
  },

  /**
   * Upvote or downvote an answer
   */
  voteAnswer: async (id: string, type: "UP" | "DOWN") => {
    const res = await apiClient.post(`${FORUM_BASE_URL}/api/forum/answers/${id}/vote`, {
      type
    });
    return res.data.data;
  },

  /**
   * Mark an answer as accepted (only question author)
   */
  acceptAnswer: async (id: string) => {
    const res = await apiClient.post(`${FORUM_BASE_URL}/api/forum/answers/${id}/accept`);
    return res.data;
  },

  /**
   * Reopen a resolved question
   */
  reopenQuestion: async (id: string) => {
    const res = await apiClient.post(`${FORUM_BASE_URL}/api/forum/questions/${id}/reopen`);
    return res.data;
  },

  /**
   * Report a question or answer
   */
  reportContent: async (payload: {
    questionId?: string;
    answerId?: string;
    reason: string;
  }) => {
    const res = await apiClient.post(`${FORUM_BASE_URL}/api/forum/reports`, payload);
    return res.data;
  },

  /**
   * Get AI-generated thread summary
   */
  getQuestionSummary: async (id: string) => {
    const res = await apiClient.get(`${FORUM_BASE_URL}/api/forum/questions/${id}/summary`);
    return res.data.summary;
  },

  /**
   * Toggle bookmark status
   */
  toggleBookmark: async (questionId: string) => {
    const res = await apiClient.post(`${FORUM_BASE_URL}/api/forum/bookmarks`, { questionId });
    return res.data.bookmarked;
  },

  /**
   * List user's bookmarked questions
   */
  listBookmarks: async () => {
    const res = await apiClient.get(`${FORUM_BASE_URL}/api/forum/bookmarks`);
    return res.data.data;
  },

  /**
   * List user notifications
   */
  listNotifications: async () => {
    const res = await apiClient.get(`${FORUM_BASE_URL}/api/forum/notifications`);
    return res.data.data;
  },

  /**
   * Mark notification as read
   */
  markNotificationRead: async (id: string) => {
    const res = await apiClient.put(`${FORUM_BASE_URL}/api/forum/notifications/${id}/read`);
    return res.data.data;
  },

  /**
   * Mark all notifications as read
   */
  markAllNotificationsRead: async () => {
    await apiClient.put(`${FORUM_BASE_URL}/api/forum/notifications/read-all`);
  },

  getMyStats: async (): Promise<{ questionsCount: number; answersCount: number; reputation: number }> => {
    const res = await apiClient.get(`${FORUM_BASE_URL}/api/forum/me/stats`);
    return res.data.data;
  },
};
