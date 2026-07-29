import Link from "next/link";
import { ArrowRight, Sparkles, Image as ImageIcon, Zap, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MODELS } from "@/lib/models";
import { Badge } from "@/components/ui/badge";

const EXAMPLE_PROMPTS = [
  "A golden retriever surfing a huge wave at sunset, cinematic slow motion",
  "Neon-lit Tokyo street in the rain, reflections on wet asphalt, dolly forward",
  "Macro shot of a blooming flower, timelapse, soft morning light",
  "An astronaut walking through a field of glowing mushrooms on an alien planet",
];

export default function LandingPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6">
      {/* Hero */}
      <section className="flex flex-col items-center py-24 text-center">
        <Badge variant="secondary" className="mb-6 gap-1.5 py-1">
          <Sparkles className="h-3.5 w-3.5 text-primary" /> Powered by Seedance 2.0
        </Badge>
        <h1 className="max-w-3xl bg-gradient-to-b from-white to-white/60 bg-clip-text text-4xl font-bold tracking-tight text-transparent sm:text-6xl">
          Turn ideas into stunning AI videos
        </h1>
        <p className="mt-6 max-w-xl text-lg text-muted-foreground">
          Text-to-video and image-to-video with the world&apos;s best models. No API keys, no
          setup — just describe it and watch it come alive.
        </p>
        <div className="mt-8 flex gap-3">
          <Button size="lg">
            <Link href="/studio" className="flex items-center gap-2">
              Start creating free <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button size="lg" variant="outline">
            <Link href="/pricing">View pricing</Link>
          </Button>
        </div>
        <p className="mt-4 text-sm text-muted-foreground">
          Free credits every day · No credit card required
        </p>
      </section>

      {/* Models */}
      <section className="pb-20">
        <h2 className="mb-6 text-center text-2xl font-semibold">Every leading model, one studio</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {MODELS.map((m) => (
            <Card key={m.id}>
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium">{m.name}</h3>
                  {m.badge && (
                    <Badge variant={m.badge === "recommended" ? "default" : "secondary"}>
                      {m.badge}
                    </Badge>
                  )}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{m.vendor}</p>
                <p className="mt-3 text-sm text-muted-foreground">{m.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="grid gap-6 pb-20 sm:grid-cols-3">
        {[
          {
            icon: ImageIcon,
            title: "Image-to-video",
            text: "Bring any still image to life. Drag, drop, and animate with full camera control.",
          },
          {
            icon: Zap,
            title: "Fast iterations",
            text: "Fast model variants let you explore ideas in seconds before rendering finals.",
          },
          {
            icon: Shield,
            title: "Yours forever",
            text: "Videos are stored permanently in your library with instant downloads and share links.",
          },
        ].map((f) => (
          <Card key={f.title}>
            <CardContent className="p-6">
              <f.icon className="h-6 w-6 text-primary" />
              <h3 className="mt-4 font-medium">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.text}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      {/* Prompt inspiration */}
      <section className="pb-24">
        <h2 className="mb-6 text-center text-2xl font-semibold">Need inspiration?</h2>
        <div className="mx-auto grid max-w-3xl gap-3 sm:grid-cols-2">
          {EXAMPLE_PROMPTS.map((p) => (
            <Link
              key={p}
              href={`/studio?prompt=${encodeURIComponent(p)}`}
              className="rounded-lg border bg-card p-4 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
            >
              “{p}”
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
