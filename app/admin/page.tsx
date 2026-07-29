import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isPlatformAdmin } from "@/lib/rbac";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/utils";
import { toggleBan, togglePlatformRole, adjustUserCredits, adjustTeamCredits } from "./actions";

export const metadata = { title: "Platform Admin" };
export const dynamic = "force-dynamic";

/**
 * Platform-admin dashboard: global stats plus management of every user, team,
 * and generation. Server actions re-verify the platform role on each call.
 */
export default async function AdminPage() {
  const user = await currentUser();
  if (!user) redirect("/signin?callbackUrl=/admin");
  if (!isPlatformAdmin(user)) redirect("/dashboard");

  const [
    userCount,
    teamCount,
    generationCount,
    completedCount,
    failedCount,
    creditsSpent,
    users,
    teams,
    generations,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.team.count(),
    prisma.generation.count(),
    prisma.generation.count({ where: { status: "COMPLETED" } }),
    prisma.generation.count({ where: { status: "FAILED" } }),
    prisma.creditTransaction.aggregate({ where: { type: "GENERATION" }, _sum: { amount: true } }),
    prisma.user.findMany({ orderBy: { createdAt: "desc" }, take: 20 }),
    prisma.team.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { _count: { select: { memberships: true, generations: true } } },
    }),
    prisma.generation.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      include: {
        user: { select: { email: true } },
        team: { select: { name: true } },
      },
    }),
  ]);

  const stats = [
    { label: "Users", value: userCount },
    { label: "Teams", value: teamCount },
    { label: "Generations", value: generationCount },
    { label: "Completed", value: completedCount },
    { label: "Failed", value: failedCount },
    { label: "Credits spent", value: Math.abs(creditsSpent._sum.amount ?? 0) },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6">
      <div className="flex items-center gap-3">
        <ShieldCheck className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-semibold">Platform Admin</h1>
        <Badge>full access</Badge>
      </div>

      <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="p-5">
              <p className="text-sm text-muted-foreground">{s.label}</p>
              <p className="mt-1 text-2xl font-semibold">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Users */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Users</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="px-6 py-2 font-medium">Email</th>
                <th className="px-6 py-2 font-medium">Role</th>
                <th className="px-6 py-2 font-medium">Plan</th>
                <th className="px-6 py-2 font-medium">Credits</th>
                <th className="px-6 py-2 font-medium">Joined</th>
                <th className="px-6 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {users.map((u) => (
                <tr key={u.id} className={u.isBanned ? "opacity-50" : undefined}>
                  <td className="px-6 py-2.5">
                    {u.email}
                    {u.isBanned && (
                      <Badge variant="destructive" className="ml-2">
                        banned
                      </Badge>
                    )}
                  </td>
                  <td className="px-6 py-2.5">
                    <Badge variant={u.platformRole === "PLATFORM_ADMIN" ? "default" : "secondary"}>
                      {u.platformRole === "PLATFORM_ADMIN" ? "platform admin" : "user"}
                    </Badge>
                  </td>
                  <td className="px-6 py-2.5">{u.plan}</td>
                  <td className="px-6 py-2.5">{u.credits + u.dailyCredits}</td>
                  <td className="px-6 py-2.5 text-muted-foreground">{formatDate(u.createdAt)}</td>
                  <td className="px-6 py-2.5">
                    <div className="flex items-center gap-2">
                      <form action={adjustUserCredits} className="flex items-center gap-1">
                        <input type="hidden" name="userId" value={u.id} />
                        <Input
                          name="amount"
                          type="number"
                          placeholder="±credits"
                          className="h-7 w-24 text-xs"
                        />
                        <Button variant="secondary" size="sm" type="submit">
                          Apply
                        </Button>
                      </form>
                      {u.id !== user.id && (
                        <>
                          <form action={toggleBan}>
                            <input type="hidden" name="userId" value={u.id} />
                            <Button variant="ghost" size="sm" type="submit">
                              {u.isBanned ? "Unban" : "Ban"}
                            </Button>
                          </form>
                          <form action={togglePlatformRole}>
                            <input type="hidden" name="userId" value={u.id} />
                            <Button variant="ghost" size="sm" type="submit">
                              {u.platformRole === "PLATFORM_ADMIN" ? "Demote" : "Make admin"}
                            </Button>
                          </form>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Teams */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Teams</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="px-6 py-2 font-medium">Name</th>
                <th className="px-6 py-2 font-medium">Members</th>
                <th className="px-6 py-2 font-medium">Generations</th>
                <th className="px-6 py-2 font-medium">Pool credits</th>
                <th className="px-6 py-2 font-medium">Created</th>
                <th className="px-6 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {teams.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-6 text-center text-muted-foreground">
                    No teams yet.
                  </td>
                </tr>
              ) : (
                teams.map((t) => (
                  <tr key={t.id}>
                    <td className="px-6 py-2.5">
                      <a href={`/teams/${t.id}`} className="hover:text-primary hover:underline">
                        {t.name}
                      </a>
                    </td>
                    <td className="px-6 py-2.5">{t._count.memberships}</td>
                    <td className="px-6 py-2.5">{t._count.generations}</td>
                    <td className="px-6 py-2.5">{t.credits}</td>
                    <td className="px-6 py-2.5 text-muted-foreground">{formatDate(t.createdAt)}</td>
                    <td className="px-6 py-2.5">
                      <form action={adjustTeamCredits} className="flex items-center gap-1">
                        <input type="hidden" name="teamId" value={t.id} />
                        <Input
                          name="amount"
                          type="number"
                          placeholder="±credits"
                          className="h-7 w-24 text-xs"
                        />
                        <Button variant="secondary" size="sm" type="submit">
                          Apply
                        </Button>
                      </form>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Generations */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent generations (all users & teams)</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="px-6 py-2 font-medium">User</th>
                <th className="px-6 py-2 font-medium">Workspace</th>
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
                  <td className="px-6 py-2.5">
                    {g.team ? <Badge variant="secondary">{g.team.name}</Badge> : "Personal"}
                  </td>
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
