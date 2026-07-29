import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireTeamRole, isPlatformAdmin, authErrorResponse } from "@/lib/rbac";

export const runtime = "nodejs";

/**
 * List generations, newest first, with optional filters.
 * Scopes:
 *  - default          → the caller's own generations (personal + team)
 *  - ?teamId=…        → a team's feed (members and platform admins only)
 *  - ?scope=all       → every generation on the platform (platform admins only)
 */
export async function GET(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const model = url.searchParams.get("model");
  const teamId = url.searchParams.get("teamId");
  const scope = url.searchParams.get("scope");
  const take = Math.min(Number(url.searchParams.get("take") ?? 30), 100);
  const cursor = url.searchParams.get("cursor");

  let ownerFilter: Record<string, unknown>;
  if (scope === "all") {
    if (!isPlatformAdmin(user)) {
      return NextResponse.json({ error: "Platform admin access required" }, { status: 403 });
    }
    ownerFilter = {};
  } else if (teamId) {
    try {
      await requireTeamRole(user, teamId, "MEMBER");
    } catch (err) {
      const authErr = authErrorResponse(err);
      if (authErr) return NextResponse.json({ error: authErr.error }, { status: authErr.status });
      throw err;
    }
    ownerFilter = { teamId };
  } else {
    ownerFilter = { userId: user.id };
  }

  const generations = await prisma.generation.findMany({
    where: {
      ...ownerFilter,
      ...(status ? { status: status as never } : {}),
      ...(model ? { model } : {}),
    },
    include: { user: { select: { name: true, email: true } } },
    orderBy: { createdAt: "desc" },
    take: take + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore = generations.length > take;
  const items = hasMore ? generations.slice(0, take) : generations;
  return NextResponse.json({
    items,
    nextCursor: hasMore ? items[items.length - 1].id : null,
  });
}
