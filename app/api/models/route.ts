import { NextResponse } from "next/server";
import { MODELS, creditCost, type Resolution } from "@/lib/models";
import { WELCOME_CREDITS, FREE_DAILY_CREDITS } from "@/lib/onboarding";

export const runtime = "nodejs";

/**
 * Public model catalog: capabilities plus the cheapest credit cost per model,
 * so clients (and the signup smoke test) can verify that every model is
 * within reach of a brand-new account's starting balance.
 */
export async function GET() {
  const models = MODELS.map((m) => {
    const cheapestResolution = m.resolutions.includes("480p") ? "480p" : m.resolutions[0];
    const minCost = creditCost(m, Math.min(...m.durations), cheapestResolution as Resolution);
    return {
      id: m.id,
      name: m.name,
      vendor: m.vendor,
      description: m.description,
      modes: Object.keys(m.endpoints),
      durations: m.durations,
      aspectRatios: m.aspectRatios,
      resolutions: m.resolutions,
      supportsNegativePrompt: m.supportsNegativePrompt,
      supportsSeed: m.supportsSeed,
      supportsCameraMotion: m.supportsCameraMotion,
      baseCredits: m.baseCredits,
      minCost,
      badge: m.badge ?? null,
    };
  });

  return NextResponse.json({
    models,
    newAccountCredits: WELCOME_CREDITS + FREE_DAILY_CREDITS,
  });
}
