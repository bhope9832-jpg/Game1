/**
 * New-account onboarding.
 *
 * Plain JS with the Prisma client injected, so the exact same code runs in
 * the NextAuth createUser event (lib/auth.ts) AND in the signup smoke test
 * (scripts/smoke-signup-access.mjs) — the test exercises production logic,
 * not a copy of it.
 *
 * Policy: no free generation credits. Every model is visible and selectable
 * from day one with its exact credit price, but generating requires
 * purchased credits (packs or a subscription) — the site never funds free
 * generations out of its own provider budget. To reintroduce a promo, raise
 * WELCOME_CREDITS here; everything downstream adapts.
 */

export const WELCOME_CREDITS = 0;
// Keep in sync with the FREE plan's dailyFreeCredits in lib/plans.ts.
export const FREE_DAILY_CREDITS = 0;

/**
 * Apply first-signup setup to a freshly created user row.
 * @param {import("@prisma/client").PrismaClient} prisma
 * @param {{ id: string, platformAdmin?: boolean }} opts
 */
export async function initializeNewUser(prisma, { id, platformAdmin = false }) {
  const grants = [];
  if (WELCOME_CREDITS > 0) {
    grants.push({
      type: "WELCOME_GRANT",
      amount: WELCOME_CREDITS,
      balanceAfter: WELCOME_CREDITS,
      note: "Welcome bonus",
    });
  }
  if (FREE_DAILY_CREDITS > 0) {
    grants.push({
      type: "DAILY_GRANT",
      amount: FREE_DAILY_CREDITS,
      balanceAfter: WELCOME_CREDITS + FREE_DAILY_CREDITS,
      note: "Daily free credits",
    });
  }
  return prisma.user.update({
    where: { id },
    data: {
      platformRole: platformAdmin ? "PLATFORM_ADMIN" : "USER",
      credits: { increment: WELCOME_CREDITS },
      dailyCredits: FREE_DAILY_CREDITS,
      dailyCreditsResetAt: new Date(),
      ...(grants.length > 0 ? { creditTransactions: { create: grants } } : {}),
    },
  });
}
