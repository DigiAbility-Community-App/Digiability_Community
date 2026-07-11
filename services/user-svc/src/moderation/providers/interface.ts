// ─────────────────────────────────────────────────────
// AI Moderation Provider Interface
//
// All providers must implement this contract so the worker
// can swap between OpenAI, Perspective, or any future
// multilingual provider without touching worker logic.
// ─────────────────────────────────────────────────────

export interface ClassificationResult {
  /** Whether the provider considers this content policy-violating */
  flagged: boolean;
  /** 0–1 probability (max across all category scores) */
  score: number;
  /** Human-readable violation categories (e.g. ["harassment", "hate"]) */
  categories: string[];
  /** Raw API response truncated to 2 KB for debugging storage */
  rawResponse?: string;
}

export interface ModerationProvider {
  /** Unique slug used in ModerationFlag.provider column */
  readonly name: string;
  /** Classify a single piece of text. Never throws — returns noop result on error. */
  classify(text: string): Promise<ClassificationResult>;
}
