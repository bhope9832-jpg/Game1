import { currentUser } from "@/lib/auth";
import { PricingCards } from "@/components/pricing-cards";

export const metadata = { title: "Pricing" };
export const dynamic = "force-dynamic";

export default async function PricingPage() {
  const user = await currentUser();

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <div className="mb-10 text-center">
        <h1 className="text-3xl font-semibold">Simple, credit-based pricing</h1>
        <p className="mt-3 text-muted-foreground">
          One credit ≈ one short 480p video. Longer clips and 720p cost more. Failed generations
          are always refunded.
        </p>
      </div>
      <PricingCards currentPlan={user?.plan ?? "FREE"} signedIn={Boolean(user)} />
    </div>
  );
}
