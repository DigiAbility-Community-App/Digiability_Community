// ─────────────────────────────────────────────
// FORUM Q&A TYPES
// ─────────────────────────────────────────────

export type QuestionStatus = "SOLVED" | "UNSOLVED";
export type VoteType = "UP" | "DOWN";

export interface ForumTag {
  id: string;
  name: string;
}

export interface ForumUserRef {
  id: string;
  name: string;
  role?: string | null;
  roles?: string[];
}

export interface ForumQuestion {
  id: string;
  title: string;
  description: string | null;
  category: string;
  imageUrl: string | null;
  views: number;
  answerCount: number;
  status: QuestionStatus;
  createdAt: string;
  updatedAt: string;
  authorId: string;
  author: ForumUserRef;
  tags: ForumTag[];
  answers?: ForumAnswer[];
}

export interface ForumAnswer {
  id: string;
  questionId: string;
  content: string | null;
  imageUrl: string | null;
  createdAt: string;
  updatedAt: string;
  authorId: string;
  isAccepted: boolean;
  upvotes: number;
  downvotes: number;
  author: ForumUserRef;
}

export interface CreateQuestionRequest {
  title: string;
  description?: string;
  category: string;
  tags?: string; // Comma separated tags
}

export interface CreateAnswerRequest {
  content: string;
}

export interface ReportContentRequest {
  questionId?: string;
  answerId?: string;
  reason: string;
}
