import { NextResponse } from "next/server";
import { z } from "zod";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireTeamRole, authErrorResponse } from "@/lib/rbac";

export const runtime = "nodejs";

function handleAuthError(err: unknown) {
  const authErr = authErrorResponse(err);
  if (authErr) return NextResponse.json({ error: authErr.error }, { status: authErr.status });
  throw err;
}

/** Team detail — members and platform admins. */
export async function GET(_req: Request, ctx: { params: Promise<{ teamId: string }> }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { teamId } = await ctx.params;

  try {
    const access = await requireTeamRole(user, teamId, "MEMBER");
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      include: { _count: { select: { memberships: true, generations: true } } },
    });
    if (!team) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ team, role: access.membership?.role ?? "PLATFORM_ADMIN" });
  } catch (err) {
    return handleAuthError(err);
  }
}

const patchSchema = z.object({ name: z.string().trim().min(2).max(60) });

/** Rename — team OWNER or platform admin. */
export async function PATCH(req: Request, ctx: { params: Promise<{ teamId: string }> }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { teamId } = await ctx.params;

  try {
    await requireTeamRole(user, teamId, "OWNER");
  } catch (err) {
    return handleAuthError(err);
  }

  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid name" }, { status: 400 });

  const team = await prisma.team.update({ where: { id: teamId }, data: { name: parsed.data.name } });
  return NextResponse.json({ team });
}

/** Delete the team — team OWNER or platform admin. Remaining pool credits are forfeited. */
export async function DELETE(_req: Request, ctx: { params: Promise<{ teamId: string }> }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { teamId } = await ctx.params;

  try {
    await requireTeamRole(user, teamId, "OWNER");
  } catch (err) {
    return handleAuthError(err);
  }

  await prisma.team.delete({ where: { id: teamId } });
  return NextResponse.json({ ok: true });
}
