import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { refreshDailyCredits, totalBalance } from "@/lib/credits";

export const runtime = "nodejs";

/** Lightweight endpoint the UI polls for the live credit balance. */
export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const refreshed = await refreshDailyCredits(user);
  return NextResponse.json({
    credits: totalBalance(refreshed),
    paidCredits: refreshed.credits,
    dailyCredits: refreshed.dailyCredits,
    plan: refreshed.plan,
  });
}
