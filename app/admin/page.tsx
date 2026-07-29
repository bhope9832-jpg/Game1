import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Admin" };
export const dynamic = "force-dynamic";

/** Minimal admin overview: usage stats, newest users, recent generations. */
export default async function AdminPage() {
  const user = await currentUser();
  if (!user) redirect("/signin?callbackUrl=/admin");
  if (!user.isAdmin) redirect("/dashboard");

  const [userCount, generationCount, completedCount, failedCount, creditsSpent, users, generations] =
    await Promise.all([
      prisma.user.count(),
      prisma.generation.count(),
      prisma.generation.count({ where: { status: "COMPLETED" } }),
      prisma.generation.count({ where: { status: "FAILED" } }),
      prisma.creditTransaction.aggregate({
        where: { type: "GENERATION" },
        _sum: { amount: true },
      }),
      prisma.user.findMany({ orderBy: { createdAt: "desc" }, take: 15 }),
      prisma.generation.findMany({
        orderBy: { createdAt: "desc" },
        take: 15,
        include: { user: { select: { email: true } } },
      }),
    ]);

  const stats = [
    { label: "Users", value: userCount },
    { label: "Generations", value: generationCount },
    { label: "Completed", value: completedCount },
    { label: "Failed", value: failedCount },
    { label: "Credits spent", value: Math.abs(creditsSpent._sum.amount ?? 0) },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-semibold">Admin</h1>

      <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="p-5">
              <p className="text-sm text-muted-foreground">{s.label}</p>
              <p className="mt-1 text-2xl font-semibold">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Newest users</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="px-6 py-2 font-medium">Email</th>
                <th className="px-6 py-2 font-medium">Plan</th>
                <th className="px-6 py-2 font-medium">Credits</th>
                <th className="px-6 py-2 font-medium">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="px-6 py-2.5">{u.email}</td>
                  <td className="px-6 py-2.5">
                    <Badge variant="secondary">{u.plan}</Badge>
                  </td>
                  <td className="px-6 py-2.5">{u.credits + u.dailyCredits}</td>
                  <td className="px-6 py-2.5 text-muted-foreground">{formatDate(u.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent generations</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="px-6 py-2 font-medium">User</th>
                <th className="px-6 py-2 font-medium">Prompt</th>
                <th className="px-6 py-2 font-medium">Model</th>
                <th className="px-6 py-2 font-medium">Status</th>
                <th className="px-6 py-2 font-medium">Credits</th>
                <th className="px-6 py-2 font-medium">When</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {generations.map((g) => (
                <tr key={g.id}>
                  <td className="px-6 py-2.5 text-muted-foreground">{g.user.email}</td>
                  <td className="max-w-xs truncate px-6 py-2.5">{g.prompt}</td>
                  <td className="px-6 py-2.5">{g.model}</td>
                  <td className="px-6 py-2.5">
                    <Badge
                      variant={
                        g.status === "COMPLETED"
                          ? "success"
                          : g.status === "FAILED"
                            ? "destructive"
                            : "warning"
                      }
                    >
                      {g.status.toLowerCase()}
                    </Badge>
                  </td>
                  <td className="px-6 py-2.5">{g.creditsUsed}</td>
                  <td className="px-6 py-2.5 text-muted-foreground">{formatDate(g.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
