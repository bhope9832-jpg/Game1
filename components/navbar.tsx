import Link from "next/link";
import { Clapperboard, ShieldCheck } from "lucide-react";
import { currentUser, signOut } from "@/lib/auth";
import { isPlatformAdmin } from "@/lib/rbac";
import { Button } from "@/components/ui/button";
import { CreditBadge } from "@/components/credit-badge";

export async function Navbar() {
  const user = await currentUser();

  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-6 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <Clapperboard className="h-5 w-5 text-primary" />
          VidForge
        </Link>
        <nav className="flex items-center gap-4 text-sm text-muted-foreground">
          <Link href="/studio" className="transition-colors hover:text-foreground">
            Studio
          </Link>
          <Link href="/pricing" className="transition-colors hover:text-foreground">
            Pricing
          </Link>
          {user && (
            <>
              <Link href="/dashboard" className="transition-colors hover:text-foreground">
                Dashboard
              </Link>
              <Link href="/teams" className="transition-colors hover:text-foreground">
                Teams
              </Link>
            </>
          )}
          {user && isPlatformAdmin(user) && (
            <Link
              href="/admin"
              className="flex items-center gap-1 text-primary transition-colors hover:text-primary/80"
            >
              <ShieldCheck className="h-3.5 w-3.5" /> Admin
            </Link>
          )}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          {user ? (
            <>
              <CreditBadge />
              <span className="hidden text-sm text-muted-foreground sm:inline">
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
