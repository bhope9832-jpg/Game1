import { NextResponse } from "next/server";
import { z } from "zod";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireTeamRole, authErrorResponse } from "@/lib/rbac";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

function handleAuthError(err: unknown) {
  const authErr = authErrorResponse(err);
  if (authErr) return NextResponse.json({ error: authErr.error }, { status: authErr.status });
  throw err;
}

/** List members + pending invites — any team member or platform admin. */
export async function GET(_req: Request, ctx: { params: Promise<{ teamId: string }> }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { teamId } = await ctx.params;

  try {
    await requireTeamRole(user, teamId, "MEMBER");
  } catch (err) {
    return handleAuthError(err);
  }

  const [members, invites] = await Promise.all([
    prisma.teamMembership.findMany({
      where: { teamId },
      include: { user: { select: { id: true, name: true, email: true, image: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.teamInvite.findMany({ where: { teamId, expiresAt: { gt: new Date() } } }),
  ]);

  return NextResponse.json({ members, invites });
}

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(["ADMIN", "MEMBER"]).default("MEMBER"),
});

/**
 * Add someone to the team — ADMIN+ (admins may only add MEMBERs; granting the
 * ADMIN role requires OWNER). If the email already has an account they join
 * immediately; otherwise a pending invite is created and claimed on sign-up.
 */
export async function POST(req: Request, ctx: { params: Promise<{ teamId: string }> }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { teamId } = await ctx.params;

  const parsed = inviteSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid email or role" }, { status: 400 });
  const { email, role } = parsed.data;

  try {
    await requireTeamRole(user, teamId, role === "ADMIN" ? "OWNER" : "ADMIN");
  } catch (err) {
    return handleAuthError(err);
  }

  const rl = rateLimit(`invite:${user.id}`, 20, 3600);
  if (!rl.ok) return NextResponse.json({ error: "Too many invites, slow down" }, { status: 429 });

  const invitee = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (invitee) {
    const existing = await prisma.teamMembership.findUnique({
      where: { teamId_userId: { teamId, userId: invitee.id } },
    });
    if (existing) return NextResponse.json({ error: "Already a member" }, { status: 409 });
    const membership = await prisma.teamMembership.create({
      data: { teamId, userId: invitee.id, role },
    });
    return NextResponse.json({ membership }, { status: 201 });
  }

  const invite = await prisma.teamInvite.upsert({
    where: { teamId_email: { teamId, email: email.toLowerCase() } },
    create: {
      teamId,
      email: email.toLowerCase(),
      role,
      invitedById: user.id,
      expiresAt: new Date(Date.now() + 14 * 24 * 3600 * 1000),
    },
    update: { role, expiresAt: new Date(Date.now() + 14 * 24 * 3600 * 1000) },
  });
  return NextResponse.json({ invite }, { status: 201 });
}
