"use client";

import { useEffect, useState } from "react";
import { Coins } from "lucide-react";
import { Badge } from "@/components/ui/badge";

/**
 * Live credit balance shown in the navbar. Refreshes on mount and whenever a
 * `credits:changed` event is dispatched (fired by the studio after generating
 * or by billing flows), plus a slow background poll.
 */
export function CreditBadge() {
  const [credits, setCredits] = useState<number | null>(null);
  const [unlimited, setUnlimited] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const res = await fetch("/api/me");
        if (!res.ok) return;
        const data = await res.json();
        if (active) {
          setCredits(data.credits);
          setUnlimited(Boolean(data.unlimited));
        }
      } catch {
        /* transient network error — keep the last value */
      }
    };
    load();
    const interval = setInterval(load, 60_000);
    window.addEventListener("credits:changed", load);
    return () => {
      active = false;
      clearInterval(interval);
      window.removeEventListener("credits:changed", load);
    };
  }, []);

  if (unlimited) {
    return (
      <Badge variant="default" className="gap-1.5 py-1">
        <Coins className="h-3.5 w-3.5" />∞ Unlimited
      </Badge>
    );
  }

  return (
    <Badge variant="secondary" className="gap-1.5 py-1">
      <Coins className="h-3.5 w-3.5 text-amber-400" />
      {credits === null ? "…" : `${credits} credits`}
    </Badge>
  );
}
