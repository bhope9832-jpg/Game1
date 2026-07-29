"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Opens the Stripe customer portal / pricing page from the dashboard. */
export function BillingButtons({ hasBilling }: { hasBilling: boolean }) {
  const [loading, setLoading] = useState(false);

  async function openPortal() {
    setLoading(true);
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      window.location.href = data.url;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't open billing portal");
      setLoading(false);
    }
  }

  return (
    <div className="flex gap-2">
      <Button variant="outline" size="sm">
        <a href="/pricing">Get more credits</a>
      </Button>
      {hasBilling && (
        <Button variant="secondary" size="sm" onClick={openPortal} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Manage billing"}
        </Button>
      )}
    </div>
  );
}
