import { create } from "zustand";
import { forumService, QuestionFilters } from "../services/forumService";

export interface ForumTag {
  id: string;
  name: string;
}

export interface ForumUserRef {
  id: string;
  name: string;
  role?: string | null;
  forumStats?: { reputation: number } | null;
}

export interface ForumAnswer {
  id: string;
  questionId: string;
  content: string | null;
  imageUrl: string | null;
  altText?: string | null;
  audioUrl?: string | null;
  createdAt: string;
  updatedAt: string;
  authorId: string;
  isAccepted: boolean;
  upvotes: number;
  downvotes: number;
  author: ForumUserRef;
}

export interface ForumQuestion {
  id: string;
  title: string;
  description: string | null;
  category: string;
  imageUrl: string | null;
  altText?: string | null;
  audioUrl?: string | null;
  views: number;
  answerCount: number;
  status: "SOLVED" | "UNSOLVED";
  createdAt: string;
  updatedAt: string;
  authorId: string;
  author: ForumUserRef;
  tags: ForumTag[];
  answers?: ForumAnswer[];
}

interface ForumState {
  questions: ForumQuestion[];
  bookmarks: ForumQuestion[];
  notifications: any[];
  currentQuestion: ForumQuestion | null;
  currentQuestionSummary: string | null;
  duplicateSuggestions: ForumQuestion[];
  loading: boolean;
  actionLoading: boolean;
  error: string | null;
  filters: QuestionFilters;
  nextCursor: string | null;

  // Actions
  setFilters: (filters: Partial<QuestionFilters>) => void;
  resetFilters: () => void;
  fetchQuestions: (replace?: boolean) => Promise<void>;
  fetchQuestionDetails: (id: string) => Promise<void>;
  checkDuplicateQuestions: (title: string) => Promise<void>;
  clearDuplicateSuggestions: () => void;
  createQuestion: (payload: {
    title: string;
    description?: string;
    category: string;
    tags?: string;
    imageUri?: string | null;
    altText?: string | null;
    audioUrl?: string | null;
  }) => Promise<ForumQuestion>;
  deleteQuestion: (id: string) => Promise<void>;
  createAnswer: (payload: {
    questionId: string;
    content: string;
    imageUri?: string | null;
    altText?: string | null;
    audioUrl?: string | null;
  }) => Promise<void>;
  editAnswer: (id: string, content: string) => Promise<void>;
  deleteAnswer: (id: string) => Promise<void>;
  voteAnswer: (id: string, type: "UP" | "DOWN") => Promise<void>;
  acceptAnswer: (id: string) => Promise<void>;
  reopenQuestion: (id: string) => Promise<void>;
  reportContent: (payload: {
    questionId?: string;
    answerId?: string;
    reason: string;
  }) => Promise<void>;
  fetchQuestionSummary: (id: string) => Promise<void>;
  toggleBookmark: (questionId: string) => Promise<void>;
  fetchBookmarks: () => Promise<void>;
  fetchNotifications: () => Promise<void>;
  markNotificationRead: (id: string) => Promise<void>;

  // Realtime handlers
  onSocketQuestionCreated: (question: ForumQuestion) => void;
  onSocketQuestionDeleted: (payload: { id: string }) => void;
  onSocketQuestionReopened: (payload: { id: string }) => void;
  onSocketAnswerCreated: (answer: ForumAnswer) => void;
  onSocketAnswerUpdated: (answer: ForumAnswer) => void;
  onSocketAnswerDeleted: (payload: { id: string; questionId: string }) => void;
  onSocketAnswerVoted: (answer: ForumAnswer) => void;
  onSocketAnswerAccepted: (answer: ForumAnswer) => void;
  onSocketNotification: (notification: any) => void;
}

const initialFilters: QuestionFilters = {
  search: "",
  category: "",
  tag: "",
  status: undefined,
  sort: "newest",
  limit: 10
};

export const useForumStore = create<ForumState>((set, get) => ({
  questions: [],
  bookmarks: [],
  notifications: [],
  currentQuestion: null,
  currentQuestionSummary: null,
  duplicateSuggestions: [],
  loading: false,
  actionLoading: false,
  error: null,
  filters: initialFilters,
  nextCursor: null,

  setFilters: (newFilters) => {
    set((state) => ({
      filters: { ...state.filters, ...newFilters }
    }));
  },

  resetFilters: () => {
    set({ filters: initialFilters, nextCursor: null });
  },

  fetchQuestions: async (replace = true) => {
    set({ loading: true, error: null });
    try {
      const activeFilters = get().filters;
      const cursorParam = replace ? undefined : get().nextCursor;

      const res = await forumService.listQuestions({
        ...activeFilters,
        cursor: cursorParam
      });

      set((state) => ({
        questions: replace ? res.data : [...state.questions, ...res.data],
        nextCursor: res.nextCursor || null,
        loading: false
      }));
    } catch (err: any) {
      set({
        error: err.response?.data?.message || "Failed to load questions",
        loading: false
      });
    }
  },

  fetchQuestionDetails: async (id) => {
    set({ loading: true, error: null, currentQuestionSummary: null });
    try {
      const question = await forumService.getQuestionDetails(id);
      set({ currentQuestion: question, loading: false });
    } catch (err: any) {
      set({
        error: err.response?.data?.message || "Failed to load question details",
        loading: false
      });
    }
  },

  checkDuplicateQuestions: async (title) => {
    try {
      const duplicates = await forumService.checkDuplicates(title);
      set({ duplicateSuggestions: duplicates });
    } catch (err) {
      console.warn("Failed to check duplicate questions:", err);
    }
  },

  clearDuplicateSuggestions: () => {
    set({ duplicateSuggestions: [] });
  },

  createQuestion: async (payload) => {
    set({ actionLoading: true, error: null });
    try {
      const newQuestion = await forumService.createQuestion(payload);
      set({ actionLoading: false });
      return newQuestion;
    } catch (err: any) {
      const errMsg = err.response?.data?.message || "Failed to submit question";
      set({ error: errMsg, actionLoading: false });
      throw new Error(errMsg);
    }
  },

  deleteQuestion: async (id) => {
    set({ actionLoading: true, error: null });
    try {
      await forumService.deleteQuestion(id);
      set((state) => ({
        questions: state.questions.filter((q) => q.id !== id),
        currentQuestion: state.currentQuestion?.id === id ? null : state.currentQuestion,
        actionLoading: false
      }));
    } catch (err: any) {
      set({
        error: err.response?.data?.message || "Failed to delete question",
        actionLoading: false
      });
    }
  },

  createAnswer: async (payload) => {
    set({ actionLoading: true, error: null });
    try {
      await forumService.createAnswer(payload);
      // Re-fetch question details to display new answer
      const updatedQuestion = await forumService.getQuestionDetails(payload.questionId);
      set({ currentQuestion: updatedQuestion, actionLoading: false });
    } catch (err: any) {
      const errMsg = err.response?.data?.message || "Failed to submit answer";
      set({ error: errMsg, actionLoading: false });
      throw new Error(errMsg);
    }
  },

  editAnswer: async (id, content) => {
    set({ actionLoading: true, error: null });
    try {
      const updated = await forumService.editAnswer(id, content);
      set((state) => {
        if (!state.currentQuestion || !state.currentQuestion.answers) return {};
        const updatedAnswers = state.currentQuestion.answers.map((ans) =>
          ans.id === id ? { ...ans, ...updated } : ans
        );
        return {
          currentQuestion: {
            ...state.currentQuestion,
            answers: updatedAnswers
          }
        };
      });
      set({ actionLoading: false });
    } catch (err: any) {
      set({
        error: err.response?.data?.message || "Failed to edit answer",
        actionLoading: false
      });
      throw err;
    }
  },

  deleteAnswer: async (id) => {
    set({ actionLoading: true, error: null });
    try {
      await forumService.deleteAnswer(id);
      set((state) => {
        if (!state.currentQuestion || !state.currentQuestion.answers) return {};
        const filteredAnswers = state.currentQuestion.answers.filter((ans) => ans.id !== id);
        return {
          currentQuestion: {
            ...state.currentQuestion,
            answerCount: Math.max(0, state.currentQuestion.answerCount - 1),
            answers: filteredAnswers
          }
        };
      });
      set({ actionLoading: false });
    } catch (err: any) {
      set({
        error: err.response?.data?.message || "Failed to delete answer",
        actionLoading: false
      });
    }
  },

  voteAnswer: async (id, type) => {
    try {
      const updated = await forumService.voteAnswer(id, type);
      set((state) => {
        if (!state.currentQuestion || !state.currentQuestion.answers) return {};
        const updatedAnswers = state.currentQuestion.answers.map((ans) =>
          ans.id === id ? { ...ans, upvotes: updated.upvotes, downvotes: updated.downvotes } : ans
        );
        return {
          currentQuestion: {
            ...state.currentQuestion,
            answers: updatedAnswers
          }
        };
      });
    } catch (err: any) {
      console.error("Failed to vote:", err);
    }
  },

  acceptAnswer: async (id) => {
    set({ actionLoading: true, error: null });
    try {
      await forumService.acceptAnswer(id);
      if (get().currentQuestion) {
        const updated = await forumService.getQuestionDetails(get().currentQuestion!.id);
        set({ currentQuestion: updated });
      }
      set({ actionLoading: false });
    } catch (err: any) {
      set({
        error: err.response?.data?.message || "Failed to accept answer",
        actionLoading: false
      });
    }
  },

  reopenQuestion: async (id) => {
    set({ actionLoading: true, error: null });
    try {
      await forumService.reopenQuestion(id);
      const updated = await forumService.getQuestionDetails(id);
      set({ currentQuestion: updated, actionLoading: false });
    } catch (err: any) {
      set({
        error: err.response?.data?.message || "Failed to reopen question",
        actionLoading: false
      });
    }
  },

  reportContent: async (payload) => {
    set({ actionLoading: true, error: null });
    try {
      await forumService.reportContent(payload);
      set({ actionLoading: false });
    } catch (err: any) {
      set({
        error: err.response?.data?.message || "Failed to send report",
        actionLoading: false
      });
      throw err;
    }
  },

  fetchQuestionSummary: async (id) => {
    try {
      const summary = await forumService.getQuestionSummary(id);
      set({ currentQuestionSummary: summary });
    } catch (err) {
      console.warn("Failed to fetch thread summary:", err);
    }
  },

  toggleBookmark: async (questionId) => {
    try {
      const bookmarked = await forumService.toggleBookmark(questionId);
      // Re-fetch bookmarks to update list
      const updatedBookmarks = await forumService.listBookmarks();
      set({ bookmarks: updatedBookmarks });
    } catch (err) {
      console.error("Failed to toggle bookmark:", err);
    }
  },

  fetchBookmarks: async () => {
    set({ loading: true });
    try {
      const b = await forumService.listBookmarks();
      set({ bookmarks: b, loading: false });
    } catch (err) {
      set({ loading: false });
    }
  },

  fetchNotifications: async () => {
    try {
      const notifs = await forumService.listNotifications();
      set({ notifications: notifs });
    } catch (err) {
      console.warn("Failed to fetch notifications:", err);
    }
  },

  markNotificationRead: async (id) => {
    try {
      await forumService.markNotificationRead(id);
      set((state) => ({
        notifications: state.notifications.map((n) => (n.id === id ? { ...n, read: true } : n))
      }));
    } catch (err) {
      console.warn("Failed to mark notification read:", err);
    }
  },

  // Realtime Socket updates
  onSocketQuestionCreated: (question) => {
    set((state) => {
      // Don't add duplicate
      if (state.questions.find((q) => q.id === question.id)) return {};
      return {
        questions: [question, ...state.questions]
      };
    });
  },

  onSocketQuestionDeleted: ({ id }) => {
    set((state) => ({
      questions: state.questions.filter((q) => q.id !== id),
      currentQuestion: state.currentQuestion?.id === id ? null : state.currentQuestion
    }));
  },

  onSocketQuestionReopened: ({ id }) => {
    set((state) => {
      const updatedQuestions = state.questions.map((q) =>
        q.id === id ? { ...q, status: "UNSOLVED" as const } : q
      );
      const current =
        state.currentQuestion?.id === id
          ? {
              ...state.currentQuestion,
              status: "UNSOLVED" as const,
              answers: state.currentQuestion.answers?.map((a) => ({ ...a, isAccepted: false }))
            }
          : state.currentQuestion;
      return {
        questions: updatedQuestions,
        currentQuestion: current
      };
    });
  },

  onSocketAnswerCreated: (answer) => {
    set((state) => {
      // Update questions list counts
      const updatedQuestions = state.questions.map((q) =>
        q.id === answer.questionId ? { ...q, answerCount: q.answerCount + 1 } : q
      );

      // Update current details if open
      if (state.currentQuestion && state.currentQuestion.id === answer.questionId) {
        const answers = state.currentQuestion.answers || [];
        if (answers.find((a) => a.id === answer.id)) return { questions: updatedQuestions };
        return {
          questions: updatedQuestions,
          currentQuestion: {
            ...state.currentQuestion,
            answerCount: state.currentQuestion.answerCount + 1,
            answers: [...answers, answer]
          }
        };
      }
      return { questions: updatedQuestions };
    });
  },

  onSocketAnswerUpdated: (answer) => {
    set((state) => {
      if (state.currentQuestion && state.currentQuestion.id === answer.questionId) {
        const answers = state.currentQuestion.answers || [];
        return {
          currentQuestion: {
            ...state.currentQuestion,
            answers: answers.map((a) => (a.id === answer.id ? { ...a, ...answer } : a))
          }
        };
      }
      return {};
    });
  },

  onSocketAnswerDeleted: ({ id, questionId }) => {
    set((state) => {
      const updatedQuestions = state.questions.map((q) =>
        q.id === questionId ? { ...q, answerCount: Math.max(0, q.answerCount - 1) } : q
      );

      if (state.currentQuestion && state.currentQuestion.id === questionId) {
        const answers = state.currentQuestion.answers || [];
        return {
          questions: updatedQuestions,
          currentQuestion: {
            ...state.currentQuestion,
            answerCount: Math.max(0, state.currentQuestion.answerCount - 1),
            answers: answers.filter((a) => a.id !== id)
          }
        };
      }
      return { questions: updatedQuestions };
    });
  },

  onSocketAnswerVoted: (answer) => {
    set((state) => {
      if (state.currentQuestion && state.currentQuestion.id === answer.questionId) {
        const answers = state.currentQuestion.answers || [];
        return {
          currentQuestion: {
            ...state.currentQuestion,
            answers: answers.map((a) =>
              a.id === answer.id ? { ...a, upvotes: answer.upvotes, downvotes: answer.downvotes } : a
            )
          }
        };
      }
      return {};
    });
  },

  onSocketAnswerAccepted: (answer) => {
    set((state) => {
      const updatedQuestions = state.questions.map((q) =>
        q.id === answer.questionId ? { ...q, status: "SOLVED" as const } : q
      );

      if (state.currentQuestion && state.currentQuestion.id === answer.questionId) {
        const answers = state.currentQuestion.answers || [];
        return {
          questions: updatedQuestions,
          currentQuestion: {
            ...state.currentQuestion,
            status: "SOLVED" as const,
            answers: answers.map((a) =>
              a.id === answer.id ? { ...a, isAccepted: true } : { ...a, isAccepted: false }
            )
          }
        };
      }
      return { questions: updatedQuestions };
    });
  },

  onSocketNotification: (notification) => {
    set((state) => ({
      notifications: [notification, ...state.notifications]
    }));
  }
}));
