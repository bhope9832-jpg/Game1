/**
 * End-to-end smoke test of the signup + model-access policy:
 *   - New accounts see EVERY model with exact credit pricing, but start with
 *     ZERO credits — the site never funds free generations.
 *   - Purchased credits unlock every model in the catalog.
 *
 * Against a running dev server (npm run dev) with the local database:
 *  1. Creates a fresh user through the REAL onboarding path
 *     (lib/onboarding.js — the same code the NextAuth createUser event runs).
 *  2. Signs them in by inserting a session row and using its cookie.
 *  3. Asserts the starting balance is 0 and the account is not unlimited.
 *  4. Fetches /api/models and asserts every model is listed with a price.
 *  5. Submits a generation per model and asserts each is rejected with 402
 *     INSUFFICIENT_CREDITS — proving no free provider spend is possible.
 *  6. Grants credits (mirroring a credit-pack purchase), re-submits per
 *     model, and asserts access is granted: HTTP 200 (queued) or 502
 *     (provider unreachable locally — still past auth/access/credit checks).
 *  7. Verifies failed submissions were fully refunded.
 *
 * Usage: node --env-file=.env scripts/smoke-signup-access.mjs
 */
import { PrismaClient } from "@prisma/client";
import { initializeNewUser, WELCOME_CREDITS, FREE_DAILY_CREDITS } from "../lib/onboarding.js";

const BASE = process.env.SMOKE_BASE_URL ?? "http://localhost:3000";
const PURCHASED_CREDITS = 160; // small credit pack
const prisma = new PrismaClient();

let failures = 0;
const check = (ok, label) => {
  console.log(`${ok ? "  ✓" : "  ✗ FAIL"} ${label}`);
  if (!ok) failures++;
};

// --- 1–2. Fresh signup + session -----------------------------------------
const email = `smoke-${Date.now()}@example.test`;
const user = await prisma.user.create({ data: { email, name: "Smoke Test" } });
await initializeNewUser(prisma, { id: user.id });
const token = `smoke-${Date.now()}-${Math.random().toString(36).slice(2)}`;
await prisma.session.create({
  data: { sessionToken: token, userId: user.id, expires: new Date(Date.now() + 3600_000) },
});
const headers = { Cookie: `authjs.session-token=${token}`, "Content-Type": "application/json" };
console.log(`\nCreated fresh user ${email}`);

const generateBody = (m) => {
  const resolution = m.resolutions.includes("480p") ? "480p" : m.resolutions[0];
  return JSON.stringify({
    mode: m.modes[0],
    model: m.id,
    prompt: "Smoke test: a calm ocean at sunrise, gentle waves",
    duration: Math.min(...m.durations),
    aspectRatio: m.aspectRatios[0],
    resolution,
    ...(m.modes[0] === "image-to-video" ? { imageUrl: "https://example.com/frame.png" } : {}),
  });
};

try {
  // --- 3. Zero starting balance -------------------------------------------
  const expected = WELCOME_CREDITS + FREE_DAILY_CREDITS;
  const me = await (await fetch(`${BASE}/api/me`, { headers })).json();
  console.log(`\nStarting balance: ${me.credits} credits (policy expects ${expected})`);
  check(expected === 0, "policy: no free generation credits configured");
  check(me.credits === 0, "new account starts with 0 credits");
  check(me.unlimited === false, "new account is NOT unlimited (owner-only entitlement)");

  // --- 4. Full catalog visible --------------------------------------------
  const { models } = await (await fetch(`${BASE}/api/models`)).json();
  console.log(`\nCatalog: ${models.length} models visible to the new account`);
  for (const m of models) {
    check(m.minCost > 0, `${m.name}: listed with pricing (from ${m.minCost} credits)`);
  }

  // --- 5. No free spend possible ------------------------------------------
  console.log(`\nWithout purchased credits, every generation must be rejected:`);
  for (const m of models) {
    const res = await fetch(`${BASE}/api/generate`, { method: "POST", headers, body: generateBody(m) });
    const body = await res.json().catch(() => ({}));
    check(
      res.status === 402 && body.code === "INSUFFICIENT_CREDITS",
      `${m.name}: rejected with 402 INSUFFICIENT_CREDITS (got ${res.status})`,
    );
  }

  // --- 6. Purchased credits unlock every model ----------------------------
  // Mirrors credit-pack fulfillment (grantCredits in the Stripe webhook).
  await prisma.user.update({ where: { id: user.id }, data: { credits: PURCHASED_CREDITS } });
  console.log(`\nAfter buying ${PURCHASED_CREDITS} credits, every model must be accessible:`);
  for (const m of models) {
    const res = await fetch(`${BASE}/api/generate`, { method: "POST", headers, body: generateBody(m) });
    const body = await res.json().catch(() => ({}));
    const accessGranted = res.status === 200 || res.status === 502;
    check(
      accessGranted,
      `${m.name}: access granted (HTTP ${res.status}${accessGranted ? "" : ` — ${body.error ?? "?"}`})`,
    );
  }

  // --- 7. Refunds left the balance intact ---------------------------------
  const after = await (await fetch(`${BASE}/api/me`, { headers })).json();
  console.log(`\nBalance after runs: ${after.credits} credits`);
  const stillPending = await prisma.generation.count({
    where: { userId: user.id, status: { notIn: ["FAILED"] }, creditsUsed: { gt: 0 } },
  });
  check(after.credits === PURCHASED_CREDITS || stillPending > 0, "failed submissions were fully refunded");
} finally {
  await prisma.user.delete({ where: { id: user.id } });
  await prisma.$disconnect();
}

console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
