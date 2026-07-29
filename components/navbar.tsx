import Link from "next/link";
import { Clapperboard, ShieldCheck } from "lucide-react";
import { currentUser, signOut } from "@/lib/auth";
import { isPlatformAdmin } from "@/lib/rbac";
import { Button } from "@/components/ui/button";
import { CreditBadge } from "@/components/credit-badge";
import { MobileNav } from "@/components/mobile-nav";

export async function Navbar() {
  const user = await currentUser();

  const links = [
    { href: "/studio", label: "Studio" },
    { href: "/pricing", label: "Pricing" },
    ...(user
      ? [
          { href: "/dashboard", label: "Dashboard" },
          { href: "/teams", label: "Teams" },
        ]
      : []),
    ...(user && isPlatformAdmin(user) ? [{ href: "/admin", label: "Admin", accent: true }] : []),
  ];

  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
      <div className="relative mx-auto flex h-14 max-w-7xl items-center gap-4 px-4 sm:gap-6 sm:px-6">
        <MobileNav links={links} />
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <Clapperboard className="h-5 w-5 text-primary" />
          VidForge
        </Link>
        <nav className="hidden items-center gap-4 text-sm text-muted-foreground sm:flex">
          {links.map((l) =>
            l.accent ? (
              <Link
                key={l.href}
                href={l.href}
                className="flex items-center gap-1 text-primary transition-colors hover:text-primary/80"
              >
                <ShieldCheck className="h-3.5 w-3.5" /> {l.label}
              </Link>
            ) : (
              <Link key={l.href} href={l.href} className="transition-colors hover:text-foreground">
                {l.label}
              </Link>
            ),
          )}
        </nav>
        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          {user ? (
            <>
              <CreditBadge />
              <span className="hidden text-sm text-muted-foreground md:inline">
                {user.name ?? user.email}
              </span>
              <form
                action={async () => {
                  "use server";
                  await signOut({ redirectTo: "/" });
                }}
              >
                <Button variant="ghost" size="sm" type="submit">
                  Sign out
                </Button>
              </form>
            </>
          ) : (
            <Button size="sm">
              <Link href="/signin">Sign in</Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
