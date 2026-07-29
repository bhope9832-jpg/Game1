"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** Transfer paid personal credits into the team pool (ADMIN+). */
export function TeamCreditsForm({ teamId }: { teamId: string }) {
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function transfer() {
    const value = Number(amount);
    if (!Number.isInteger(value) || value <= 0) {
      toast.error("Enter a whole number of credits");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/teams/${teamId}/credits`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: value }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(`Added ${value} credits to the team pool`);
      setAmount("");
      window.dispatchEvent(new Event("credits:changed"));
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Transfer failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      className="mt-3 flex items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        transfer();
      }}
    >
      <Input
        type="number"
        min={1}
        placeholder="Amount"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        className="h-8 w-28 text-sm"
      />
      <Button size="sm" type="submit" disabled={loading}>
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Top up"}
      </Button>
    </form>
  );
}
