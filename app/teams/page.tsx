import Link from "next/link";
import { redirect } from "next/navigation";
import { Users } from "lucide-react";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CreateTeamForm } from "@/components/teams/create-team-form";

export const metadata = { title: "Teams" };
export const dynamic = "force-dynamic";

export default async function TeamsPage() {
  const user = await currentUser();
  if (!user) redirect("/signin?callbackUrl=/teams");

  const memberships = await prisma.teamMembership.findMany({
    where: { userId: user.id },
    include: { team: { include: { _count: { select: { memberships: true } } } } },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Teams</h1>
          <p className="text-sm text-muted-foreground">
            Shared workspaces with a pooled credit balance and a common video library.
          </p>
        </div>
        <CreateTeamForm />
      </div>

      {memberships.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center p-12 text-center">
            <Users className="mb-3 h-8 w-8 text-muted-foreground" />
            <p className="font-medium">No teams yet</p>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Create a team to collaborate: every member can generate from the shared credit pool
              and see the team&apos;s videos.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {memberships.map((m) => (
            <Link key={m.team.id} href={`/teams/${m.team.id}`}>
              <Card className="transition-colors hover:border-primary/50">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium">{m.team.name}</h3>
                    <Badge variant="secondary">{m.role.toLowerCase()}</Badge>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {m.team._count.memberships}{" "}
                    {m.team._count.memberships === 1 ? "member" : "members"} · {m.team.credits}{" "}
                    pool credits
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
