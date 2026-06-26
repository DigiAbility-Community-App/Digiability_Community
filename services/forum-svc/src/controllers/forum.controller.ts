import { Request, Response } from 'express';
import https from 'https';
import http from 'http';
import prisma from '../models/prisma.client';
import { QuestionStatus, VoteType } from '../generated/client';
import { cleanProfanity, hasProfanity } from '../utils/profanity';
import { calculateCosineSimilarity, generateThreadSummary } from '../services/ai.service';
import { broadcastForumEvent, sendNotificationToUser } from '../websocket/socket';

const NOTIF_SVC_URL = process.env.NOTIF_SVC_URL ?? 'http://localhost:4003';

function sendPushNotification(
  userId: string,
  title: string,
  body: string,
  data: Record<string, string> = {}
): void {
  const payload = JSON.stringify({ userId, title, body, data });
  const url = new URL(`${NOTIF_SVC_URL}/internal/notify`);
  const lib = url.protocol === 'https:' ? https : http;
  const req = lib.request(
    { hostname: url.hostname, port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } },
    () => {}
  );
  req.on('error', (err) => console.warn('[forum-svc] Push notify error:', err.message));
  req.write(payload);
  req.end();
}

const ALLOWED_CATEGORIES = [
  'Healthcare',
  'Government Schemes',
  'Accessibility',
  'Education',
  'Jobs',
  'Mental Health',
  'Legal Help',
  'Assistive Technology',
  'Caregiver Support',
  'Community'
];

const getImageUrl = (req: Request, filename?: string) => {
  if (!filename) return null;
  const protocol = req.protocol;
  const host = req.get('host');
  return `${protocol}://${host}/uploads/${filename}`;
};

const mapAuthorRole = (author: any) => {
  if (!author) return author;
  return {
    ...author,
    role: author.roles?.[0] || null,
  };
};

const mapQuestionRoles = (q: any) => {
  if (!q) return q;
  const mapped = {
    ...q,
    author: mapAuthorRole(q.author),
  };
  if (q.answers && Array.isArray(q.answers)) {
    mapped.answers = q.answers.map((a: any) => ({
      ...a,
      author: mapAuthorRole(a.author),
    }));
  }
  return mapped;
};

const mapAnswerRoles = (a: any) => {
  if (!a) return a;
  return {
    ...a,
    author: mapAuthorRole(a.author),
  };
};

/**
 * Adjust user reputation in active transaction.
 */
async function adjustUserReputation(userId: string, points: number, tx: any) {
  const stats = await tx.forumUserStats.findUnique({ where: { userId } });
  if (stats) {
    return tx.forumUserStats.update({
      where: { userId },
      data: { reputation: Math.max(0, stats.reputation + points) }
    });
  } else {
    return tx.forumUserStats.create({
      data: { userId, reputation: Math.max(0, points) }
    });
  }
}

/**
 * Create a notification inside transaction and emit via WS.
 */
async function createNotification(
  userId: string,
  type: string,
  title: string,
  message: string,
  relatedId: string | null,
  tx: any
) {
  const notif = await tx.notification.create({
    data: { userId, type, title, message, relatedId }
  });

  // Emit in real time
  sendNotificationToUser(userId, notif);
  return notif;
}

export const createQuestion = async (req: Request, res: Response): Promise<void> => {
  try {
    const { title, description, category, tags, altText, audioUrl } = req.body;
    const authorId = req.user?.sub;

    if (!authorId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    if (!ALLOWED_CATEGORIES.includes(category)) {
      res.status(400).json({ success: false, message: 'Invalid category' });
      return;
    }

    // Clean profanity
    const cleanTitle = cleanProfanity(title);
    const cleanDescription = description ? cleanProfanity(description) : null;

    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    const imageFile = files?.['image']?.[0];
    const audioFile = files?.['audio']?.[0];

    const imageUrl = imageFile ? getImageUrl(req, imageFile.filename) : (req.body.imageUrl || null);
    const resolvedAudioUrl = audioFile ? getImageUrl(req, audioFile.filename) : (audioUrl || null);

    let tagNames: string[] = [];
    if (tags) {
      tagNames = String(tags)
        .split(',')
        .map(t => t.trim().toUpperCase())
        .filter(t => t.length > 0);
    }

    const question = await prisma.$transaction(async (tx) => {
      // 1. Create the question
      const q = await tx.forumQuestion.create({
        data: {
          title: cleanTitle,
          description: cleanDescription,
          category,
          imageUrl,
          altText,
          audioUrl: resolvedAudioUrl,
          authorId,
          tags: {
            connectOrCreate: tagNames.map(name => ({
              where: { name },
              create: { name }
            }))
          }
        },
        include: {
          tags: true,
          author: {
            select: {
              id: true,
              name: true,
              roles: true,
              forumStats: true
            }
          }
        }
      });

      // 2. Increment reputation for posting (+5 points)
      await adjustUserReputation(authorId, 5, tx);

      return q;
    });

    broadcastForumEvent('question_created', mapQuestionRoles(question));
    res.status(201).json({ success: true, data: mapQuestionRoles(question) });
  } catch (error: any) {
    console.error('Create Question Error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to create question' });
  }
};

export const checkDuplicates = async (req: Request, res: Response): Promise<void> => {
  try {
    const { title } = req.query;

    if (!title || typeof title !== 'string') {
      res.status(200).json({ success: true, data: [] });
      return;
    }

    // Fetch recent active questions for cosine similarity (capped to avoid full-table scan)
    const questions = await prisma.forumQuestion.findMany({
      where: { deletedAt: null },
      take: 300,
      orderBy: { createdAt: 'desc' },
      include: {
        tags: true,
        author: {
          select: { id: true, name: true, roles: true }
        }
      }
    });

    // Score and filter by cosine similarity
    const matches = questions
      .map(q => {
        const similarity = calculateCosineSimilarity(title, q.title);
        return { question: q, similarity };
      })
      .filter(m => m.similarity >= 0.35) // Threshold
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 5)
      .map(m => m.question);

    res.status(200).json({ success: true, data: matches.map(mapQuestionRoles) });
  } catch (error: any) {
    console.error('Check Duplicates Error:', error);
    res.status(500).json({ success: false, message: 'Error performing similarity check' });
  }
};

export const listQuestions = async (req: Request, res: Response): Promise<void> => {
  try {
    const { search, category, tag, status, sort, cursor, limit = '10' } = req.query;
    const limitNum = parseInt(limit as string, 10);

    const where: any = { deletedAt: null };

    if (search && typeof search === 'string') {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
      ];
    }

    if (category && typeof category === 'string') {
      where.category = category;
    }

    if (tag && typeof tag === 'string') {
      where.tags = {
        some: {
          name: tag.toUpperCase()
        }
      };
    }

    if (status && typeof status === 'string') {
      where.status = status as QuestionStatus;
    }

    // Determine ordering
    let orderBy: any = { createdAt: 'desc' };
    if (sort === 'popular') {
      orderBy = { views: 'desc' };
    } else if (sort === 'answers') {
      orderBy = { answerCount: 'desc' };
    }

    // Build cursor logic
    const queryOptions: any = {
      where,
      orderBy,
      take: limitNum,
      include: {
        tags: true,
        author: {
          select: {
            id: true,
            name: true,
            roles: true,
            forumStats: true
          }
        }
      }
    };

    if (cursor && typeof cursor === 'string' && cursor !== '' && cursor !== 'null') {
      queryOptions.cursor = { id: cursor };
      queryOptions.skip = 1; // Skip the cursor element itself
    }

    const questions = await prisma.forumQuestion.findMany(queryOptions);

    // Get the next cursor
    let nextCursor: string | null = null;
    if (questions.length === limitNum) {
      nextCursor = questions[questions.length - 1].id;
    }

    res.status(200).json({
      success: true,
      data: questions.map(mapQuestionRoles),
      nextCursor
    });
  } catch (error: any) {
    console.error('List Questions Error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch questions' });
  }
};

export const getQuestionDetails = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const question = await prisma.forumQuestion.update({
      where: { id, deletedAt: null },
      data: {
        views: { increment: 1 }
      },
      include: {
        tags: true,
        author: {
          select: {
            id: true,
            name: true,
            roles: true,
            forumStats: true
          }
        },
        answers: {
          where: { deletedAt: null },
          orderBy: [
            { isAccepted: 'desc' },
            { upvotes: 'desc' },
            { createdAt: 'desc' }
          ],
          include: {
            author: {
              select: {
                id: true,
                name: true,
                roles: true,
                forumStats: true
              }
            }
          }
        }
      }
    });

    res.status(200).json({ success: true, data: mapQuestionRoles(question) });
  } catch (error: any) {
    console.error('Get Question Details Error:', error);
    res.status(404).json({ success: false, message: 'Question not found' });
  }
};

export const deleteQuestion = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const authorId = req.user?.sub;

    const question = await prisma.forumQuestion.findUnique({
      where: { id }
    });

    if (!question) {
      res.status(404).json({ success: false, message: 'Question not found' });
      return;
    }

    if (question.authorId !== authorId) {
      res.status(403).json({ success: false, message: 'Unauthorized' });
      return;
    }

    // Soft delete
    await prisma.forumQuestion.update({
      where: { id },
      data: { deletedAt: new Date() }
    });

    broadcastForumEvent('question_deleted', { id });
    res.status(200).json({ success: true, message: 'Question deleted successfully' });
  } catch (error: any) {
    console.error('Delete Question Error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete question' });
  }
};

export const createAnswer = async (req: Request, res: Response): Promise<void> => {
  try {
    const { questionId } = req.params;
    const { content, altText, audioUrl } = req.body;
    const authorId = req.user?.sub;

    if (!authorId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    // Clean profanity
    const cleanContent = cleanProfanity(content);

    const question = await prisma.forumQuestion.findUnique({
      where: { id: questionId, deletedAt: null }
    });

    if (!question) {
      res.status(404).json({ success: false, message: 'Question not found' });
      return;
    }

    if (question.status === QuestionStatus.SOLVED) {
      res.status(400).json({ success: false, message: 'This discussion has been resolved.' });
      return;
    }

    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    const imageFile = files?.['image']?.[0];
    const audioFile = files?.['audio']?.[0];

    const imageUrl = imageFile ? getImageUrl(req, imageFile.filename) : (req.body.imageUrl || null);
    const resolvedAudioUrl = audioFile ? getImageUrl(req, audioFile.filename) : (audioUrl || null);

    const answer = await prisma.$transaction(async (tx) => {
      // 1. Create the answer
      const ans = await tx.forumAnswer.create({
        data: {
          content: cleanContent,
          imageUrl,
          altText,
          audioUrl: resolvedAudioUrl,
          questionId,
          authorId
        },
        include: {
          author: {
            select: {
              id: true,
              name: true,
              roles: true,
              forumStats: true
            }
          }
        }
      });

      // 2. Increment answerCount of the question
      await tx.forumQuestion.update({
        where: { id: questionId },
        data: { answerCount: { increment: 1 } }
      });

      // 3. Award rep to answerer (+2 points)
      await adjustUserReputation(authorId, 2, tx);

      // 4. Send in-app notification to the question author
      if (question.authorId !== authorId) {
        await createNotification(
          question.authorId,
          'ANSWER',
          'New Answer received',
          `Your question "${question.title}" has a new answer.`,
          question.id,
          tx
        );
      }

      return ans;
    });

    // 5. Send push notification to the question author (fire-and-forget)
    if (question.authorId !== authorId) {
      sendPushNotification(
        question.authorId,
        'New Answer on your post',
        `Your question "${question.title}" received a new answer.`,
        { type: 'forum_answer', questionId: question.id }
      );
    }

    broadcastForumEvent('answer_created', mapAnswerRoles(answer));
    res.status(201).json({ success: true, data: mapAnswerRoles(answer) });
  } catch (error: any) {
    console.error('Create Answer Error:', error);
    res.status(500).json({ success: false, message: 'Failed to post answer' });
  }
};

export const editAnswer = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { content } = req.body;
    const authorId = req.user?.sub;

    const answer = await prisma.forumAnswer.findUnique({
      where: { id, deletedAt: null }
    });

    if (!answer) {
      res.status(404).json({ success: false, message: 'Answer not found' });
      return;
    }

    if (answer.authorId !== authorId) {
      res.status(403).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const cleanContent = cleanProfanity(content);

    const updated = await prisma.forumAnswer.update({
      where: { id },
      data: { content: cleanContent, updatedAt: new Date() },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            roles: true,
            forumStats: true
          }
        }
      }
    });

    broadcastForumEvent('answer_updated', mapAnswerRoles(updated));
    res.status(200).json({ success: true, data: mapAnswerRoles(updated) });
  } catch (error: any) {
    console.error('Edit Answer Error:', error);
    res.status(500).json({ success: false, message: 'Failed to update answer' });
  }
};

export const deleteAnswer = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const authorId = req.user?.sub;

    const answer = await prisma.forumAnswer.findUnique({
      where: { id, deletedAt: null }
    });

    if (!answer) {
      res.status(404).json({ success: false, message: 'Answer not found' });
      return;
    }

    if (answer.authorId !== authorId) {
      res.status(403).json({ success: false, message: 'Unauthorized' });
      return;
    }

    await prisma.$transaction([
      prisma.forumAnswer.update({
        where: { id },
        data: { deletedAt: new Date() }
      }),
      prisma.forumQuestion.update({
        where: { id: answer.questionId },
        data: { answerCount: { decrement: 1 } }
      })
    ]);

    broadcastForumEvent('answer_deleted', { id, questionId: answer.questionId });
    res.status(200).json({ success: true, message: 'Answer deleted successfully' });
  } catch (error: any) {
    console.error('Delete Answer Error:', error);
    res.status(500).json({ success: false, message: 'Failed to delete answer' });
  }
};

export const voteAnswer = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params; // Answer ID
    const { type } = req.body;
    const userId = req.user?.sub;

    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const voteType = type as VoteType;

    const answer = await prisma.forumAnswer.findUnique({
      where: { id, deletedAt: null }
    });

    if (!answer) {
      res.status(404).json({ success: false, message: 'Answer not found' });
      return;
    }

    const existingVote = await prisma.forumVote.findUnique({
      where: {
        answerId_userId: { answerId: id, userId }
      }
    });

    const result = await prisma.$transaction(async (tx) => {
      let repChange = 0;

      if (existingVote) {
        if (existingVote.type === voteType) {
          // Toggle off
          await tx.forumVote.delete({ where: { id: existingVote.id } });
          repChange = voteType === VoteType.UP ? -10 : 2;
        } else {
          // Switch vote
          await tx.forumVote.update({
            where: { id: existingVote.id },
            data: { type: voteType }
          });
          repChange = voteType === VoteType.UP ? 12 : -12; // (switch up adds +10 and cancels -2, switch down subtracts -10 and adds -2)
        }
      } else {
        // New vote
        await tx.forumVote.create({
          data: { answerId: id, userId, type: voteType }
        });
        repChange = voteType === VoteType.UP ? 10 : -2;
      }

      // Update reputation of answer author
      if (answer.authorId !== userId) {
        await adjustUserReputation(answer.authorId, repChange, tx);
      }

      // Recompute vote counts
      const upvotesCount = await tx.forumVote.count({
        where: { answerId: id, type: VoteType.UP }
      });
      const downvotesCount = await tx.forumVote.count({
        where: { answerId: id, type: VoteType.DOWN }
      });

      const updated = await tx.forumAnswer.update({
        where: { id },
        data: {
          upvotes: upvotesCount,
          downvotes: downvotesCount
        },
        include: {
          author: {
            select: {
              id: true,
              name: true,
              roles: true,
              forumStats: true
            }
          }
        }
      });

      return updated;
    });

    broadcastForumEvent('answer_voted', mapAnswerRoles(result));
    res.status(200).json({ success: true, data: mapAnswerRoles(result) });
  } catch (error: any) {
    console.error('Vote Answer Error:', error);
    res.status(500).json({ success: false, message: 'Failed to cast vote' });
  }
};

export const acceptAnswer = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params; // Answer ID
    const userId = req.user?.sub;

    const answer = await prisma.forumAnswer.findUnique({
      where: { id, deletedAt: null },
      include: { question: true }
    });

    if (!answer) {
      res.status(404).json({ success: false, message: 'Answer not found' });
      return;
    }

    if (answer.question.authorId !== userId) {
      res.status(403).json({ success: false, message: 'Only the question creator can accept an answer' });
      return;
    }

    const result = await prisma.$transaction(async (tx) => {
      // Reset any previously accepted answer
      await tx.forumAnswer.updateMany({
        where: { questionId: answer.questionId, isAccepted: true },
        data: { isAccepted: false }
      });

      // Mark this accepted
      const updatedAns = await tx.forumAnswer.update({
        where: { id },
        data: { isAccepted: true }
      });

      // Resolve the question
      await tx.forumQuestion.update({
        where: { id: answer.questionId },
        data: { status: QuestionStatus.SOLVED }
      });

      // Reward points (+15 rep for accepted answer)
      if (answer.authorId !== userId) {
        await adjustUserReputation(answer.authorId, 15, tx);

        // Send accepted answer notification
        await createNotification(
          answer.authorId,
          'ACCEPTED',
          'Answer Accepted!',
          `Your answer was accepted as the solution for "${answer.question.title}".`,
          answer.questionId,
          tx
        );
      }

      return updatedAns;
    });

    broadcastForumEvent('answer_accepted', result);
    res.status(200).json({ success: true, data: result });
  } catch (error: any) {
    console.error('Accept Answer Error:', error);
    res.status(500).json({ success: false, message: 'Failed to accept answer' });
  }
};

export const reopenQuestion = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user?.sub;

    const question = await prisma.forumQuestion.findUnique({
      where: { id, deletedAt: null }
    });

    if (!question) {
      res.status(404).json({ success: false, message: 'Question not found' });
      return;
    }

    if (question.authorId !== userId) {
      res.status(403).json({ success: false, message: 'Only the author can reopen this question' });
      return;
    }

    await prisma.$transaction([
      prisma.forumQuestion.update({
        where: { id },
        data: { status: QuestionStatus.UNSOLVED }
      }),
      prisma.forumAnswer.updateMany({
        where: { questionId: id },
        data: { isAccepted: false }
      })
    ]);

    broadcastForumEvent('question_reopened', { id });
    res.status(200).json({ success: true, message: 'Question reopened successfully' });
  } catch (error: any) {
    console.error('Reopen Question Error:', error);
    res.status(500).json({ success: false, message: 'Failed to reopen question' });
  }
};

export const reportContent = async (req: Request, res: Response): Promise<void> => {
  try {
    const { questionId, answerId, reason } = req.body;
    const reporterId = req.user?.sub;

    if (!reporterId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const report = await prisma.$transaction(async (tx) => {
      const rep = await tx.forumReport.create({
        data: {
          reporterId,
          questionId: questionId || undefined,
          answerId: answerId || undefined,
          reason
        }
      });

      // Queue a user notification acknowledging receipt
      await createNotification(
        reporterId,
        'MODERATION',
        'Report Received',
        'Thank you. We have received your report and our moderators are reviewing the content.',
        questionId || null,
        tx
      );

      return rep;
    });

    res.status(201).json({ success: true, data: report, message: 'Content reported successfully' });
  } catch (error: any) {
    console.error('Report Content Error:', error);
    res.status(500).json({ success: false, message: 'Failed to report content' });
  }
};

/**
 * AI thread summarizer endpoint.
 */
export const getQuestionSummary = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const question = await prisma.forumQuestion.findUnique({
      where: { id, deletedAt: null },
      include: {
        answers: {
          where: { deletedAt: null }
        }
      }
    });

    if (!question) {
      res.status(404).json({ success: false, message: 'Question not found' });
      return;
    }

    const summary = generateThreadSummary(
      question.title,
      question.description || '',
      question.answers.map(ans => ({
        content: ans.content || '',
        upvotes: ans.upvotes,
        isAccepted: ans.isAccepted
      }))
    );

    res.status(200).json({ success: true, summary });
  } catch (error: any) {
    console.error('Thread Summary Error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate thread summary' });
  }
};

/**
 * Toggle bookmark status for a question.
 */
export const toggleBookmark = async (req: Request, res: Response): Promise<void> => {
  try {
    const { questionId } = req.body;
    const userId = req.user?.sub;

    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const question = await prisma.forumQuestion.findUnique({
      where: { id: questionId, deletedAt: null }
    });

    if (!question) {
      res.status(404).json({ success: false, message: 'Question not found' });
      return;
    }

    const existing = await prisma.bookmark.findUnique({
      where: {
        userId_questionId: { userId, questionId }
      }
    });

    let bookmarked = false;
    if (existing) {
      await prisma.bookmark.delete({
        where: { id: existing.id }
      });
    } else {
      await prisma.bookmark.create({
        data: { userId, questionId }
      });
      bookmarked = true;
    }

    res.status(200).json({ success: true, bookmarked });
  } catch (error: any) {
    console.error('Toggle Bookmark Error:', error);
    res.status(500).json({ success: false, message: 'Failed to toggle bookmark' });
  }
};

/**
 * List current user's bookmarks.
 */
export const listBookmarks = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.sub;

    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const bookmarks = await prisma.bookmark.findMany({
      where: { userId },
      include: {
        question: {
          include: {
            tags: true,
            author: {
              select: {
                id: true,
                name: true,
                roles: true,
                forumStats: true
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const questions = bookmarks.map(b => b.question).filter(q => q.deletedAt === null);

    res.status(200).json({ success: true, data: questions.map(mapQuestionRoles) });
  } catch (error: any) {
    console.error('List Bookmarks Error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch bookmarks' });
  }
};

/**
 * List current user's notifications.
 */
export const listNotifications = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.sub;

    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const notifications = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });

    res.status(200).json({ success: true, data: notifications });
  } catch (error: any) {
    console.error('List Notifications Error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch notifications' });
  }
};

/**
 * Mark notification as read.
 */
export const markAllNotificationsRead = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.sub;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }
    await prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true }
    });
    res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('Mark All Notifications Read Error:', error);
    res.status(500).json({ success: false, message: 'Failed to update notifications' });
  }
};

export const markNotificationRead = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user?.sub;

    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const notification = await prisma.notification.findUnique({
      where: { id }
    });

    if (!notification || notification.userId !== userId) {
      res.status(404).json({ success: false, message: 'Notification not found' });
      return;
    }

    const updated = await prisma.notification.update({
      where: { id },
      data: { read: true }
    });

    res.status(200).json({ success: true, data: updated });
  } catch (error: any) {
    console.error('Mark Notification Read Error:', error);
    res.status(500).json({ success: false, message: 'Failed to update notification' });
  }
};
