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
 * config is MiniMax at 6s/720p = 8 credits). The smoke test asserts this
 * stays true as models are added.
 */

export const WELCOME_CREDITS = 10;
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
