import type { Plan } from "@prisma/client";

export interface PlanConfig {
  id: Plan;
  name: string;
  priceMonthly: number; // USD, display only — Stripe prices are the source of truth
  monthlyCredits: number; // granted on each successful invoice
  dailyFreeCredits: number;
  stripePriceEnv: string | null;
  features: string[];
}

// Every plan and pack sells credits at exactly CREDIT_VALUE_USD ($0.05), so
// the per-generation margin in lib/models.ts holds on every purchase path.
// (Free/welcome/daily credits are deliberate marketing spend — they cost real
// provider dollars when redeemed and earn nothing.)
export const PLANS: PlanConfig[] = [
  {
    id: "FREE",
    name: "Free",
    priceMonthly: 0,
    monthlyCredits: 0,
    dailyFreeCredits: 4,
    stripePriceEnv: null,
    features: [
      "25 welcome credits — try every model",
      "4 free credits every day",
      "All models included",
      "Personal use",
    ],
  },
  {
    id: "STARTER",
    name: "Starter",
    priceMonthly: 12,
    monthlyCredits: 240,
    dailyFreeCredits: 4,
    stripePriceEnv: "STRIPE_PRICE_STARTER",
    features: ["240 credits / month", "≈ 7 Seedance videos or 30 Kling videos", "Generation history forever", "Commercial use"],
  },
  {
    id: "PRO",
    name: "Pro",
    priceMonthly: 39,
    monthlyCredits: 780,
    dailyFreeCredits: 8,
    stripePriceEnv: "STRIPE_PRICE_PRO",
    features: ["780 credits / month", "≈ 22 Seedance videos", "Priority queue", "Commercial use"],
  },
  {
    id: "UNLIMITED",
    name: "Studio",
    priceMonthly: 99,
    monthlyCredits: 1980,
    dailyFreeCredits: 20,
    stripePriceEnv: "STRIPE_PRICE_UNLIMITED",
    features: ["1980 credits / month", "≈ 58 Seedance videos", "Highest priority", "Dedicated support"],
  },
];

export const CREDIT_PACKS = [
  { id: "pack-small", name: "160 credits", credits: 160, priceUsd: 8, stripePriceEnv: "STRIPE_PRICE_PACK_SMALL" },
  { id: "pack-large", name: "580 credits", credits: 580, priceUsd: 29, stripePriceEnv: "STRIPE_PRICE_PACK_LARGE" },
] as const;

export function planConfig(plan: Plan): PlanConfig {
  return PLANS.find((p) => p.id === plan) ?? PLANS[0];
}

export function planForPriceId(priceId: string): PlanConfig | undefined {
  return PLANS.find((p) => p.stripePriceEnv && process.env[p.stripePriceEnv] === priceId);
}

export function packForPriceId(priceId: string) {
  return CREDIT_PACKS.find((p) => process.env[p.stripePriceEnv] === priceId);
}
