import { Queue } from "bullmq";

// ─────────────────────────────────────────────────────
// Classify Queue — forum-svc producer side
// Same pattern as chat-svc; worker lives in user-svc.
//
// Tier C: text content → text classification
// Tier D: imageUrl → image classification
//
// Images are served from forum-svc at /uploads/{filename}.
// The full URL is constructed in the controller using the
// request host (or FORUM_SVC_BASE_URL in production).
// ─────────────────────────────────────────────────────

const MODERATION_QUEUE = "moderation:classify";

let _queue: Queue | null = null;

function getQueue(): Queue | null {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) return null;
  if (_queue) return _queue;

  const url = new URL(redisUrl);
  _queue = new Queue(MODERATION_QUEUE, {
    connection: {
      host: url.hostname,
      port: parseInt(url.port || "6379", 10),
      password: url.password || undefined,
    },
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 5000 },
      removeOnComplete: { count: 1000 },
      removeOnFail: { count: 500 },
    },
  });
  return _queue;
}

export type ForumContentType = "forum_question" | "forum_answer";

export interface ForumClassifyJob {
  contentType: ForumContentType;
  contentId: string;
  userId: string;
  /** Text content for Tier C */
  text?: string;
  /** Image URL for Tier D — must be publicly accessible */
  imageUrl?: string;
}

/**
 * Enqueue a forum question or answer for async AI classification.
 * Handles both text (Tier C) and image (Tier D) in one job.
 * Fire-and-forget — never throws.
 */
export function enqueueForClassification(job: ForumClassifyJob): void {
  const hasContent = job.text?.trim() || job.imageUrl;
  if (!hasContent) return;

  const q = getQueue();
  if (!q) return;

  q.add("classify", { ...job, text: job.text?.slice(0, 2000) }).catch((err: Error) => {
    console.warn("[classify-queue] Failed to enqueue:", err.message);
  });
}
