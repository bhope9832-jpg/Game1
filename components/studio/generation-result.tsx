"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Clapperboard, Download, Loader2, RefreshCw, Share2, ImagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export interface GenerationDto {
  id: string;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
  prompt: string;
  model: string;
  aspectRatio: string;
  outputVideoUrl: string | null;
  error: string | null;
}

interface Props {
  generation: GenerationDto | null;
  onVariation: (g: GenerationDto) => void;
  onUseAsStartFrame: (imageUrl: string) => void;
}

export function GenerationResult({ generation, onVariation, onUseAsStartFrame }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [capturing, setCapturing] = useState(false);

  /** Grab the current video frame, upload it, and hand back a usable image URL. */
  async function captureFrame() {
    const video = videoRef.current;
    if (!video) return;
    setCapturing(true);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext("2d")!.drawImage(video, 0, 0);
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/png"),
      );
      if (!blob) throw new Error("Could not capture frame");
      const form = new FormData();
      form.append("file", new File([blob], "frame.png", { type: "image/png" }));
      const res = await fetch("/api/upload", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onUseAsStartFrame(data.url);
    } catch {
      toast.error("Couldn't capture that frame (the video host may block it). Try downloading and re-uploading.");
    } finally {
      setCapturing(false);
    }
  }

  async function share() {
    if (!generation) return;
    const url = `${window.location.origin}/v/${generation.id}`;
    await navigator.clipboard.writeText(url);
    toast.success("Share link copied to clipboard");
  }

  // Empty state
  if (!generation) {
    return (
      <Card className="flex min-h-[420px] items-center justify-center">
        <CardContent className="flex flex-col items-center p-8 text-center">
          <Clapperboard className="mb-4 h-10 w-10 text-muted-foreground" />
          <h3 className="font-medium">Your video will appear here</h3>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">
            Describe a scene, pick a model, and hit Generate. Most videos are ready in under two
            minutes.
          </p>
        </CardContent>
      </Card>
    );
  }

  // In-flight state
  if (generation.status === "PENDING" || generation.status === "PROCESSING") {
    return (
      <Card className="flex min-h-[420px] items-center justify-center">
        <CardContent className="flex w-full max-w-md flex-col items-center p-8 text-center">
          <div className="relative mb-6 w-full overflow-hidden rounded-lg" style={{ aspectRatio: generation.aspectRatio.replace(":", "/") }}>
            <Skeleton className="absolute inset-0" />
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          </div>
          <Badge variant={generation.status === "PENDING" ? "warning" : "secondary"}>
            {generation.status === "PENDING" ? "Queued" : "Generating"}
          </Badge>
          <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">“{generation.prompt}”</p>
        </CardContent>
      </Card>
    );
  }

  // Failure state
  if (generation.status === "FAILED") {
    return (
      <Card className="flex min-h-[420px] items-center justify-center">
        <CardContent className="flex flex-col items-center p-8 text-center">
          <Badge variant="destructive">Failed</Badge>
          <p className="mt-4 max-w-sm text-sm text-muted-foreground">
            {generation.error ?? "The provider couldn't complete this generation."}
          </p>
          <p className="mt-2 text-sm text-emerald-400">Your credits have been refunded.</p>
          <Button className="mt-6" variant="secondary" onClick={() => onVariation(generation)}>
            <RefreshCw className="h-4 w-4" /> Try again
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Completed
  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <video
          ref={videoRef}
          src={generation.outputVideoUrl ?? undefined}
          controls
          autoPlay
          loop
          playsInline
          crossOrigin="anonymous"
          className="w-full rounded-lg bg-black"
          style={{ aspectRatio: generation.aspectRatio.replace(":", "/") }}
        />
        <p className="text-sm text-muted-foreground">“{generation.prompt}”</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm">
            <a
              href={generation.outputVideoUrl ?? "#"}
              download={`vidforge-${generation.id}.mp4`}
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" /> Download
            </a>
          </Button>
          <Button variant="secondary" size="sm" onClick={() => onVariation(generation)}>
            <RefreshCw className="h-4 w-4" /> Generate variation
          </Button>
          <Button variant="secondary" size="sm" onClick={captureFrame} disabled={capturing}>
            {capturing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
            Use as start frame
          </Button>
          <Button variant="secondary" size="sm" onClick={share}>
            <Share2 className="h-4 w-4" /> Share
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
