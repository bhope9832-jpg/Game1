import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkGeneration } from "@/lib/fal";
import { persistVideo } from "@/lib/storage";
import { refundCredits } from "@/lib/credits";
import { canViewGeneration, canManageGeneration } from "@/lib/rbac";
import type { GenerationModeId } from "@/lib/models";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Poll endpoint. While a generation is in flight this checks the provider
 * queue, and on completion downloads + re-hosts the video before returning.
 * The client polls every few seconds until status is COMPLETED or FAILED.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  let gen = await prisma.generation.findUnique({ where: { id } });
  if (!gen || !(await canViewGeneration(user, gen))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if ((gen.status === "PENDING" || gen.status === "PROCESSING") && gen.falRequestId) {
    const mode: GenerationModeId = gen.mode === "TEXT_TO_VIDEO" ? "text-to-video" : "image-to-video";
    const state = await checkGeneration(gen.model, mode, gen.falRequestId);

    if (state.status === "IN_PROGRESS" && gen.status === "PENDING") {
      gen = await prisma.generation.update({ where: { id }, data: { status: "PROCESSING" } });
    } else if (state.status === "COMPLETED") {
      // Guard against concurrent poll requests double-finalizing.
      const claimed = await prisma.generation.updateMany({
        where: { id, status: { in: ["PENDING", "PROCESSING"] } },
        data: { status: "PROCESSING" },
      });
      if (claimed.count > 0) {
        let permanentUrl = state.videoUrl;
        try {
          permanentUrl = await persistVideo(state.videoUrl, gen.id);
        } catch {
          // Keep the provider URL rather than failing the whole generation;
          // it stays usable for a while and the record notes the raw URL.
        }
        gen = await prisma.generation.update({
          where: { id },
          data: {
            status: "COMPLETED",
            outputVideoUrl: permanentUrl,
            providerVideoUrl: state.videoUrl,
            seed: state.seed ?? gen.seed,
            completedAt: new Date(),
          },
        });
      } else {
        gen = (await prisma.generation.findUnique({ where: { id } }))!;
      }
    } else if (state.status === "FAILED") {
      gen = await prisma.generation.update({
        where: { id },
        data: { status: "FAILED", error: state.error, completedAt: new Date() },
      });
      await refundCredits(gen.id);
    }
  }

  return NextResponse.json({ generation: gen });
}

/**
 * Delete a generation from history (does not refund credits).
 * Allowed for the creator, team ADMIN/OWNER on team generations, and
 * platform admins.
 */
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const gen = await prisma.generation.findUnique({ where: { id } });
  if (!gen || !(await canViewGeneration(user, gen))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!(await canManageGeneration(user, gen))) {
    return NextResponse.json({ error: "Only the creator or a team admin can delete this" }, { status: 403 });
  }
  await prisma.generation.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
