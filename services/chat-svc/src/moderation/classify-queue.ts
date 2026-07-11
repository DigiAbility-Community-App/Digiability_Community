import { Queue } from "bullmq";
import { env } from "../config/env";

// ─────────────────────────────────────────────────────
// Classify Queue — chat-svc producer side
//
// Enqueues messages for async AI classification after they
// have been persisted to the database. The BullMQ worker
// in user-svc consumes this queue.
//
// Tier C: text messages → text classification
// Tier D: image/file messages → image URL classification
// ─────────────────────────────────────────────────────

const MODERATION_QUEUE = "moderation:classify";

let _queue: Queue | null = null;

function getQueue(): Queue {
  if (_queue) return _queue;
  const url = new URL(env.REDIS_URL);
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

export interface ChatClassifyJob {
  contentType: "chat_message";
  contentId: string;
  userId: string;
  /** Text content — present for TEXT messages */
  text?: string;
  /** Image URL — present for IMAGE messages.
   *  Extracted from message metadata JSON: { url: "https://..." } */
  imageUrl?: string;
}

/**
 * Try to extract a public image URL from the message metadata JSON string.
 * Returns undefined if the metadata is absent, unparseable, or has no url field.
 */
export function extractImageUrl(metadata?: string): string | undefined {
  if (!metadata) return undefined;
  try {
    const parsed = JSON.parse(metadata) as Record<string, unknown>;
    const url = parsed.url ?? parsed.imageUrl ?? parsed.uri;
    return typeof url === "string" && url.startsWith("http") ? url : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Enqueue a chat message for async AI classification.
 * At least one of text or imageUrl must be non-empty, otherwise skipped.
 * Fire-and-forget — errors never affect message delivery.
 */
export function enqueueForClassification(job: ChatClassifyJob): void {
  const hasContent = (job.text?.trim()) || job.imageUrl;
  if (!hasContent) return;

  getQueue()
    .add("classify", {
      ...job,
      text: job.text?.slice(0, 2000),
    })
    .catch((err: Error) => {
      console.warn("[classify-queue] Failed to enqueue:", err.message);
    });
}
