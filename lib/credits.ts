import { prisma } from "@/lib/prisma";
import { planConfig } from "@/lib/plans";
import type { User } from "@prisma/client";

/**
 * Lazily refresh the free daily allowance. Called before any balance check so
 * we never need a cron job: if a UTC day has passed since the last reset, top
 * the daily bucket back up to the plan's allowance.
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

/**
 * Atomically deduct credits for a generation, spending the free daily bucket
 * first. Throws if the balance is insufficient (guarded by a conditional
 * update so concurrent requests can't double-spend).
 */
export async function deductCredits(userId: string, amount: number, generationId: string) {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.credits + user.dailyCredits < amount) {
      throw new InsufficientCreditsError();
    }
    const fromDaily = Math.min(user.dailyCredits, amount);
    const fromPaid = amount - fromDaily;
    const updated = await tx.user.updateMany({
      // Conditions re-checked inside the transaction guard against races.
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

/** Return credits when a generation fails. Idempotent per generation. */
export async function refundCredits(generationId: string) {
  return prisma.$transaction(async (tx) => {
    const gen = await tx.generation.findUniqueOrThrow({ where: { id: generationId } });
    if (gen.creditsRefunded || gen.creditsUsed <= 0) return;
    await tx.generation.update({ where: { id: gen.id }, data: { creditsRefunded: true } });
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

/** Grant credits from billing events. Idempotent via stripeEventId. */
export async function grantCredits(opts: {
  userId: string;
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
    const user = await tx.user.update({
      where: { id: opts.userId },
      data: { credits: { increment: opts.amount } },
    });
    await tx.creditTransaction.create({
      data: {
        userId: opts.userId,
        type: opts.type,
        amount: opts.amount,
        balanceAfter: user.credits + user.dailyCredits,
        stripeEventId: opts.stripeEventId,
        note: opts.note,
      },
    });
  });
}

export class InsufficientCreditsError extends Error {
  constructor() {
    super("Insufficient credits");
    this.name = "InsufficientCreditsError";
  }
}
