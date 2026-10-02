import { z } from 'zod';

// A client may only reference media it uploaded to forum-svc, as a
// host-relative path — the same contract as chat-svc. This used to accept any
// absolute URL, so a post could point at an arbitrary external host (and the
// app would download/share from it). Uploaded files arrive as multipart
// `image`/`audio` parts instead and never go through these fields.
const uploadPath = (label: string) =>
  z.string().regex(/^\/uploads\/[\w.-]+$/, `${label} must be one of your uploads`);

export const QuestionSchema = z.object({
  title: z.string().min(5, 'Title must be at least 5 characters long').max(150, 'Title cannot exceed 150 characters'),
  description: z.string().min(10, 'Description must be at least 10 characters long').optional().nullable(),
  category: z.string().min(2, 'Category is required'),
  tags: z.union([z.string(), z.array(z.string())]).optional(),
  imageUrl: uploadPath('Image').optional().nullable(),
  altText: z.string().max(250, 'Alt text cannot exceed 250 characters').optional().nullable(),
  audioUrl: uploadPath('Audio').optional().nullable(),
});

export const AnswerSchema = z.object({
  content: z.string().min(3, 'Answer content must be at least 3 characters long'),
  imageUrl: uploadPath('Image').optional().nullable(),
  altText: z.string().max(250, 'Alt text cannot exceed 250 characters').optional().nullable(),
  audioUrl: uploadPath('Audio').optional().nullable(),
});

// Edits allow image/audio-only updates (no text required)
export const EditAnswerSchema = z.object({
  content: z.string().min(3, 'Answer content must be at least 3 characters long').optional(),
  imageUrl: uploadPath('Image').optional().nullable(),
  altText: z.string().max(250, 'Alt text cannot exceed 250 characters').optional().nullable(),
  audioUrl: uploadPath('Audio').optional().nullable(),
});

export const VoteSchema = z.object({
  type: z.enum(['UP', 'DOWN']),
});

export const ReportSchema = z.object({
  questionId: z.string().uuid('Invalid question ID').optional().nullable(),
  answerId: z.string().uuid('Invalid answer ID').optional().nullable(),
  // 3, not 5: the client may send a bare category label as the whole reason,
  // and "Spam" is four characters. The old floor rejected the single most
  // common report in the system with a 422 the UI then swallowed.
  reason: z.string().min(3, 'Reason must be at least 3 characters long').max(500, 'Reason cannot exceed 500 characters'),
}).refine(data => data.questionId || data.answerId, {
  message: 'Either questionId or answerId must be provided',
  path: ['questionId'],
});

export const BookmarkSchema = z.object({
  questionId: z.string().uuid('Invalid question ID'),
});
