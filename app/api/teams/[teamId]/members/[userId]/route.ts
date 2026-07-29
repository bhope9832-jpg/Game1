import { NextResponse } from "next/server";
import { z } from "zod";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireTeamRole, canManageMember, isPlatformAdmin, authErrorResponse } from "@/lib/rbac";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ teamId: string; userId: string }> };

function handleAuthError(err: unknown) {
  const authErr = authErrorResponse(err);
  if (authErr) return NextResponse.json({ error: authErr.error }, { status: authErr.status });
  throw err;
}

async function ownerCount(teamId: string): Promise<number> {
  return prisma.teamMembership.count({ where: { teamId, role: "OWNER" } });
}

const patchSchema = z.object({ role: z.enum(["OWNER", "ADMIN", "MEMBER"]) });

/** Change a member's role — OWNER (or platform admin). The last owner can't be demoted. */
export async function PATCH(req: Request, ctx: Ctx) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { teamId, userId } = await ctx.params;

  try {
    await requireTeamRole(user, teamId, "OWNER");
  } catch (err) {
    return handleAuthError(err);
  }

  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid role" }, { status: 400 });

  const target = await prisma.teamMembership.findUnique({
    where: { teamId_userId: { teamId, userId } },
  });
  if (!target) return NextResponse.json({ error: "Not a member" }, { status: 404 });

  if (target.role === "OWNER" && parsed.data.role !== "OWNER" && (await ownerCount(teamId)) <= 1) {
    return NextResponse.json({ error: "A team must keep at least one owner" }, { status: 409 });
  }

  const membership = await prisma.teamMembership.update({
    where: { teamId_userId: { teamId, userId } },
    data: { role: parsed.data.role },
  });
  return NextResponse.json({ membership });
}

/**
 * Remove a member (or leave, when userId is yourself).
 * Governed by canManageMember: OWNER removes anyone, ADMIN removes MEMBERs,
 * anyone may leave — except the last OWNER. Platform admins bypass.
 */
export async function DELETE(_req: Request, ctx: Ctx) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { teamId, userId } = await ctx.params;

  const target = await prisma.teamMembership.findUnique({
    where: { teamId_userId: { teamId, userId } },
  });
  if (!target) return NextResponse.json({ error: "Not a member" }, { status: 404 });

  const leavingSelf = userId === user.id;
  if (!leavingSelf && !isPlatformAdmin(user)) {
    try {
      const access = await requireTeamRole(user, teamId, "ADMIN");
      if (!access.membership || !canManageMember(access.membership.role, target.role)) {
        return NextResponse.json({ error: "You can't remove this member" }, { status: 403 });
      }
    } catch (err) {
      return handleAuthError(err);
    }
  }

  if (target.role === "OWNER" && (await ownerCount(teamId)) <= 1) {
    return NextResponse.json(
      { error: "Transfer ownership first — a team must keep at least one owner" },
      { status: 409 },
    );
  }

  await prisma.teamMembership.delete({ where: { teamId_userId: { teamId, userId } } });
  return NextResponse.json({ ok: true });
}
