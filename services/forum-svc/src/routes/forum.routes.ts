import { Router } from 'express';
import {
  createQuestion,
  listQuestions,
  getQuestionDetails,
  deleteQuestion,
  checkDuplicates,
  createAnswer,
  editAnswer,
  deleteAnswer,
  voteAnswer,
  acceptAnswer,
  reopenQuestion,
  reportContent,
  getQuestionSummary,
  toggleBookmark,
  listBookmarks,
  listNotifications,
  markNotificationRead
} from '../controllers/forum.controller';
import { authenticate } from '../middleware/auth.middleware';
import { upload } from '../middleware/uploadMiddleware';
import { validate } from '../middleware/validate.middleware';
import {
  QuestionSchema,
  AnswerSchema,
  VoteSchema,
  ReportSchema,
  BookmarkSchema
} from '../utils/validation.util';
import { forumPostLimiter } from '../middleware/rateLimit.middleware';

const router = Router();

// ── Question Routes ───────────────────────────────────
router.post(
  '/questions',
  authenticate,
  forumPostLimiter,
  upload.fields([{ name: 'image', maxCount: 1 }, { name: 'audio', maxCount: 1 }]),
  validate(QuestionSchema),
  createQuestion
);
router.get('/questions', listQuestions);
router.get('/questions/duplicates', checkDuplicates);
router.get('/questions/:id', getQuestionDetails);
router.delete('/questions/:id', authenticate, deleteQuestion);
router.get('/questions/:id/summary', getQuestionSummary);

// ── Answer Routes ─────────────────────────────────────
router.post(
  '/questions/:questionId/answers',
  authenticate,
  forumPostLimiter,
  upload.fields([{ name: 'image', maxCount: 1 }, { name: 'audio', maxCount: 1 }]),
  validate(AnswerSchema),
  createAnswer
);
router.put('/answers/:id', authenticate, validate(AnswerSchema), editAnswer);
router.delete('/answers/:id', authenticate, deleteAnswer);
router.post('/answers/:id/vote', authenticate, validate(VoteSchema), voteAnswer);
router.post('/answers/:id/accept', authenticate, acceptAnswer);
router.post('/questions/:id/reopen', authenticate, reopenQuestion);

// ── Moderation Routes ─────────────────────────────────
router.post('/reports', authenticate, validate(ReportSchema), reportContent);

// ── Bookmark Routes ───────────────────────────────────
router.post('/bookmarks', authenticate, validate(BookmarkSchema), toggleBookmark);
router.get('/bookmarks', authenticate, listBookmarks);

// ── Notification Routes ───────────────────────────────
router.get('/notifications', authenticate, listNotifications);
router.put('/notifications/:id/read', authenticate, markNotificationRead);

export default router;
