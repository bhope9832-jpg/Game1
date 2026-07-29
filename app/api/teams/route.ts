import { NextResponse } from "next/server";
import { z } from "zod";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

/** List the caller's teams (with role and member count). */
export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const memberships = await prisma.teamMembership.findMany({
    where: { userId: user.id },
    include: {
      team: { include: { _count: { select: { memberships: true } } } },
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({
    teams: memberships.map((m) => ({
      id: m.team.id,
      name: m.team.name,
      slug: m.team.slug,
      credits: m.team.credits,
      role: m.role,
      memberCount: m.team._count.memberships,
      createdAt: m.team.createdAt,
    })),
  });
}

const createSchema = z.object({ name: z.string().trim().min(2).max(60) });

/** Create a team; the creator becomes its OWNER. */
export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.isBanned) return NextResponse.json({ error: "Account suspended" }, { status: 403 });

  const rl = rateLimit(`team-create:${user.id}`, 5, 3600);
  if (!rl.ok) return NextResponse.json({ error: "Too many teams created recently" }, { status: 429 });

  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Team name must be 2–60 characters" }, { status: 400 });

  const base = parsed.data.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  const slug = `${base || "team"}-${Math.random().toString(36).slice(2, 8)}`;

  const team = await prisma.team.create({
    data: {
      name: parsed.data.name,
      slug,
      memberships: { create: { userId: user.id, role: "OWNER" } },
    },
  });

  return NextResponse.json({ team }, { status: 201 });
}
