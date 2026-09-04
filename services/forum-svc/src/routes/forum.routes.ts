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
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  getMyStats
} from '../controllers/forum.controller';
import { authenticate, optionalAuth } from '../middleware/auth.middleware';
import { upload } from '../middleware/uploadMiddleware';
import { validate } from '../middleware/validate.middleware';
import { moderateContent } from '../middleware/moderation.middleware';
import {
  QuestionSchema,
  AnswerSchema,
  EditAnswerSchema,
  VoteSchema,
  ReportSchema,
  BookmarkSchema
} from '../utils/validation.util';
import { forumPostLimiter } from '../middleware/rateLimit.middleware';

const router = Router();

// ── Question Routes ───────────────────────────────────
// moderateContent runs AFTER validate so req.body is typed and clean
router.post(
  '/questions',
  authenticate,
  forumPostLimiter,
  upload.fields([{ name: 'image', maxCount: 1 }, { name: 'audio', maxCount: 1 }]),
  validate(QuestionSchema),
  moderateContent,
  createQuestion
);
router.get('/questions', listQuestions);
// IMPORTANT: /questions/check-duplicates must remain above /questions/:id to avoid being shadowed
router.get('/questions/check-duplicates', checkDuplicates);
router.get('/questions/:id', optionalAuth, getQuestionDetails);
router.delete('/questions/:id', authenticate, deleteQuestion);
router.get('/questions/:id/summary', getQuestionSummary);

// ── Answer Routes ─────────────────────────────────────
router.post(
  '/questions/:questionId/answers',
  authenticate,
  forumPostLimiter,
  upload.fields([{ name: 'image', maxCount: 1 }, { name: 'audio', maxCount: 1 }]),
  validate(AnswerSchema),
  moderateContent,
  createAnswer
);
router.put('/answers/:id', authenticate, validate(EditAnswerSchema), editAnswer);
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
router.put('/notifications/read-all', authenticate, markAllNotificationsRead);
router.put('/notifications/:id/read', authenticate, markNotificationRead);
router.delete('/notifications/:id', authenticate, deleteNotification);

// ── User Stats Route ──────────────────────────────────
router.get('/me/stats', authenticate, getMyStats);

export default router;
