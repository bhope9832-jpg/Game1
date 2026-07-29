"use server";

import { revalidatePath } from "next/cache";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertPlatformAdmin } from "@/lib/rbac";
import { grantCredits } from "@/lib/credits";

/**
 * Platform-admin server actions. Every action re-authenticates and re-checks
 * the platform role — the page-level gate is UX, this is the enforcement.
 */

async function requireAdmin() {
  const user = await currentUser();
  if (!user) throw new Error("Unauthorized");
  assertPlatformAdmin(user);
  return user;
}

export async function toggleBan(formData: FormData) {
  const admin = await requireAdmin();
  const userId = String(formData.get("userId"));
  if (userId === admin.id) return; // can't ban yourself
  const target = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  await prisma.user.update({ where: { id: userId }, data: { isBanned: !target.isBanned } });
  revalidatePath("/admin");
}

export async function togglePlatformRole(formData: FormData) {
  const admin = await requireAdmin();
  const userId = String(formData.get("userId"));
  if (userId === admin.id) return; // can't demote yourself
  const target = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  await prisma.user.update({
    where: { id: userId },
    data: { platformRole: target.platformRole === "PLATFORM_ADMIN" ? "USER" : "PLATFORM_ADMIN" },
  });
  revalidatePath("/admin");
}

export async function adjustUserCredits(formData: FormData) {
  const admin = await requireAdmin();
  const userId = String(formData.get("userId"));
  const amount = Number(formData.get("amount"));
  if (!Number.isInteger(amount) || amount === 0 || Math.abs(amount) > 100_000) return;
  await grantCredits({
    userId,
    amount,
    type: "ADMIN_ADJUSTMENT",
    note: `Adjusted by ${admin.email}`,
  });
  revalidatePath("/admin");
}

export async function adjustTeamCredits(formData: FormData) {
  const admin = await requireAdmin();
  const teamId = String(formData.get("teamId"));
  const amount = Number(formData.get("amount"));
  if (!Number.isInteger(amount) || amount === 0 || Math.abs(amount) > 100_000) return;
  await grantCredits({
    userId: admin.id,
    teamId,
    amount,
    type: "ADMIN_ADJUSTMENT",
    note: `Adjusted by ${admin.email}`,
  });
  revalidatePath("/admin");
}
