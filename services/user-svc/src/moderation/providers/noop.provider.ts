import type { ModerationProvider, ClassificationResult } from "./interface";

// ─────────────────────────────────────────────────────
// Noop Provider
// Always returns a clean classification with score 0.
// Used when no AI API key is configured, or in tests.
// ─────────────────────────────────────────────────────

export class NoopProvider implements ModerationProvider {
  readonly name = "noop";

  async classify(_text: string): Promise<ClassificationResult> {
    return { flagged: false, score: 0, categories: [] };
  }
}
