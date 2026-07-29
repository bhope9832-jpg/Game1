/**
 * End-to-end smoke test: can a brand-new signup use EVERY model on the site?
 *
 * Against a running dev server (npm run dev) with the local database:
 *  1. Creates a fresh user and applies the REAL signup grants
 *     (lib/onboarding.js — the same code the NextAuth createUser event runs).
 *  2. Signs them in by inserting a session row and using its cookie.
 *  3. Asserts /api/me shows the expected starting balance.
 *  4. Fetches /api/models and asserts every model's cheapest run is
 *     affordable on the starting balance.
 *  5. Submits a real /api/generate request per model at its cheapest config.
 *     Passing = the request clears auth, model access, and credit checks:
 *     HTTP 200 (submitted) or 502 (provider unreachable — no FAL_KEY locally,
 *     which still proves access was granted and shows credits are refunded).
 *  6. Verifies the balance is fully refunded after failed submissions.
 *
 * Usage: node --env-file=.env scripts/smoke-signup-access.mjs
 */
import { PrismaClient } from "@prisma/client";
import { initializeNewUser, WELCOME_CREDITS, FREE_DAILY_CREDITS } from "../lib/onboarding.js";

const BASE = process.env.SMOKE_BASE_URL ?? "http://localhost:3000";
const prisma = new PrismaClient();

let failures = 0;
const check = (ok, label) => {
  console.log(`${ok ? "  ✓" : "  ✗ FAIL"} ${label}`);
  if (!ok) failures++;
};

// --- 1. Fresh signup through the real onboarding path ---------------------
const email = `smoke-${Date.now()}@example.test`;
const user = await prisma.user.create({ data: { email, name: "Smoke Test" } });
await initializeNewUser(prisma, { id: user.id });
console.log(`\nCreated fresh user ${email}`);

// --- 2. Session cookie ----------------------------------------------------
const token = `smoke-${Date.now()}-${Math.random().toString(36).slice(2)}`;
await prisma.session.create({
  data: { sessionToken: token, userId: user.id, expires: new Date(Date.now() + 3600_000) },
});
const headers = { Cookie: `authjs.session-token=${token}`, "Content-Type": "application/json" };

try {
  // --- 3. Starting balance ------------------------------------------------
  const me = await (await fetch(`${BASE}/api/me`, { headers })).json();
  const expected = WELCOME_CREDITS + FREE_DAILY_CREDITS;
  console.log(`\nStarting balance: ${me.credits} credits (expected ${expected})`);
  check(me.credits === expected, `new account starts with ${expected} credits`);
  check(me.unlimited === false, "new account is NOT unlimited (owner-only entitlement)");

  // --- 4. Catalog affordability -------------------------------------------
  const { models, newAccountCredits } = await (await fetch(`${BASE}/api/models`)).json();
  console.log(`\nCatalog: ${models.length} models, new-account credits ${newAccountCredits}`);
  for (const m of models) {
    check(
      m.minCost <= newAccountCredits,
      `${m.name}: cheapest run ${m.minCost} credits — affordable on day one`,
    );
  }

  // --- 5. One real generation request per model ---------------------------
  console.log(`\nSubmitting a generation per model (cheapest config):`);
  for (const m of models) {
    const resolution = m.resolutions.includes("480p") ? "480p" : m.resolutions[0];
    const res = await fetch(`${BASE}/api/generate`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        mode: m.modes[0],
        model: m.id,
        prompt: "Smoke test: a calm ocean at sunrise, gentle waves",
        duration: Math.min(...m.durations),
        aspectRatio: m.aspectRatios[0],
        resolution,
        ...(m.modes[0] === "image-to-video"
          ? { imageUrl: "https://example.com/frame.png" }
          : {}),
      }),
    });
    const body = await res.json().catch(() => ({}));
    // 200 = queued; 502 = provider submit failed (no FAL_KEY locally) AFTER
    // access + credit checks passed and credits were auto-refunded.
    const accessGranted = res.status === 200 || res.status === 502;
    check(
      accessGranted,
      `${m.name}: access granted (HTTP ${res.status}${
        accessGranted ? "" : ` — ${body.error ?? "?"}`
      })`,
    );
  }

  // --- 6. Refunds left the balance intact ---------------------------------
  const after = await (await fetch(`${BASE}/api/me`, { headers })).json();
  console.log(`\nBalance after runs: ${after.credits} credits`);
  const spent = await prisma.generation.count({
    where: { userId: user.id, status: { notIn: ["FAILED"] }, creditsUsed: { gt: 0 } },
  });
  check(
    after.credits === expected || spent > 0,
    "failed submissions were fully refunded",
  );
} finally {
  // --- Cleanup ------------------------------------------------------------
  await prisma.user.delete({ where: { id: user.id } });
  await prisma.$disconnect();
}

console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
