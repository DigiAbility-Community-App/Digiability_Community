import type { ModerationProvider, ClassificationResult } from "./interface";

// ─────────────────────────────────────────────────────
// OpenAI Moderation Provider
//
// Uses OpenAI's free moderation endpoint:
//   POST https://api.openai.com/v1/moderations
//
// Requires env: OPENAI_API_KEY
// No paid plan needed — moderation endpoint is free.
// Input limit: 2 048 tokens (~1 500 words). We truncate
// at 1 500 chars before sending to stay well within limits.
//
// To swap for a different provider (Perspective API,
// Azure Content Safety, etc.) implement ModerationProvider
// and register it in providers/index.ts.
// ─────────────────────────────────────────────────────

const OPENAI_API = "https://api.openai.com/v1/moderations";
const MAX_INPUT_CHARS = 1500;

interface OpenAICategories {
  hate: boolean;
  "hate/threatening": boolean;
  harassment: boolean;
  "harassment/threatening": boolean;
  "self-harm": boolean;
  "self-harm/instructions": boolean;
  "self-harm/intent": boolean;
  sexual: boolean;
  "sexual/minors": boolean;
  violence: boolean;
  "violence/graphic": boolean;
}

interface OpenAICategoryScores {
  hate: number;
  "hate/threatening": number;
  harassment: number;
  "harassment/threatening": number;
  "self-harm": number;
  "self-harm/instructions": number;
  "self-harm/intent": number;
  sexual: number;
  "sexual/minors": number;
  violence: number;
  "violence/graphic": number;
}

interface OpenAIResult {
  flagged: boolean;
  categories: OpenAICategories;
  category_scores: OpenAICategoryScores;
}

interface OpenAIResponse {
  results: OpenAIResult[];
}

export class OpenAIProvider implements ModerationProvider {
  readonly name = "openai";
  private readonly apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async classify(text: string): Promise<ClassificationResult> {
    const input = text.slice(0, MAX_INPUT_CHARS);

    try {
      const resp = await fetch(OPENAI_API, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({ input }),
        signal: AbortSignal.timeout(10_000), // 10-second timeout
      });

      if (!resp.ok) {
        console.error(`[OpenAIProvider] API error ${resp.status}`);
        return { flagged: false, score: 0, categories: [] };
      }

      const body = await resp.json() as OpenAIResponse;
      const result = body.results?.[0];
      if (!result) return { flagged: false, score: 0, categories: [] };

      // Collect active violation categories
      const categories = (Object.entries(result.categories) as [string, boolean][])
        .filter(([, active]) => active)
        .map(([cat]) => cat);

      // Max score across all categories
      const score = Math.max(0, ...Object.values(result.category_scores));

      const rawResponse = JSON.stringify({
        flagged: result.flagged,
        categories: result.categories,
        category_scores: result.category_scores,
      }).slice(0, 2048);

      return { flagged: result.flagged, score, categories, rawResponse };
    } catch (err) {
      console.error("[OpenAIProvider] classify failed:", err instanceof Error ? err.message : err);
      return { flagged: false, score: 0, categories: [] };
    }
  }
}
