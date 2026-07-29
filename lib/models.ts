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
  /** base credit cost for the shortest duration at the lowest resolution */
  baseCredits: number;
  badge?: "recommended" | "fast" | "new";
}

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
    resolutions: ["480p", "720p"],
    supportsNegativePrompt: true,
    supportsSeed: true,
    supportsCameraMotion: true,
    cameraMotions: ["none", "zoom_in", "zoom_out", "pan_left", "pan_right", "tilt_up", "tilt_down", "orbit"],
    baseCredits: 2,
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
    resolutions: ["480p", "720p"],
    supportsNegativePrompt: true,
    supportsSeed: true,
    supportsCameraMotion: true,
    cameraMotions: ["none", "zoom_in", "zoom_out", "pan_left", "pan_right", "tilt_up", "tilt_down", "orbit"],
    baseCredits: 1,
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
    baseCredits: 2,
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
    baseCredits: 2,
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
    baseCredits: 2,
  },
];

export function getModel(id: string): VideoModel | undefined {
  return MODELS.find((m) => m.id === id);
}

/**
 * Credit price for a run. Longer clips and higher resolutions cost more:
 * base × duration multiplier (per started 5s block) × resolution multiplier.
 */
export function creditCost(model: VideoModel, duration: number, resolution: Resolution): number {
  const durationBlocks = Math.max(1, Math.ceil(duration / 5));
  const resolutionMultiplier = resolution === "720p" ? 2 : 1;
  return model.baseCredits * durationBlocks * resolutionMultiplier;
}
