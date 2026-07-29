import Stripe from "stripe";

let client: Stripe | null = null;

/** Lazily constructed so builds succeed without secrets present. */
export function stripe(): Stripe {
  if (!client) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
    client = new Stripe(key, { apiVersion: "2025-02-24.acacia" });
  }
  return client;
}

export function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}
