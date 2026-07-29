import { NextResponse } from "next/server";
import { z } from "zod";
import { currentUser } from "@/lib/auth";
import { transferCreditsToTeam, InsufficientCreditsError } from "@/lib/credits";
import { requireTeamRole, authErrorResponse } from "@/lib/rbac";

export const runtime = "nodejs";

const bodySchema = z.object({ amount: z.number().int().min(1).max(100_000) });

/**
 * Fund the team pool by transferring paid credits from the caller's personal
 * wallet — team ADMIN+ (daily free credits are not transferable).
 */
export async function POST(req: Request, ctx: { params: Promise<{ teamId: string }> }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { teamId } = await ctx.params;

  try {
    await requireTeamRole(user, teamId, "ADMIN");
  } catch (err) {
    const authErr = authErrorResponse(err);
    if (authErr) return NextResponse.json({ error: authErr.error }, { status: authErr.status });
    throw err;
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid amount" }, { status: 400 });

  try {
    await transferCreditsToTeam(user.id, teamId, parsed.data.amount);
  } catch (err) {
    if (err instanceof InsufficientCreditsError) {
      return NextResponse.json(
        { error: "Not enough paid credits in your personal wallet (daily free credits can't be transferred)" },
        { status: 402 },
      );
    }
    throw err;
  }
  return NextResponse.json({ ok: true });
}
