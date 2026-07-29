import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Resend from "next-auth/providers/resend";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";

function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "database" },
  pages: { signIn: "/signin" },
  providers: [
    Google({
      allowDangerousEmailAccountLinking: true,
    }),
    Resend({
      from: process.env.EMAIL_FROM ?? "VidForge <onboarding@resend.dev>",
    }),
  ],
  events: {
    // Give brand-new users their first daily allowance, flag platform admins,
    // and claim any pending team invites addressed to their email.
    async createUser({ user }) {
      if (!user.id || !user.email) return;
      const email = user.email.toLowerCase();
      const isPlatformAdmin = adminEmails().includes(email);
      await prisma.user.update({
        where: { id: user.id },
        data: {
          platformRole: isPlatformAdmin ? "PLATFORM_ADMIN" : "USER",
          dailyCredits: 4,
          dailyCreditsResetAt: new Date(),
          creditTransactions: {
            create: { type: "DAILY_GRANT", amount: 4, balanceAfter: 4, note: "Welcome credits" },
          },
        },
      });

      const invites = await prisma.teamInvite.findMany({
        where: { email, expiresAt: { gt: new Date() } },
      });
      for (const invite of invites) {
        await prisma.$transaction([
          prisma.teamMembership.upsert({
            where: { teamId_userId: { teamId: invite.teamId, userId: user.id } },
            create: { teamId: invite.teamId, userId: user.id, role: invite.role },
            update: {},
          }),
          prisma.teamInvite.delete({ where: { id: invite.id } }),
        ]);
      }
    },
  },
  callbacks: {
    session({ session, user }) {
      session.user.id = user.id;
      return session;
    },
  },
});

/** Server-side helper: current user record or null. */
export async function currentUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return prisma.user.findUnique({ where: { id: session.user.id } });
}
