import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { stripe, appUrl } from "@/lib/stripe";

export const runtime = "nodejs";

/** Opens the Stripe customer portal for managing/cancelling subscriptions. */
export async function POST() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!user.stripeCustomerId) {
    return NextResponse.json({ error: "No billing account yet" }, { status: 400 });
  }
  const session = await stripe().billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: `${appUrl()}/dashboard`,
  });
  return NextResponse.json({ url: session.url });
}
