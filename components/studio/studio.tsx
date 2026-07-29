"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2, Sparkles, Type, Image as ImageIcon, UploadCloud, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { MODELS, getModel, creditCost, type GenerationModeId, type Resolution } from "@/lib/models";
import { GenerationResult, type GenerationDto } from "@/components/studio/generation-result";
import { cn } from "@/lib/utils";

const PROMPT_MAX = 2000;

interface TeamOption {
  id: string;
  name: string;
  credits: number;
  role: string;
}

interface StudioProps {
  initialPrompt?: string;
}

export function Studio({ initialPrompt }: StudioProps) {
  // Workspace context: "" = personal wallet, otherwise a team id whose shared
  // pool is spent and whose members can all see the result.
  const [workspace, setWorkspace] = useState("");
  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [personalCredits, setPersonalCredits] = useState<number | null>(null);
  const [unlimited, setUnlimited] = useState(false);
  const [mode, setMode] = useState<GenerationModeId>("text-to-video");
  const [modelId, setModelId] = useState("seedance-2.0");
  const [prompt, setPrompt] = useState(initialPrompt ?? "");
  const [negativePrompt, setNegativePrompt] = useState("");
  const [showNegative, setShowNegative] = useState(false);
  const [duration, setDuration] = useState(5);
  const [aspectRatio, setAspectRatio] = useState("16:9");
  const [resolution, setResolution] = useState<Resolution>("720p");
  const [seed, setSeed] = useState("");
  const [cameraMotion, setCameraMotion] = useState("none");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [current, setCurrent] = useState<GenerationDto | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const model = getModel(modelId)!;
  const availableModels = MODELS.filter((m) => m.endpoints[mode]);
  const cost = creditCost(model, duration, resolution);

  // Clamp options whenever the selected model changes.
  useEffect(() => {
    if (!model.durations.includes(duration)) setDuration(model.durations[0]);
    if (!model.aspectRatios.includes(aspectRatio as never)) setAspectRatio(model.aspectRatios[0]);
    if (!model.resolutions.includes(resolution)) setResolution(model.resolutions[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelId]);

  // If the current model lacks the selected mode, switch to one that has it.
  useEffect(() => {
    if (!model.endpoints[mode]) {
      const fallback = MODELS.find((m) => m.endpoints[mode]);
      if (fallback) setModelId(fallback.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  useEffect(() => () => {
    if (pollTimer.current) clearTimeout(pollTimer.current);
  }, []);

  // Load workspaces (personal balance + teams) and keep them fresh.
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const res = await fetch("/api/me");
        if (!res.ok) return;
        const data = await res.json();
        if (!active) return;
        setPersonalCredits(data.credits);
        setTeams(data.teams ?? []);
        setUnlimited(Boolean(data.unlimited));
      } catch {
        /* keep last known state */
      }
    };
    load();
    window.addEventListener("credits:changed", load);
    return () => {
      active = false;
      window.removeEventListener("credits:changed", load);
    };
  }, []);

  const poll = useCallback((id: string) => {
    const tick = async () => {
      try {
        const res = await fetch(`/api/generations/${id}`);
        if (!res.ok) throw new Error();
        const { generation } = (await res.json()) as { generation: GenerationDto };
        setCurrent(generation);
        if (generation.status === "COMPLETED") {
          toast.success("Your video is ready!");
          window.dispatchEvent(new Event("credits:changed"));
          return;
        }
        if (generation.status === "FAILED") {
          toast.error(generation.error ?? "Generation failed — credits refunded.");
          window.dispatchEvent(new Event("credits:changed"));
          return;
        }
      } catch {
        /* transient poll error — keep trying */
      }
      pollTimer.current = setTimeout(tick, 3000);
    };
    tick();
  }, []);

  async function uploadFile(file: File) {
    setUploading(true);
    setImagePreview(URL.createObjectURL(file));
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      setImageUrl(data.url);
    } catch (err) {
      setImagePreview(null);
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function generate() {
    if (prompt.trim().length < 3) {
      toast.error("Describe what you want to see (at least a few words).");
      return;
    }
    if (mode === "image-to-video" && !imageUrl) {
      toast.error("Upload a start image first.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamId: workspace || undefined,
          mode,
          model: modelId,
          prompt: prompt.trim(),
          negativePrompt: negativePrompt.trim() || undefined,
          imageUrl: mode === "image-to-video" ? imageUrl : undefined,
          duration,
          aspectRatio,
          resolution,
          seed: seed ? Number(seed) : undefined,
          cameraMotion: model.supportsCameraMotion ? cameraMotion : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.code === "INSUFFICIENT_CREDITS") {
          toast.error(data.error, {
            action: { label: "Get credits", onClick: () => (window.location.href = "/pricing") },
          });
        } else {
          toast.error(data.error ?? "Something went wrong");
        }
        return;
      }
      window.dispatchEvent(new Event("credits:changed"));
      setCurrent({
        id: data.id,
        status: "PENDING",
        prompt,
        model: modelId,
        aspectRatio,
        outputVideoUrl: null,
        error: null,
      } as GenerationDto);
      poll(data.id);
    } finally {
      setSubmitting(false);
    }
  }

  const busy = current !== null && (current.status === "PENDING" || current.status === "PROCESSING");

  return (
    <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
      {/* Controls */}
      <Card className="h-fit">
        <CardContent className="space-y-5 p-5">
          {/* Workspace switcher */}
          <div className="space-y-1.5">
            <Label htmlFor="workspace">Workspace</Label>
            <Select id="workspace" value={workspace} onChange={(e) => setWorkspace(e.target.value)}>
              <option value="">
                Personal
                {unlimited ? " — Unlimited" : personalCredits !== null ? ` — ${personalCredits} credits` : ""}
              </option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} — {t.credits} pool credits
                </option>
              ))}
            </Select>
            {workspace && (
              <p className="text-xs text-muted-foreground">
                Spends the team pool; every team member can see the result.
              </p>
            )}
          </div>

          {/* Mode tabs */}
          <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
            {(
              [
                ["text-to-video", "Text to Video", Type],
                ["image-to-video", "Image to Video", ImageIcon],
              ] as const
            ).map(([id, label, Icon]) => (
              <button
                key={id}
                onClick={() => setMode(id)}
                className={cn(
                  "flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  mode === id ? "bg-background text-foreground shadow" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4" /> {label}
              </button>
            ))}
          </div>

          {/* Image dropzone */}
          {mode === "image-to-video" && (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                const file = e.dataTransfer.files[0];
                if (file) uploadFile(file);
              }}
              onClick={() => fileInput.current?.click()}
              className={cn(
                "relative flex min-h-[140px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-4 text-center transition-colors",
                dragOver ? "border-primary bg-primary/10" : "border-border hover:border-primary/50",
              )}
            >
              <input
                ref={fileInput}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) uploadFile(file);
                  e.target.value = "";
                }}
              />
              {imagePreview ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imagePreview} alt="Start frame" className="max-h-40 rounded-md object-contain" />
                  {uploading && (
                    <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-background/70">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setImageUrl(null);
                      setImagePreview(null);
                    }}
                    className="absolute right-2 top-2 rounded-full bg-background/80 p-1 hover:bg-background"
                    aria-label="Remove image"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </>
              ) : (
                <>
                  <UploadCloud className="mb-2 h-7 w-7 text-muted-foreground" />
                  <p className="text-sm">Drop an image here or click to upload</p>
                  <p className="mt-1 text-xs text-muted-foreground">JPEG, PNG or WebP · up to 10 MB</p>
                </>
              )}
            </div>
          )}

          {/* Model */}
          <div className="space-y-1.5">
            <Label htmlFor="model">Model</Label>
            <Select id="model" value={modelId} onChange={(e) => setModelId(e.target.value)}>
              {availableModels.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} — {m.vendor}
                </option>
              ))}
            </Select>
            <p className="text-xs text-muted-foreground">{model.description}</p>
          </div>

          {/* Prompt */}
          <div className="space-y-1.5">
            <div className="flex items-baseline justify-between">
              <Label htmlFor="prompt">Prompt</Label>
              <span className="text-xs text-muted-foreground">
                {prompt.length}/{PROMPT_MAX}
              </span>
            </div>
            <Textarea
              id="prompt"
              rows={4}
              maxLength={PROMPT_MAX}
              placeholder="A cinematic drone shot over a misty forest at dawn, volumetric light…"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            />
            {model.supportsNegativePrompt && (
              <button
                className="text-xs text-primary hover:underline"
                onClick={() => setShowNegative((v) => !v)}
              >
                {showNegative ? "Hide negative prompt" : "+ Negative prompt"}
              </button>
            )}
            {showNegative && model.supportsNegativePrompt && (
              <Textarea
                rows={2}
                maxLength={1000}
                placeholder="What to avoid: blurry, low quality, text, watermark…"
                value={negativePrompt}
                onChange={(e) => setNegativePrompt(e.target.value)}
              />
            )}
          </div>

          {/* Options grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="duration">Duration</Label>
              <Select id="duration" value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
                {model.durations.map((d) => (
                  <option key={d} value={d}>
                    {d}s
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ratio">Aspect ratio</Label>
              <Select id="ratio" value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value)}>
                {model.aspectRatios.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="resolution">Resolution</Label>
              <Select
                id="resolution"
                value={resolution}
                onChange={(e) => setResolution(e.target.value as Resolution)}
              >
                {model.resolutions.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </Select>
            </div>
            {model.supportsSeed && (
              <div className="space-y-1.5">
                <Label htmlFor="seed">Seed (optional)</Label>
                <Input
                  id="seed"
                  type="number"
                  min={0}
                  placeholder="Random"
                  value={seed}
                  onChange={(e) => setSeed(e.target.value)}
                />
              </div>
            )}
            {model.supportsCameraMotion && model.cameraMotions && (
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="camera">Camera motion</Label>
                <Select id="camera" value={cameraMotion} onChange={(e) => setCameraMotion(e.target.value)}>
                  {model.cameraMotions.map((c) => (
                    <option key={c} value={c}>
                      {c.replaceAll("_", " ")}
                    </option>
                  ))}
                </Select>
              </div>
            )}
          </div>

          <Button className="w-full" size="lg" onClick={generate} disabled={submitting || uploading || busy}>
            {submitting || busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Generating…
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" /> Generate
                <Badge variant="secondary" className="ml-1">
                  {unlimited ? "included" : `${cost} ${cost === 1 ? "credit" : "credits"}`}
                </Badge>
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Result */}
      <GenerationResult
        generation={current}
        onVariation={(g) => {
          setPrompt(g.prompt);
          setSeed("");
          setCurrent(null);
        }}
        onUseAsStartFrame={(url) => {
          setMode("image-to-video");
          setImageUrl(url);
          setImagePreview(url);
          setCurrent(null);
          toast.success("Start frame set — tweak the prompt and generate.");
        }}
      />
    </div>
  );
}
