import { prisma } from "@/lib/prisma";
import { planConfig } from "@/lib/plans";
import type { User } from "@prisma/client";

/**
 * Credit accounting for two wallet kinds:
 *  - Personal: `User.credits` (paid, never expires) + `User.dailyCredits`
 *    (free allowance, refreshed lazily each UTC day).
 *  - Team: `Team.credits`, a shared pool spent by team-context generations.
 * Every movement writes a CreditTransaction (userId = acting user, teamId set
 * when a team pool was affected).
 */

export async function refreshDailyCredits(user: User): Promise<User> {
  const allowance = planConfig(user.plan).dailyFreeCredits;
  const last = user.dailyCreditsResetAt;
  const now = new Date();
  const sameUtcDay =
    last.getUTCFullYear() === now.getUTCFullYear() &&
    last.getUTCMonth() === now.getUTCMonth() &&
    last.getUTCDate() === now.getUTCDate();
  if (sameUtcDay || user.dailyCredits >= allowance) return user;

  const granted = allowance - user.dailyCredits;
  return prisma.user.update({
    where: { id: user.id },
    data: {
      dailyCredits: allowance,
      dailyCreditsResetAt: now,
      creditTransactions: {
        create: {
          type: "DAILY_GRANT",
          amount: granted,
          balanceAfter: user.credits + allowance,
          note: "Daily free credits",
        },
      },
    },
  });
}

export function totalBalance(user: User): number {
  return user.credits + user.dailyCredits;
}

export class InsufficientCreditsError extends Error {
  constructor() {
    super("Insufficient credits");
    this.name = "InsufficientCreditsError";
  }
}

/**
 * Atomically deduct credits for a generation.
 * Personal context spends the free daily bucket first, then paid credits.
 * Team context spends the team's shared pool only. Conditional updates inside
 * the transaction guard against concurrent double-spends.
 */
export async function deductCredits(opts: {
  userId: string;
  teamId?: string | null;
  amount: number;
  generationId: string;
}) {
  const { userId, teamId, amount, generationId } = opts;
  return prisma.$transaction(async (tx) => {
    if (teamId) {
      const updated = await tx.team.updateMany({
        where: { id: teamId, credits: { gte: amount } },
        data: { credits: { decrement: amount } },
      });
      if (updated.count === 0) throw new InsufficientCreditsError();
      const team = await tx.team.findUniqueOrThrow({ where: { id: teamId } });
      await tx.creditTransaction.create({
        data: {
          userId,
          teamId,
          type: "GENERATION",
          amount: -amount,
          balanceAfter: team.credits,
          generationId,
        },
      });
      return;
    }

    const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.credits + user.dailyCredits < amount) throw new InsufficientCreditsError();
    const fromDaily = Math.min(user.dailyCredits, amount);
    const fromPaid = amount - fromDaily;
    const updated = await tx.user.updateMany({
      where: { id: userId, dailyCredits: { gte: fromDaily }, credits: { gte: fromPaid } },
      data: { dailyCredits: { decrement: fromDaily }, credits: { decrement: fromPaid } },
    });
    if (updated.count === 0) throw new InsufficientCreditsError();
    await tx.creditTransaction.create({
      data: {
        userId,
        type: "GENERATION",
        amount: -amount,
        balanceAfter: user.credits + user.dailyCredits - amount,
        generationId,
      },
    });
  });
}

/**
 * Return credits when a generation fails, to whichever wallet paid for it.
 * Idempotent per generation.
 */
export async function refundCredits(generationId: string) {
  return prisma.$transaction(async (tx) => {
    const gen = await tx.generation.findUniqueOrThrow({ where: { id: generationId } });
    if (gen.creditsRefunded || gen.creditsUsed <= 0) return;
    await tx.generation.update({ where: { id: gen.id }, data: { creditsRefunded: true } });

    if (gen.teamId) {
      const team = await tx.team.update({
        where: { id: gen.teamId },
        data: { credits: { increment: gen.creditsUsed } },
      });
      await tx.creditTransaction.create({
        data: {
          userId: gen.userId,
          teamId: gen.teamId,
          type: "REFUND",
          amount: gen.creditsUsed,
          balanceAfter: team.credits,
          generationId: gen.id,
          note: "Generation failed",
        },
      });
      return;
    }

    const user = await tx.user.update({
      where: { id: gen.userId },
      data: { credits: { increment: gen.creditsUsed } },
    });
    await tx.creditTransaction.create({
      data: {
        userId: gen.userId,
        type: "REFUND",
        amount: gen.creditsUsed,
        balanceAfter: user.credits + user.dailyCredits,
        generationId: gen.id,
        note: "Generation failed",
      },
    });
  });
}

/**
 * Grant credits to a personal wallet or a team pool (billing events, admin
 * adjustments). Idempotent via stripeEventId when provided.
 */
export async function grantCredits(opts: {
  userId: string; // acting/receiving user (audit anchor for team grants)
  teamId?: string | null;
  amount: number;
  type: "PLAN_GRANT" | "PACK_PURCHASE" | "ADMIN_ADJUSTMENT";
  stripeEventId?: string;
  note?: string;
}) {
  return prisma.$transaction(async (tx) => {
    if (opts.stripeEventId) {
      const existing = await tx.creditTransaction.findUnique({
        where: { stripeEventId: opts.stripeEventId },
      });
      if (existing) return; // webhook retry — already applied
    }

    let balanceAfter: number;
    if (opts.teamId) {
      const team = await tx.team.update({
        where: { id: opts.teamId },
        data: { credits: { increment: opts.amount } },
      });
      balanceAfter = team.credits;
    } else {
      const user = await tx.user.update({
        where: { id: opts.userId },
        data: { credits: { increment: opts.amount } },
      });
      balanceAfter = user.credits + user.dailyCredits;
    }
    await tx.creditTransaction.create({
      data: {
        userId: opts.userId,
        teamId: opts.teamId ?? null,
        type: opts.type,
        amount: opts.amount,
        balanceAfter,
        stripeEventId: opts.stripeEventId,
        note: opts.note,
      },
    });
  });
}

/**
 * Move paid credits from a user's personal wallet into a team pool (how teams
 * are funded in v1 — daily free credits are not transferable).
 */
export async function transferCreditsToTeam(userId: string, teamId: string, amount: number) {
  if (amount <= 0) throw new Error("Amount must be positive");
  return prisma.$transaction(async (tx) => {
    const debited = await tx.user.updateMany({
      where: { id: userId, credits: { gte: amount } },
      data: { credits: { decrement: amount } },
    });
    if (debited.count === 0) throw new InsufficientCreditsError();
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
    const team = await tx.team.update({
      where: { id: teamId },
      data: { credits: { increment: amount } },
    });
    // Two audit rows: the debit on the personal wallet, the credit on the pool.
    await tx.creditTransaction.create({
      data: {
        userId,
        type: "TEAM_TRANSFER",
        amount: -amount,
        balanceAfter: user.credits + user.dailyCredits,
        note: `Transfer to team ${team.name}`,
      },
    });
    await tx.creditTransaction.create({
      data: {
        userId,
        teamId,
        type: "TEAM_TRANSFER",
        amount,
        balanceAfter: team.credits,
        note: "Transfer from personal wallet",
      },
    });
  });
}
