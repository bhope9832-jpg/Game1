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

export const PLANS: PlanConfig[] = [
  {
    id: "FREE",
    name: "Free",
    priceMonthly: 0,
    monthlyCredits: 0,
    dailyFreeCredits: 4,
    stripePriceEnv: null,
    features: ["4 free credits every day", "All models included", "480p & 720p", "Personal use"],
  },
  {
    id: "STARTER",
    name: "Starter",
    priceMonthly: 12,
    monthlyCredits: 200,
    dailyFreeCredits: 4,
    stripePriceEnv: "STRIPE_PRICE_STARTER",
    features: ["200 credits / month", "Priority queue", "Generation history forever", "Commercial use"],
  },
  {
    id: "PRO",
    name: "Pro",
    priceMonthly: 39,
    monthlyCredits: 800,
    dailyFreeCredits: 8,
    stripePriceEnv: "STRIPE_PRICE_PRO",
    features: ["800 credits / month", "Priority queue", "Early access to new models", "Commercial use"],
  },
  {
    id: "UNLIMITED",
    name: "Unlimited",
    priceMonthly: 99,
    monthlyCredits: 3000,
    dailyFreeCredits: 20,
    stripePriceEnv: "STRIPE_PRICE_UNLIMITED",
    features: ["3000 credits / month", "Highest priority", "Everything in Pro", "Dedicated support"],
  },
];

export const CREDIT_PACKS = [
  { id: "pack-small", name: "50 credits", credits: 50, priceUsd: 8, stripePriceEnv: "STRIPE_PRICE_PACK_SMALL" },
  { id: "pack-large", name: "250 credits", credits: 250, priceUsd: 29, stripePriceEnv: "STRIPE_PRICE_PACK_LARGE" },
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
