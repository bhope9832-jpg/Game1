import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { refreshDailyCredits, totalBalance } from "@/lib/credits";
import { isPlatformAdmin } from "@/lib/rbac";

export const runtime = "nodejs";

/**
 * The UI's identity + wallet endpoint: personal balance, platform role, and
 * every team the user belongs to (with each team's shared pool balance) so
 * the studio can offer a workspace switcher.
 */
export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const refreshed = await refreshDailyCredits(user);

  const memberships = await prisma.teamMembership.findMany({
    where: { userId: user.id },
    include: { team: { select: { id: true, name: true, slug: true, credits: true } } },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({
    credits: totalBalance(refreshed),
    paidCredits: refreshed.credits,
    dailyCredits: refreshed.dailyCredits,
    plan: refreshed.plan,
    platformAdmin: isPlatformAdmin(refreshed),
    teams: memberships.map((m) => ({
      id: m.team.id,
      name: m.team.name,
      slug: m.team.slug,
      credits: m.team.credits,
      role: m.role,
    })),
  });
}
