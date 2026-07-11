import { Worker, Job } from "bullmq";
import prisma from "../models/prisma.client";
import { getModerationProvider } from "../moderation/providers";
import { getImageProvider } from "../moderation/providers/image-provider";

// ─────────────────────────────────────────────────────
// Moderation Worker (Tier C + D)
//
// BullMQ worker that reads from 'moderation:classify' and:
//   Tier C — calls AI text classification (OpenAI Moderation)
//   Tier D — calls vision/content-safety for images (Google Vision)
//
// Both checks run when both text and imageUrl are present.
// The worst result is persisted as a single ModerationFlag.
//
// Environment:
//   REDIS_URL                    — shared Redis instance
//   OPENAI_API_KEY               — optional text provider
//   GOOGLE_VISION_API_KEY        — optional image provider
//   MODERATION_FLAG_THRESHOLD    — min score to write a flag (default 0.5)
// ─────────────────────────────────────────────────────

export const MODERATION_QUEUE = "moderation:classify";

export interface ClassifyJobData {
  contentType: "chat_message" | "forum_question" | "forum_answer";
  contentId: string;
  userId: string;
  /** Text content for Tier C classification (truncated to 2 000 chars at enqueue) */
  text?: string;
  /** Image URL for Tier D classification.
   *  Must be publicly accessible at the time the job runs.
   *  For forum uploads: http://{FORUM_SVC_HOST}/uploads/{filename}
   *  For chat images:   URL extracted from message metadata JSON */
  imageUrl?: string;
}

const FLAG_THRESHOLD = parseFloat(process.env.MODERATION_FLAG_THRESHOLD ?? "0.5");

function worstOf(
  a: { score: number; categories: string[]; flagged: boolean; rawResponse?: string },
  b: { score: number; categories: string[]; flagged: boolean; rawResponse?: string }
) {
  return {
    flagged: a.flagged || b.flagged,
    score: Math.max(a.score, b.score),
    categories: [...new Set([...a.categories, ...b.categories])],
    rawResponse: [a.rawResponse, b.rawResponse].filter(Boolean).join(" | ").slice(0, 2048) || undefined,
  };
}

export function startModerationWorker(): Worker {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) throw new Error("REDIS_URL is required for moderation worker");

  const url = new URL(redisUrl);
  const connection = {
    host: url.hostname,
    port: parseInt(url.port || "6379", 10),
    password: url.password || undefined,
  };

  const textProvider = getModerationProvider();
  const imageProvider = getImageProvider();

  const worker = new Worker<ClassifyJobData>(
    MODERATION_QUEUE,
    async (job: Job<ClassifyJobData>) => {
      const { contentType, contentId, userId, text, imageUrl } = job.data;

      const CLEAN: { flagged: boolean; score: number; categories: string[]; rawResponse?: string } =
        { flagged: false, score: 0, categories: [] };

      // ── Tier C: Text classification ──────────────────
      const textResult = text?.trim()
        ? await textProvider.classify(text)
        : CLEAN;

      // ── Tier D: Image classification ──────────────────
      const imageResult = imageUrl
        ? await imageProvider.classify(imageUrl)
        : CLEAN;

      // Merge: worst result wins
      const combined = worstOf(textResult, imageResult);

      // Skip writing a flag if score is below threshold
      if (combined.score < FLAG_THRESHOLD) return;

      await prisma.moderationFlag.upsert({
        where: { contentType_contentId: { contentType, contentId } },
        create: {
          contentType,
          contentId,
          userId,
          text: text?.slice(0, 500),
          provider: [textResult.score > 0 ? textProvider.name : null, imageResult.score > 0 ? imageProvider.name : null]
            .filter(Boolean).join("+") || "noop",
          score: combined.score,
          categories: combined.categories,
          rawResponse: combined.rawResponse,
        },
        update: {
          provider: [textResult.score > 0 ? textProvider.name : null, imageResult.score > 0 ? imageProvider.name : null]
            .filter(Boolean).join("+") || "noop",
          score: combined.score,
          categories: combined.categories,
          rawResponse: combined.rawResponse,
          updatedAt: new Date(),
        },
      });

      console.log(
        `[ModerationWorker] Flagged ${contentType} ${contentId} — score ${combined.score.toFixed(3)} [${combined.categories.join(", ")}]`
      );
    },
    {
      connection,
      concurrency: 5,
      limiter: { max: 30, duration: 60_000 },
    }
  );

  worker.on("failed", (job, err) => {
    console.error(`[ModerationWorker] Job ${job?.id} failed:`, err.message);
  });

  console.log(
    `[ModerationWorker] Started — text: ${textProvider.name}, image: ${imageProvider.name}, threshold: ${FLAG_THRESHOLD}`
  );

  return worker;
}
