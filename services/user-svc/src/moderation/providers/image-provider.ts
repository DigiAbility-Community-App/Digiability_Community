// ─────────────────────────────────────────────────────
// Image Moderation Provider
//
// Interface + implementations for vision/content-safety
// providers used in Tier D async media classification.
//
// Pluggable: set GOOGLE_VISION_API_KEY for Google Cloud
// Vision SafeSearch. Without a key the noop provider is
// used and images are not classified.
//
// To add a new provider (Azure Content Safety, AWS
// Rekognition, etc.) implement ImageProvider and register
// it in getImageProvider() below.
// ─────────────────────────────────────────────────────

// ─── Interface ─────────────────────────────────────────

export interface ImageClassificationResult {
  flagged: boolean;
  score: number;       // 0-1, worst across all harm categories
  categories: string[]; // e.g. ["adult", "violence"]
  rawResponse?: string;
}

export interface ImageProvider {
  readonly name: string;
  /**
   * Classify an image.
   * @param url Publicly accessible image URL (or data URI if provider supports it)
   */
  classify(url: string): Promise<ImageClassificationResult>;
}

// ─── Noop ───────────────────────────────────────────────

class NoopImageProvider implements ImageProvider {
  readonly name = "noop-image";
  async classify(_url: string): Promise<ImageClassificationResult> {
    return { flagged: false, score: 0, categories: [] };
  }
}

// ─── Google Cloud Vision SafeSearch ─────────────────────
//
// Free tier: 1 000 units / month.
// Requires: GOOGLE_VISION_API_KEY
// API reference: https://cloud.google.com/vision/docs/reference/rest/v1/images/annotate
//
// Harm levels → numeric score:
//   VERY_UNLIKELY = 0.05  UNLIKELY = 0.20  POSSIBLE = 0.50
//   LIKELY = 0.80         VERY_LIKELY = 0.95

const LEVEL_TO_SCORE: Record<string, number> = {
  VERY_UNLIKELY: 0.05,
  UNLIKELY: 0.20,
  POSSIBLE: 0.50,
  LIKELY: 0.80,
  VERY_LIKELY: 0.95,
};

const VISION_API = "https://vision.googleapis.com/v1/images:annotate";

interface SafeSearchAnnotation {
  adult?: string;
  spoof?: string;
  medical?: string;
  violence?: string;
  racy?: string;
}

interface VisionResponse {
  responses: Array<{
    safeSearchAnnotation?: SafeSearchAnnotation;
    error?: { message: string };
  }>;
}

class GoogleVisionProvider implements ImageProvider {
  readonly name = "google-vision";
  private readonly apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async classify(url: string): Promise<ImageClassificationResult> {
    try {
      const resp = await fetch(`${VISION_API}?key=${this.apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requests: [{
            image: { source: { imageUri: url } },
            features: [{ type: "SAFE_SEARCH_DETECTION" }],
          }],
        }),
        signal: AbortSignal.timeout(15_000),
      });

      if (!resp.ok) {
        console.error(`[GoogleVision] HTTP ${resp.status}`);
        return { flagged: false, score: 0, categories: [] };
      }

      const body = await resp.json() as VisionResponse;
      const result = body.responses?.[0];

      if (result?.error) {
        console.error(`[GoogleVision] API error: ${result.error.message}`);
        return { flagged: false, score: 0, categories: [] };
      }

      const ss = result?.safeSearchAnnotation ?? {};
      const categoryScores: Record<string, number> = {
        adult:    LEVEL_TO_SCORE[ss.adult    ?? "VERY_UNLIKELY"] ?? 0,
        violence: LEVEL_TO_SCORE[ss.violence ?? "VERY_UNLIKELY"] ?? 0,
        racy:     LEVEL_TO_SCORE[ss.racy     ?? "VERY_UNLIKELY"] ?? 0,
      };

      const score = Math.max(...Object.values(categoryScores));
      const flaggedCategories = Object.entries(categoryScores)
        .filter(([, s]) => s >= 0.5)
        .map(([cat]) => `image:${cat}`);

      const rawResponse = JSON.stringify(ss).slice(0, 1024);

      return {
        flagged: flaggedCategories.length > 0,
        score,
        categories: flaggedCategories,
        rawResponse,
      };
    } catch (err) {
      console.error("[GoogleVision] classify failed:", err instanceof Error ? err.message : err);
      return { flagged: false, score: 0, categories: [] };
    }
  }
}

// ─── Factory ───────────────────────────────────────────

let _imageProvider: ImageProvider | null = null;

export function getImageProvider(): ImageProvider {
  if (_imageProvider) return _imageProvider;

  const googleKey = process.env.GOOGLE_VISION_API_KEY;
  if (googleKey) {
    console.log("[Moderation] Using Google Cloud Vision image provider");
    _imageProvider = new GoogleVisionProvider(googleKey);
    return _imageProvider;
  }

  console.warn(
    "[Moderation] No image provider configured (set GOOGLE_VISION_API_KEY). " +
    "Image classification disabled — falling back to noop."
  );
  _imageProvider = new NoopImageProvider();
  return _imageProvider;
}
