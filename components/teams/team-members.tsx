"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Mail, UserMinus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

interface Member {
  userId: string;
  role: "OWNER" | "ADMIN" | "MEMBER";
  user: { id: string; name: string | null; email: string; image: string | null };
}

interface Invite {
  id: string;
  email: string;
  role: string;
}

interface Props {
  teamId: string;
  currentUserId: string;
  canAdmin: boolean;
  isOwner: boolean;
}

export function TeamMembers({ teamId, currentUserId, canAdmin, isOwner }: Props) {
  const [members, setMembers] = useState<Member[] | null>(null);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("MEMBER");
  const [inviting, setInviting] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/teams/${teamId}/members`);
    if (!res.ok) return;
    const data = await res.json();
    setMembers(data.members);
    setInvites(data.invites);
  }, [teamId]);

  useEffect(() => {
    load();
  }, [load]);

  async function invite() {
    setInviting(true);
    try {
      const res = await fetch(`/api/teams/${teamId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(data.membership ? "Member added" : "Invite sent — they'll join on sign-up");
      setEmail("");
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Invite failed");
    } finally {
      setInviting(false);
    }
  }

  async function changeRole(userId: string, newRole: string) {
    const res = await fetch(`/api/teams/${teamId}/members/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: newRole }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error ?? "Couldn't change role");
    }
    load();
  }

  async function remove(userId: string) {
    const res = await fetch(`/api/teams/${teamId}/members/${userId}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error ?? "Couldn't remove member");
    } else if (userId === currentUserId) {
      window.location.href = "/teams";
      return;
    }
    load();
  }

  return (
    <div className="space-y-4">
      {canAdmin && (
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            invite();
          }}
        >
          <Input
            type="email"
            required
            placeholder="teammate@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-64"
          />
          {isOwner && (
            <Select value={role} onChange={(e) => setRole(e.target.value)} className="w-32">
              <option value="MEMBER">Member</option>
              <option value="ADMIN">Admin</option>
            </Select>
          )}
          <Button type="submit" disabled={inviting}>
            {inviting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
            Invite
          </Button>
        </form>
      )}

      <Card>
        <CardContent className="divide-y p-0">
          {members === null ? (
            <div className="space-y-3 p-6">
              <Skeleton className="h-6 w-2/3" />
              <Skeleton className="h-6 w-1/2" />
            </div>
          ) : (
            <>
              {members.map((m) => (
                <div key={m.userId} className="flex items-center justify-between px-6 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm">
                      {m.user.name ?? m.user.email}
                      {m.userId === currentUserId && (
                        <span className="ml-2 text-xs text-muted-foreground">(you)</span>
                      )}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{m.user.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {isOwner && m.userId !== currentUserId ? (
                      <Select
                        value={m.role}
                        onChange={(e) => changeRole(m.userId, e.target.value)}
                        className="h-8 w-28 text-xs"
                      >
                        <option value="OWNER">Owner</option>
                        <option value="ADMIN">Admin</option>
                        <option value="MEMBER">Member</option>
                      </Select>
                    ) : (
                      <Badge variant="secondary">{m.role.toLowerCase()}</Badge>
                    )}
                    {(m.userId === currentUserId ||
                      (canAdmin && (isOwner || m.role === "MEMBER"))) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-400 hover:text-red-300"
                        onClick={() => remove(m.userId)}
                        title={m.userId === currentUserId ? "Leave team" : "Remove member"}
                      >
                        <UserMinus className="h-3.5 w-3.5" />
                        {m.userId === currentUserId ? "Leave" : "Remove"}
                      </Button>
                    )}
                  </div>
                </div>
              ))}
              {invites.map((inv) => (
                <div key={inv.id} className="flex items-center justify-between px-6 py-3">
                  <div>
                    <p className="text-sm">{inv.email}</p>
                    <p className="text-xs text-muted-foreground">
                      Invited as {inv.role.toLowerCase()} — pending sign-up
                    </p>
                  </div>
                  <Badge variant="warning">pending</Badge>
                </div>
              ))}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
