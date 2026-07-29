import { fal } from "@fal-ai/client";
import { getModel, type GenerationModeId } from "@/lib/models";

/**
 * Server-only wrapper around the fal.ai queue API. The FAL_KEY is read from
 * the environment here and must never reach the client bundle.
 */

let configured = false;
function ensureConfigured() {
  if (configured) return;
  const key = process.env.FAL_KEY;
  if (!key) throw new Error("FAL_KEY is not set");
  fal.config({ credentials: key });
  configured = true;
}

export interface SubmitOptions {
  modelId: string;
  mode: GenerationModeId;
  prompt: string;
  negativePrompt?: string;
  imageUrl?: string;
  duration: number;
  aspectRatio: string;
  resolution: string;
  seed?: number;
  cameraMotion?: string;
}

/** Submit a job to the fal queue; returns the provider request id. */
export async function submitGeneration(opts: SubmitOptions): Promise<string> {
  ensureConfigured();
  const model = getModel(opts.modelId);
  const endpoint = model?.endpoints[opts.mode];
  if (!model || !endpoint) throw new Error(`Model ${opts.modelId} does not support ${opts.mode}`);

  // fal video endpoints share a broadly common input shape; unsupported keys
  // are ignored server-side, but we only send what the model advertises.
  const input: Record<string, unknown> = {
    prompt: opts.prompt,
    duration: opts.duration,
    aspect_ratio: opts.aspectRatio,
    resolution: opts.resolution,
  };
  if (opts.mode === "image-to-video") input.image_url = opts.imageUrl;
  if (model.supportsNegativePrompt && opts.negativePrompt) input.negative_prompt = opts.negativePrompt;
  if (model.supportsSeed && opts.seed !== undefined) input.seed = opts.seed;
  if (model.supportsCameraMotion && opts.cameraMotion && opts.cameraMotion !== "none") {
    input.camera_motion = opts.cameraMotion;
  }

  const { request_id } = await withRetry(() => fal.queue.submit(endpoint, { input }));
  return request_id;
}

export type FalJobState =
  | { status: "IN_QUEUE" | "IN_PROGRESS" }
  | { status: "COMPLETED"; videoUrl: string; seed?: number }
  | { status: "FAILED"; error: string };

/** Poll the queue for a submitted job and normalize the result. */
export async function checkGeneration(
  modelId: string,
  mode: GenerationModeId,
  requestId: string,
): Promise<FalJobState> {
  ensureConfigured();
  const model = getModel(modelId);
  const endpoint = model?.endpoints[mode];
  if (!endpoint) return { status: "FAILED", error: "Unknown model endpoint" };

  try {
    const status = await fal.queue.status(endpoint, { requestId, logs: false });
    if (status.status === "IN_QUEUE" || status.status === "IN_PROGRESS") {
      return { status: status.status };
    }
  } catch (err) {
    // A 4xx from status usually means the request errored out at the provider.
    return { status: "FAILED", error: errorMessage(err) };
  }

  try {
    const result = await fal.queue.result(endpoint, { requestId });
    const data = result.data as { video?: { url?: string }; seed?: number };
    const url = data?.video?.url;
    if (!url) return { status: "FAILED", error: "Provider returned no video URL" };
    return { status: "COMPLETED", videoUrl: url, seed: data.seed };
  } catch (err) {
    return { status: "FAILED", error: errorMessage(err) };
  }
}

/** Upload a user-provided image to fal storage; returns a URL usable as input. */
export async function uploadImage(file: File): Promise<string> {
  ensureConfigured();
  return fal.storage.upload(file);
}

async function withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      // Only transient failures are worth retrying.
      const msg = errorMessage(err);
      if (!/429|5\d\d|timeout|network|fetch failed/i.test(msg)) throw err;
      await new Promise((r) => setTimeout(r, 1000 * 2 ** i));
    }
  }
  throw lastError;
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}
