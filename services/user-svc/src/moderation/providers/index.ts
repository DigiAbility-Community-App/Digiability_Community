import type { ModerationProvider } from "./interface";
import { OpenAIProvider } from "./openai.provider";
import { NoopProvider } from "./noop.provider";

// ─────────────────────────────────────────────────────
// Provider Factory
//
// Resolution order (first match wins):
//   1. OPENAI_API_KEY set → OpenAIProvider
//   2. (future) PERSPECTIVE_API_KEY set → PerspectiveProvider
//   3. Fallback → NoopProvider (logs a warning at startup)
//
// To add a new provider:
//   1. Implement ModerationProvider in a new file
//   2. Add a check here
// ─────────────────────────────────────────────────────

let _provider: ModerationProvider | null = null;

export function getModerationProvider(): ModerationProvider {
  if (_provider) return _provider;

  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey) {
    console.log("[Moderation] Using OpenAI Moderation provider");
    _provider = new OpenAIProvider(openaiKey);
    return _provider;
  }

  console.warn(
    "[Moderation] No AI provider configured (set OPENAI_API_KEY). " +
    "Falling back to noop — async classification disabled."
  );
  _provider = new NoopProvider();
  return _provider;
}

export type { ModerationProvider, ClassificationResult } from "./interface";
