"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PLANS, CREDIT_PACKS } from "@/lib/plans";

export function PricingCards({ currentPlan, signedIn }: { currentPlan: string; signedIn: boolean }) {
  const [loading, setLoading] = useState<string | null>(null);

  async function checkout(body: { plan?: string; pack?: string }) {
    if (!signedIn) {
      window.location.href = "/signin?callbackUrl=/pricing";
      return;
    }
    const key = body.plan ?? body.pack!;
    setLoading(key);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      window.location.href = data.url;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Checkout failed");
      setLoading(null);
    }
  }

  return (
    <div className="space-y-12">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {PLANS.map((plan) => {
          const isCurrent = plan.id === currentPlan;
          const highlight = plan.id === "PRO";
          return (
            <Card key={plan.id} className={highlight ? "border-primary" : undefined}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{plan.name}</CardTitle>
                  {highlight && <Badge>Popular</Badge>}
                </div>
                <p className="pt-2 text-3xl font-semibold">
                  ${plan.priceMonthly}
                  <span className="text-sm font-normal text-muted-foreground">/mo</span>
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" /> {f}
                    </li>
                  ))}
                </ul>
                {plan.id === "FREE" ? (
                  <Button variant="outline" className="w-full" disabled={isCurrent}>
                    {isCurrent ? "Current plan" : "Included"}
                  </Button>
                ) : (
                  <Button
                    className="w-full"
                    variant={highlight ? "default" : "secondary"}
                    disabled={isCurrent || loading !== null}
                    onClick={() => checkout({ plan: plan.id })}
                  >
                    {loading === plan.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : isCurrent ? (
                      "Current plan"
                    ) : (
                      "Subscribe"
                    )}
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div>
        <h2 className="mb-4 text-center text-xl font-semibold">One-time credit packs</h2>
        <div className="mx-auto grid max-w-2xl gap-4 sm:grid-cols-2">
          {CREDIT_PACKS.map((pack) => (
            <Card key={pack.id}>
              <CardContent className="flex items-center justify-between p-6">
                <div>
                  <p className="font-medium">{pack.name}</p>
                  <p className="text-sm text-muted-foreground">${pack.priceUsd} · never expires</p>
                </div>
                <Button
                  variant="secondary"
                  disabled={loading !== null}
                  onClick={() => checkout({ pack: pack.id })}
                >
                  {loading === pack.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Buy"}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
