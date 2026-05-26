import { z } from 'zod';

export const QuestionSchema = z.object({
  title: z.string().min(5, 'Title must be at least 5 characters long').max(150, 'Title cannot exceed 150 characters'),
  description: z.string().min(10, 'Description must be at least 10 characters long').optional().nullable(),
  category: z.string().min(2, 'Category is required'),
  tags: z.union([z.string(), z.array(z.string())]).optional(),
  imageUrl: z.string().url('Image URL must be valid').optional().nullable(),
  altText: z.string().max(250, 'Alt text cannot exceed 250 characters').optional().nullable(),
  audioUrl: z.string().url('Audio URL must be valid').optional().nullable(),
});

export const AnswerSchema = z.object({
  content: z.string().min(3, 'Answer content must be at least 3 characters long'),
  imageUrl: z.string().url('Image URL must be valid').optional().nullable(),
  altText: z.string().max(250, 'Alt text cannot exceed 250 characters').optional().nullable(),
  audioUrl: z.string().url('Audio URL must be valid').optional().nullable(),
});

export const VoteSchema = z.object({
  type: z.enum(['UP', 'DOWN']),
});

export const ReportSchema = z.object({
  questionId: z.string().uuid('Invalid question ID').optional().nullable(),
  answerId: z.string().uuid('Invalid answer ID').optional().nullable(),
  reason: z.string().min(5, 'Reason must be at least 5 characters long').max(500, 'Reason cannot exceed 500 characters'),
}).refine(data => data.questionId || data.answerId, {
  message: 'Either questionId or answerId must be provided',
  path: ['questionId'],
});

export const BookmarkSchema = z.object({
  questionId: z.string().uuid('Invalid question ID'),
});
