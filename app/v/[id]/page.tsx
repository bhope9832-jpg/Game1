import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";
import { MODELS } from "@/lib/models";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export const dynamic = "force-dynamic";

/** Public share page — anyone with the link can watch a completed video. */
export default async function SharePage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const gen = await prisma.generation.findUnique({ where: { id } });
  if (!gen || gen.status !== "COMPLETED" || !gen.outputVideoUrl) notFound();

  const modelName = MODELS.find((m) => m.id === gen.model)?.name ?? gen.model;

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <Card>
        <CardContent className="space-y-4 p-5">
          <video
            src={gen.outputVideoUrl}
            controls
            autoPlay
            loop
            playsInline
            className="w-full rounded-lg bg-black"
            style={{ aspectRatio: gen.aspectRatio.replace(":", "/") }}
          />
          <p className="text-sm text-muted-foreground">“{gen.prompt}”</p>
          <p className="text-xs text-muted-foreground">
            Generated with {modelName} on VidForge
          </p>
          <Button>
            <Link href="/studio">Create your own — free credits daily</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export async function generateMetadata(props: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await props.params;
  const gen = await prisma.generation.findUnique({ where: { id } });
  return {
    title: gen ? `AI video: ${gen.prompt.slice(0, 60)}` : "Shared video",
    description: gen?.prompt,
  };
}
