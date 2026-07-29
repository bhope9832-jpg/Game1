import type { Generation, TeamMembership, TeamRole, User } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Central role-based access control.
 *
 * Three permission layers, checked in this order everywhere:
 *   1. Platform admin  — `platformRole === PLATFORM_ADMIN` bypasses every check
 *      and can read/manage all users, teams, and generations.
 *   2. Team role       — OWNER > ADMIN > MEMBER within a team workspace.
 *   3. Ownership       — a user always controls their own personal resources.
 *
 * Every API route and page goes through these helpers rather than checking
 * roles inline, so policy changes stay a one-file edit.
 */

// ---------- Errors ----------

export class AuthorizationError extends Error {
  status: number;
  constructor(message = "You don't have permission to do that", status = 403) {
    super(message);
    this.name = "AuthorizationError";
    this.status = status;
  }
}

// ---------- Platform layer ----------

export function isPlatformAdmin(user: Pick<User, "platformRole">): boolean {
  return user.platformRole === "PLATFORM_ADMIN";
}

/** Throws unless the user is a platform admin. */
export function assertPlatformAdmin(user: Pick<User, "platformRole">): void {
  if (!isPlatformAdmin(user)) {
    throw new AuthorizationError("Platform admin access required");
  }
}

/**
 * Complimentary unlimited access: every model, zero credit charges.
 * Granted either by the UNLIMITED_EMAILS env allowlist (checked live, so it
 * applies to accounts that signed up before the var was set) or by the
 * per-user flag a platform admin can toggle from /admin.
 */
export function hasUnlimitedAccess(user: Pick<User, "email" | "unlimitedAccess">): boolean {
  if (user.unlimitedAccess) return true;
  return (process.env.UNLIMITED_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
    .includes(user.email.toLowerCase());
}

// ---------- Team layer ----------

const ROLE_WEIGHT: Record<TeamRole, number> = { MEMBER: 1, ADMIN: 2, OWNER: 3 };

export function roleAtLeast(role: TeamRole, min: TeamRole): boolean {
  return ROLE_WEIGHT[role] >= ROLE_WEIGHT[min];
}

export async function getMembership(
  userId: string,
  teamId: string,
): Promise<TeamMembership | null> {
  return prisma.teamMembership.findUnique({
    where: { teamId_userId: { teamId, userId } },
  });
}

export interface TeamAccess {
  /** null when access was granted via platform admin rather than membership */
  membership: TeamMembership | null;
  viaPlatformAdmin: boolean;
}

/**
 * Asserts the user may act in a team at `minRole` or above.
 * Platform admins pass every check without needing a membership.
 */
export async function requireTeamRole(
  user: Pick<User, "id" | "platformRole">,
  teamId: string,
  minRole: TeamRole,
): Promise<TeamAccess> {
  if (isPlatformAdmin(user)) {
    const membership = await getMembership(user.id, teamId);
    return { membership, viaPlatformAdmin: true };
  }
  const membership = await getMembership(user.id, teamId);
  if (!membership) throw new AuthorizationError("You are not a member of this team", 404);
  if (!roleAtLeast(membership.role, minRole)) {
    throw new AuthorizationError(`This action requires the team ${minRole.toLowerCase()} role`);
  }
  return { membership, viaPlatformAdmin: false };
}

/**
 * Team-member management policy:
 *  - OWNER may manage anyone (but the last owner can never be removed/demoted —
 *    enforced at the call site where the count is known).
 *  - ADMIN may manage MEMBERs only.
 *  - MEMBERs manage nobody.
 * Platform admins are handled by the caller via requireTeamRole's bypass.
 */
export function canManageMember(actorRole: TeamRole, targetRole: TeamRole): boolean {
  if (actorRole === "OWNER") return true;
  if (actorRole === "ADMIN") return targetRole === "MEMBER";
  return false;
}

// ---------- Generation layer ----------

/**
 * View policy: the creator, any member of the generation's team, or a
 * platform admin.
 */
export async function canViewGeneration(
  user: Pick<User, "id" | "platformRole">,
  gen: Pick<Generation, "userId" | "teamId">,
): Promise<boolean> {
  if (gen.userId === user.id) return true;
  if (isPlatformAdmin(user)) return true;
  if (gen.teamId) {
    return (await getMembership(user.id, gen.teamId)) !== null;
  }
  return false;
}

/**
 * Manage (delete) policy: the creator, a team ADMIN/OWNER for team
 * generations, or a platform admin.
 */
export async function canManageGeneration(
  user: Pick<User, "id" | "platformRole">,
  gen: Pick<Generation, "userId" | "teamId">,
): Promise<boolean> {
  if (gen.userId === user.id) return true;
  if (isPlatformAdmin(user)) return true;
  if (gen.teamId) {
    const membership = await getMembership(user.id, gen.teamId);
    return membership !== null && roleAtLeast(membership.role, "ADMIN");
  }
  return false;
}

// ---------- Route helper ----------

/** Maps thrown AuthorizationErrors to HTTP responses in API routes. */
export function authErrorResponse(err: unknown): { error: string; status: number } | null {
  if (err instanceof AuthorizationError) {
    return { error: err.message, status: err.status };
  }
  return null;
}
