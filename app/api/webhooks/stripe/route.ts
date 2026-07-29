import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { grantCredits } from "@/lib/credits";
import { planForPriceId, packForPriceId } from "@/lib/plans";

export const runtime = "nodejs";

/**
 * Stripe webhook. Handles:
 *  - checkout.session.completed  → credit pack fulfillment (one-time payments)
 *  - invoice.paid                → monthly plan credit grants (incl. renewals)
 *  - customer.subscription.updated/deleted → keep plan state in sync
 * All grants are idempotent via the Stripe event id.
 */
export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });

  const signature = req.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Missing signature" }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(await req.text(), signature, secret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      if (session.mode !== "payment") break; // subscriptions are granted on invoice.paid
      const userId = session.metadata?.userId;
      if (!userId) break;
      const line = (
        await stripe().checkout.sessions.listLineItems(session.id, { limit: 1 })
      ).data[0];
      const priceId = line?.price?.id;
      const pack = priceId ? packForPriceId(priceId) : undefined;
      if (pack) {
        await grantCredits({
          userId,
          amount: pack.credits,
          type: "PACK_PURCHASE",
          stripeEventId: event.id,
          note: `${pack.name} pack`,
        });
      }
      break;
    }

    case "invoice.paid": {
      const invoice = event.data.object;
      const priceId = invoice.lines.data[0]?.price?.id;
      const plan = priceId ? planForPriceId(priceId) : undefined;
      const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
      if (!plan || !customerId) break;
      const user = await prisma.user.findUnique({ where: { stripeCustomerId: customerId } });
      if (!user) break;
      await grantCredits({
        userId: user.id,
        amount: plan.monthlyCredits,
        type: "PLAN_GRANT",
        stripeEventId: event.id,
        note: `${plan.name} monthly credits`,
      });
      break;
    }

    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const sub = event.data.object;
      const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
      const priceId = sub.items.data[0]?.price?.id;
      const plan = priceId ? planForPriceId(priceId) : undefined;
      const active = sub.status === "active" || sub.status === "trialing";
      await prisma.user.updateMany({
        where: { stripeCustomerId: customerId },
        data: {
          plan: active && plan ? plan.id : "FREE",
          stripeSubscriptionId: sub.id,
          stripePriceId: priceId,
          planRenewsAt: sub.current_period_end ? new Date(sub.current_period_end * 1000) : null,
        },
      });
      break;
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object;
      const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
      await prisma.user.updateMany({
        where: { stripeCustomerId: customerId },
        data: { plan: "FREE", stripeSubscriptionId: null, stripePriceId: null, planRenewsAt: null },
      });
      break;
    }
  }

  return NextResponse.json({ received: true });
}
