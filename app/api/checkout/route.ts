import { NextResponse } from "next/server";
import { z } from "zod";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { stripe, appUrl } from "@/lib/stripe";
import { PLANS, CREDIT_PACKS } from "@/lib/plans";

export const runtime = "nodejs";

const bodySchema = z.object({
  // Either a subscription plan or a one-time credit pack.
  plan: z.enum(["STARTER", "PRO", "UNLIMITED"]).optional(),
  pack: z.enum(["pack-small", "pack-large"]).optional(),
});

/** Creates a Stripe Checkout session for a plan subscription or credit pack. */
export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success || (!parsed.data.plan && !parsed.data.pack)) {
    return NextResponse.json({ error: "Specify a plan or a pack" }, { status: 400 });
  }

  // Reuse (or create) the Stripe customer so subscriptions and packs share one.
  let customerId = user.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe().customers.create({
      email: user.email,
      metadata: { userId: user.id },
    });
    customerId = customer.id;
    await prisma.user.update({ where: { id: user.id }, data: { stripeCustomerId: customerId } });
  }

  let priceId: string | undefined;
  let mode: "subscription" | "payment";
  if (parsed.data.plan) {
    const plan = PLANS.find((p) => p.id === parsed.data.plan);
    priceId = plan?.stripePriceEnv ? process.env[plan.stripePriceEnv] : undefined;
    mode = "subscription";
  } else {
    const pack = CREDIT_PACKS.find((p) => p.id === parsed.data.pack);
    priceId = pack ? process.env[pack.stripePriceEnv] : undefined;
    mode = "payment";
  }
  if (!priceId) {
    return NextResponse.json({ error: "This product is not configured yet" }, { status: 503 });
  }

  const session = await stripe().checkout.sessions.create({
    customer: customerId,
    mode,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${appUrl()}/dashboard?checkout=success`,
    cancel_url: `${appUrl()}/pricing?checkout=cancelled`,
    metadata: { userId: user.id },
    ...(mode === "subscription" ? { subscription_data: { metadata: { userId: user.id } } } : {}),
  });

  return NextResponse.json({ url: session.url });
}
