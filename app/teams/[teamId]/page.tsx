import { redirect, notFound } from "next/navigation";
import { Coins, ShieldCheck } from "lucide-react";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getMembership, isPlatformAdmin, roleAtLeast } from "@/lib/rbac";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { HistoryGallery } from "@/components/history-gallery";
import { TeamMembers } from "@/components/teams/team-members";
import { TeamCreditsForm } from "@/components/teams/team-credits-form";

export const dynamic = "force-dynamic";

export default async function TeamPage(props: { params: Promise<{ teamId: string }> }) {
  const user = await currentUser();
  if (!user) redirect("/signin?callbackUrl=/teams");
  const { teamId } = await props.params;

  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: { _count: { select: { memberships: true, generations: true } } },
  });
  if (!team) notFound();

  // Access: team members, or platform admins (full read/manage everywhere).
  const membership = await getMembership(user.id, teamId);
  const platformAdmin = isPlatformAdmin(user);
  if (!membership && !platformAdmin) notFound();

  // Platform admins act with owner-equivalent powers in the UI.
  const effectiveRole = membership?.role ?? "OWNER";
  const canAdmin = platformAdmin || roleAtLeast(effectiveRole, "ADMIN");
  const isOwner = platformAdmin || effectiveRole === "OWNER";

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">{team.name}</h1>
        <Badge variant="secondary">
          {membership ? membership.role.toLowerCase() : "platform admin"}
        </Badge>
        {platformAdmin && !membership && <ShieldCheck className="h-4 w-4 text-primary" />}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Coins className="h-4 w-4 text-amber-400" /> Pool credits
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{team.credits}</p>
            {canAdmin && <TeamCreditsForm teamId={team.id} />}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Members</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{team._count.memberships}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Videos</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{team._count.generations}</p>
          </CardContent>
        </Card>
      </div>

      <section className="space-y-4">
        <h2 className="text-lg font-medium">Members</h2>
        <TeamMembers
          teamId={team.id}
          currentUserId={user.id}
          canAdmin={canAdmin}
          isOwner={isOwner}
        />
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-medium">Team videos</h2>
        <HistoryGallery teamId={team.id} showCreator />
      </section>
    </div>
  );
}
