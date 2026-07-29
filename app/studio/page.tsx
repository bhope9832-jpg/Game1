import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Studio } from "@/components/studio/studio";

export const metadata = { title: "Studio" };
export const dynamic = "force-dynamic";

export default async function StudioPage(props: {
  searchParams: Promise<{ prompt?: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/signin?callbackUrl=/studio");
  const { prompt } = await props.searchParams;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <h1 className="mb-6 text-2xl font-semibold">Generation Studio</h1>
      <Studio initialPrompt={prompt} />
    </div>
  );
}
