import { redirect } from "next/navigation";
import { Clapperboard } from "lucide-react";
import { auth, signIn } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export const metadata = { title: "Sign in" };

export default async function SignInPage(props: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const session = await auth();
  if (session) redirect("/studio");
  const { callbackUrl = "/studio", error } = await props.searchParams;

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <Clapperboard className="mb-2 h-8 w-8 text-primary" />
          <CardTitle className="text-xl">Welcome to VidForge</CardTitle>
          <CardDescription>Sign in to start generating videos</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <p className="rounded-md bg-destructive/15 p-3 text-sm text-red-400">
              Sign-in failed. Please try again.
            </p>
          )}
          <form
            action={async () => {
              "use server";
              await signIn("google", { redirectTo: callbackUrl });
            }}
          >
            <Button className="w-full" variant="secondary" type="submit">
              Continue with Google
            </Button>
          </form>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-border" /> or <div className="h-px flex-1 bg-border" />
          </div>
          <form
            action={async (formData: FormData) => {
              "use server";
              await signIn("resend", {
                email: formData.get("email"),
                redirectTo: callbackUrl,
              });
            }}
            className="space-y-3"
          >
            <Input name="email" type="email" required placeholder="you@example.com" />
            <Button className="w-full" type="submit">
              Email me a magic link
            </Button>
          </form>
          <p className="text-center text-xs text-muted-foreground">
            By signing in you agree to our terms of service.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
