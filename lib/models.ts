/**
 * Catalog of video models exposed in the studio.
 *
 * Every entry maps a public model id to fal.ai queue endpoints plus the
 * capabilities the UI should surface. Endpoint slugs live only here, so
 * adding/renaming a model is a one-file change. Verify slugs against
 * https://fal.ai/models before deploying — providers occasionally rename them.
 */

export type AspectRatio = "16:9" | "9:16" | "1:1" | "4:3" | "21:9";
export type Resolution = "480p" | "720p";
export type GenerationModeId = "text-to-video" | "image-to-video";

export interface VideoModel {
  id: string;
  name: string;
  vendor: string;
  description: string;
  /** fal queue endpoint per mode; omit a mode the model does not support */
  endpoints: Partial<Record<GenerationModeId, string>>;
  durations: number[]; // seconds
  aspectRatios: AspectRatio[];
  resolutions: Resolution[];
  supportsNegativePrompt: boolean;
  supportsSeed: boolean;
  supportsCameraMotion: boolean;
  cameraMotions?: string[];
  /**
   * What fal.ai bills US per second of output at each resolution (USD).
   * NEVER exposed to clients — used only to derive credit prices.
   * Source: fal.ai model pages, July 2026. Re-verify before deploy and when
   * fal announces price changes; margins depend on these being current.
   */
  costPerSecondUsd: Partial<Record<Resolution, number>>;
  badge?: "recommended" | "fast" | "new";
}

/**
 * Pricing policy: every purchase path (plans AND packs) sells credits at a
 * uniform CREDIT_VALUE_USD, and every generation is priced at provider cost
 * plus a fixed MARGIN_PER_GENERATION_USD. Rounding is always up, so the
 * realized margin per generation is >= the target on every model.
 */
export const CREDIT_VALUE_USD = 0.05;
export const MARGIN_PER_GENERATION_USD = 0.15;

export const MODELS: VideoModel[] = [
  {
    id: "seedance-2.0",
    name: "Seedance 2.0",
    vendor: "ByteDance",
    description: "Flagship quality. Excellent motion coherence and prompt adherence.",
    endpoints: {
      "text-to-video": "bytedance/seedance-2.0/text-to-video",
      "image-to-video": "bytedance/seedance-2.0/image-to-video",
    },
    durations: [4, 5, 8, 10, 15],
    aspectRatios: ["16:9", "9:16", "1:1", "4:3", "21:9"],
    // 480p removed until fal publishes a 480p rate for Seedance 2.0 —
    // pricing an unverified tier would risk selling below cost.
    resolutions: ["720p"],
    supportsNegativePrompt: true,
    supportsSeed: true,
    supportsCameraMotion: true,
    cameraMotions: ["none", "zoom_in", "zoom_out", "pan_left", "pan_right", "tilt_up", "tilt_down", "orbit"],
    costPerSecondUsd: { "720p": 0.3034 },
    badge: "recommended",
  },
  {
    id: "seedance-2.0-fast",
    name: "Seedance 2.0 Fast",
    vendor: "ByteDance",
    description: "Same model, tuned for speed. Great for iterating on prompts.",
    endpoints: {
      "text-to-video": "bytedance/seedance-2.0/fast/text-to-video",
      "image-to-video": "bytedance/seedance-2.0/fast/image-to-video",
    },
    durations: [4, 5, 8, 10],
    aspectRatios: ["16:9", "9:16", "1:1", "4:3", "21:9"],
    resolutions: ["720p"],
    supportsNegativePrompt: true,
    supportsSeed: true,
    supportsCameraMotion: true,
    cameraMotions: ["none", "zoom_in", "zoom_out", "pan_left", "pan_right", "tilt_up", "tilt_down", "orbit"],
    costPerSecondUsd: { "720p": 0.2419 },
    badge: "fast",
  },
  {
    id: "kling-2.1",
    name: "Kling 2.1",
    vendor: "Kuaishou",
    description: "Cinematic look with strong physics and character consistency.",
    endpoints: {
      "text-to-video": "fal-ai/kling-video/v2.1/standard/text-to-video",
      "image-to-video": "fal-ai/kling-video/v2.1/standard/image-to-video",
    },
    durations: [5, 10],
    aspectRatios: ["16:9", "9:16", "1:1"],
    resolutions: ["720p"],
    supportsNegativePrompt: true,
    supportsSeed: false,
    supportsCameraMotion: false,
    // fal bills Kling 2.1 Standard ~$0.25 per 5s clip → $0.05/s equivalent.
    costPerSecondUsd: { "720p": 0.05 },
  },
  {
    id: "luma-dream-machine",
    name: "Luma Dream Machine",
    vendor: "Luma AI",
    description: "Dreamlike aesthetics and smooth camera moves.",
    endpoints: {
      "text-to-video": "fal-ai/luma-dream-machine",
      "image-to-video": "fal-ai/luma-dream-machine/image-to-video",
    },
    durations: [5],
    aspectRatios: ["16:9", "9:16", "1:1", "4:3", "21:9"],
    resolutions: ["720p"],
    supportsNegativePrompt: false,
    supportsSeed: false,
    supportsCameraMotion: false,
    costPerSecondUsd: { "720p": 0.08 },
  },
  {
    id: "minimax-hailuo-02",
    name: "MiniMax Hailuo 02",
    vendor: "MiniMax",
    description: "Vivid, expressive motion. Strong for people and animals.",
    endpoints: {
      "text-to-video": "fal-ai/minimax/hailuo-02/standard/text-to-video",
      "image-to-video": "fal-ai/minimax/hailuo-02/standard/image-to-video",
    },
    durations: [6, 10],
    aspectRatios: ["16:9", "9:16", "1:1"],
    resolutions: ["720p"],
    supportsNegativePrompt: false,
    supportsSeed: false,
    supportsCameraMotion: false,
    costPerSecondUsd: { "720p": 0.045 },
  },
];

export function getModel(id: string): VideoModel | undefined {
  return MODELS.find((m) => m.id === id);
}

/**
 * Credit price for a run: provider cost plus the fixed per-generation margin,
 * converted to credits and rounded up. At CREDIT_VALUE_USD per credit this
 * guarantees the site earns >= MARGIN_PER_GENERATION_USD on every successful
 * generation, on every model.
 */
export function creditCost(model: VideoModel, duration: number, resolution: Resolution): number {
  const costPerSecond = model.costPerSecondUsd[resolution];
  if (costPerSecond === undefined) {
    throw new Error(`${model.id} has no cost configured for ${resolution}`);
  }
  const providerCost = costPerSecond * duration;
  return Math.ceil((providerCost + MARGIN_PER_GENERATION_USD) / CREDIT_VALUE_USD);
}
