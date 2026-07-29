import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/** List the signed-in user's generations, newest first, with optional filters. */
export async function GET(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const model = url.searchParams.get("model");
  const take = Math.min(Number(url.searchParams.get("take") ?? 30), 100);
  const cursor = url.searchParams.get("cursor");

  const generations = await prisma.generation.findMany({
    where: {
      userId: user.id,
      ...(status ? { status: status as never } : {}),
      ...(model ? { model } : {}),
    },
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
