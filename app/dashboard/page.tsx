import { redirect } from "next/navigation";
import { Coins, CalendarClock, Film } from "lucide-react";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { refreshDailyCredits, totalBalance } from "@/lib/credits";
import { planConfig } from "@/lib/plans";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { HistoryGallery } from "@/components/history-gallery";
import { BillingButtons } from "@/components/billing-buttons";

export const metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const userRaw = await currentUser();
  if (!userRaw) redirect("/signin?callbackUrl=/dashboard");
  const user = await refreshDailyCredits(userRaw);
  const plan = planConfig(user.plan);

  const [generationCount, recentTransactions] = await Promise.all([
    prisma.generation.count({ where: { userId: user.id } }),
    prisma.creditTransaction.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
  ]);

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">{user.email}</p>
        </div>
        <BillingButtons hasBilling={Boolean(user.stripeCustomerId)} />
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Coins className="h-4 w-4 text-amber-400" /> Credits
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{totalBalance(user)}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {user.dailyCredits} daily free · {user.credits} purchased
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <CalendarClock className="h-4 w-4 text-primary" /> Plan
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{plan.name}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {user.planRenewsAt
                ? `Renews ${user.planRenewsAt.toLocaleDateString()}`
                : "Pay as you go"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Film className="h-4 w-4 text-emerald-400" /> Videos generated
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{generationCount}</p>
            <p className="mt-1 text-xs text-muted-foreground">across all models</p>
          </CardContent>
        </Card>
      </div>

      {/* History */}
      <section className="space-y-4">
        <h2 className="text-lg font-medium">Generation history</h2>
        <HistoryGallery />
      </section>

      {/* Credit activity */}
      <section className="space-y-4">
        <h2 className="text-lg font-medium">Credit activity</h2>
        <Card>
          <CardContent className="divide-y p-0">
            {recentTransactions.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">No activity yet.</p>
            ) : (
              recentTransactions.map((tx) => (
                <div key={tx.id} className="flex items-center justify-between px-6 py-3 text-sm">
                  <div className="flex items-center gap-3">
                    <Badge variant={tx.amount >= 0 ? "success" : "secondary"}>
                      {tx.amount >= 0 ? `+${tx.amount}` : tx.amount}
                    </Badge>
                    <span className="text-muted-foreground">
                      {tx.note ?? tx.type.replaceAll("_", " ").toLowerCase()}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {tx.createdAt.toLocaleDateString()}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
