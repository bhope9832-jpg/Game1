import { NextResponse } from "next/server";
import { z } from "zod";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getModel, creditCost, type GenerationModeId, type Resolution } from "@/lib/models";
import { moderatePrompt } from "@/lib/moderation";
import { rateLimit } from "@/lib/rate-limit";
import { refreshDailyCredits, deductCredits, totalBalance, InsufficientCreditsError } from "@/lib/credits";
import { submitGeneration } from "@/lib/fal";
import { refundCredits } from "@/lib/credits";
import { requireTeamRole, authErrorResponse, hasUnlimitedAccess } from "@/lib/rbac";

export const runtime = "nodejs";
export const maxDuration = 60;

const bodySchema = z.object({
  // Workspace context: omit for personal, set to spend a team's credit pool.
  teamId: z.string().cuid().optional(),
  mode: z.enum(["text-to-video", "image-to-video"]),
  model: z.string().min(1),
  prompt: z.string().min(3).max(2000),
  negativePrompt: z.string().max(1000).optional(),
  imageUrl: z.string().url().optional(),
  duration: z.number().int().min(1).max(30),
  aspectRatio: z.enum(["16:9", "9:16", "1:1", "4:3", "21:9"]),
  resolution: z.enum(["480p", "720p"]),
  seed: z.number().int().min(0).max(2 ** 31 - 1).optional(),
  cameraMotion: z.string().max(40).optional(),
});

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Sign in to generate videos" }, { status: 401 });
  if (user.isBanned) return NextResponse.json({ error: "Account suspended" }, { status: 403 });

  // Abuse protection: cap submissions per user.
  const rl = rateLimit(`generate:${user.id}`, 10, 60);
  if (!rl.ok) {
    return NextResponse.json(
      { error: `Too many requests. Try again in ${rl.retryAfterSeconds}s.` },
      { status: 429 },
    );
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", details: parsed.error.flatten() }, { status: 400 });
  }
  const body = parsed.data;

  // Validate model + options against the catalog (never trust client pricing).
  const model = getModel(body.model);
  const mode = body.mode as GenerationModeId;
  if (!model || !model.endpoints[mode]) {
    return NextResponse.json({ error: "Unknown model or unsupported mode" }, { status: 400 });
  }
  if (!model.durations.includes(body.duration)) {
    return NextResponse.json({ error: "Duration not supported by this model" }, { status: 400 });
  }
  if (!model.aspectRatios.includes(body.aspectRatio)) {
    return NextResponse.json({ error: "Aspect ratio not supported by this model" }, { status: 400 });
  }
  if (!model.resolutions.includes(body.resolution as Resolution)) {
    return NextResponse.json({ error: "Resolution not supported by this model" }, { status: 400 });
  }
  if (mode === "image-to-video" && !body.imageUrl) {
    return NextResponse.json({ error: "Image is required for image-to-video" }, { status: 400 });
  }

  const moderation = moderatePrompt(body.prompt, body.negativePrompt);
  if (!moderation.allowed) {
    return NextResponse.json({ error: moderation.reason }, { status: 422 });
  }

  // Team context: any member (or a platform admin) may spend the team pool.
  if (body.teamId) {
    try {
      await requireTeamRole(user, body.teamId, "MEMBER");
    } catch (err) {
      const authErr = authErrorResponse(err);
      if (authErr) return NextResponse.json({ error: authErr.error }, { status: authErr.status });
      throw err;
    }
  }

  // Unlimited accounts generate free of charge in any workspace.
  const unlimited = hasUnlimitedAccess(user);
  const cost = unlimited ? 0 : creditCost(model, body.duration, body.resolution as Resolution);
  if (!unlimited) {
    if (body.teamId) {
      const team = await prisma.team.findUnique({ where: { id: body.teamId } });
      if (!team) return NextResponse.json({ error: "Team not found" }, { status: 404 });
      if (team.credits < cost) {
        return NextResponse.json(
          { error: `The team pool has ${team.credits} credits but this needs ${cost}. Ask an owner to top it up.`, code: "INSUFFICIENT_CREDITS" },
          { status: 402 },
        );
      }
    } else {
      const refreshed = await refreshDailyCredits(user);
      if (totalBalance(refreshed) < cost) {
        return NextResponse.json(
          { error: `Not enough credits (need ${cost}). Upgrade or buy a credit pack.`, code: "INSUFFICIENT_CREDITS" },
          { status: 402 },
        );
      }
    }
  }

  // Create the record first so the deduction has an audit anchor. Credits are
  // reserved up front and automatically refunded if the generation fails, so
  // users only ever pay for successful videos.
  const generation = await prisma.generation.create({
    data: {
      userId: user.id,
      teamId: body.teamId,
      mode: mode === "text-to-video" ? "TEXT_TO_VIDEO" : "IMAGE_TO_VIDEO",
      model: model.id,
      prompt: body.prompt,
      negativePrompt: body.negativePrompt,
      inputImageUrl: body.imageUrl,
      duration: body.duration,
      aspectRatio: body.aspectRatio,
      resolution: body.resolution,
      seed: body.seed,
      cameraMotion: body.cameraMotion,
      creditsUsed: cost,
      status: "PENDING",
    },
  });

  if (!unlimited) {
    try {
      await deductCredits({ userId: user.id, teamId: body.teamId, amount: cost, generationId: generation.id });
    } catch (err) {
      await prisma.generation.delete({ where: { id: generation.id } });
      if (err instanceof InsufficientCreditsError) {
        return NextResponse.json({ error: "Not enough credits", code: "INSUFFICIENT_CREDITS" }, { status: 402 });
      }
      throw err;
    }
  }

  try {
    const requestId = await submitGeneration({
      modelId: model.id,
      mode,
      prompt: body.prompt,
      negativePrompt: body.negativePrompt,
      imageUrl: body.imageUrl,
      duration: body.duration,
      aspectRatio: body.aspectRatio,
      resolution: body.resolution,
      seed: body.seed,
      cameraMotion: body.cameraMotion,
    });
    await prisma.generation.update({
      where: { id: generation.id },
      data: { falRequestId: requestId },
    });
  } catch (err) {
    // Submission itself failed — mark failed and give the credits back.
    await prisma.generation.update({
      where: { id: generation.id },
      data: { status: "FAILED", error: err instanceof Error ? err.message : "Submission failed" },
    });
    await refundCredits(generation.id);
    return NextResponse.json({ error: "The model provider rejected the request. You have not been charged." }, { status: 502 });
  }

  return NextResponse.json({ id: generation.id, status: "PENDING", creditsUsed: cost });
}
