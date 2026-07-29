/**
 * New-account onboarding grants.
 *
 * Plain JS with the Prisma client injected, so the exact same code runs in
 * the NextAuth createUser event (lib/auth.ts) AND in the signup smoke test
 * (scripts/smoke-signup-access.mjs) — the test exercises production logic,
 * not a copy of it.
 *
 * WELCOME_CREDITS is sized so a brand-new account can afford at least one
 * run of EVERY model in the catalog on day one (the most expensive minimum
 * config is Seedance 2.0 at 4s/720p = 28 credits; welcome 25 + daily 4 = 29).
 * The smoke test asserts this stays true as models or prices change. Note:
 * redeemed on Seedance, a signup costs up to ~$1.25 of provider spend —
 * deliberate acquisition cost; shrink it here if that's too generous.
 */

export const WELCOME_CREDITS = 25;
// Keep in sync with the FREE plan's dailyFreeCredits in lib/plans.ts.
export const FREE_DAILY_CREDITS = 4;

/**
 * Apply first-signup grants to a freshly created user row.
 * @param {import("@prisma/client").PrismaClient} prisma
 * @param {{ id: string, platformAdmin?: boolean }} opts
 */
export async function initializeNewUser(prisma, { id, platformAdmin = false }) {
  return prisma.user.update({
    where: { id },
    data: {
      platformRole: platformAdmin ? "PLATFORM_ADMIN" : "USER",
      credits: { increment: WELCOME_CREDITS },
      dailyCredits: FREE_DAILY_CREDITS,
      dailyCreditsResetAt: new Date(),
      creditTransactions: {
        create: [
          {
            type: "WELCOME_GRANT",
            amount: WELCOME_CREDITS,
            balanceAfter: WELCOME_CREDITS,
            note: "Welcome bonus — try every model",
          },
          {
            type: "DAILY_GRANT",
            amount: FREE_DAILY_CREDITS,
            balanceAfter: WELCOME_CREDITS + FREE_DAILY_CREDITS,
            note: "Daily free credits",
          },
        ],
      },
    },
  });
}
