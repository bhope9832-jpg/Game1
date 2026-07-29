"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Download, Loader2, Trash2, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { MODELS } from "@/lib/models";
import { formatDate } from "@/lib/utils";

interface Item {
  id: string;
  prompt: string;
  model: string;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
  outputVideoUrl: string | null;
  aspectRatio: string;
  duration: number;
  creditsUsed: number;
  createdAt: string;
}

const STATUS_BADGE = {
  PENDING: "warning",
  PROCESSING: "secondary",
  COMPLETED: "success",
  FAILED: "destructive",
} as const;

export function HistoryGallery() {
  const [items, setItems] = useState<Item[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [statusFilter, setStatusFilter] = useState("");
  const [modelFilter, setModelFilter] = useState("");

  const load = useCallback(
    async (append = false, cursorArg: string | null = null) => {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      if (modelFilter) params.set("model", modelFilter);
      if (cursorArg) params.set("cursor", cursorArg);
      const res = await fetch(`/api/generations?${params}`);
      if (!res.ok) return;
      const data = await res.json();
      setItems((prev) => (append && prev ? [...prev, ...data.items] : data.items));
      setCursor(data.nextCursor);
    },
    [statusFilter, modelFilter],
  );

  useEffect(() => {
    setItems(null);
    load();
  }, [load]);

  async function remove(id: string) {
    const res = await fetch(`/api/generations/${id}`, { method: "DELETE" });
    if (res.ok) {
      setItems((prev) => prev?.filter((i) => i.id !== id) ?? null);
      toast.success("Deleted");
    } else {
      toast.error("Couldn't delete that generation");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <Select
          className="w-40"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label="Filter by status"
        >
          <option value="">All statuses</option>
          <option value="COMPLETED">Completed</option>
          <option value="FAILED">Failed</option>
          <option value="PROCESSING">Processing</option>
          <option value="PENDING">Queued</option>
        </Select>
        <Select
          className="w-52"
          value={modelFilter}
          onChange={(e) => setModelFilter(e.target.value)}
          aria-label="Filter by model"
        >
          <option value="">All models</option>
          {MODELS.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </Select>
      </div>

      {items === null ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="aspect-video" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center p-12 text-center">
            <Video className="mb-3 h-8 w-8 text-muted-foreground" />
            <p className="font-medium">No videos yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Head to the Studio and create your first one — it only takes a minute.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => (
              <Card key={item.id} className="overflow-hidden">
                {item.status === "COMPLETED" && item.outputVideoUrl ? (
                  <video
                    src={item.outputVideoUrl}
                    controls
                    preload="metadata"
                    playsInline
                    className="aspect-video w-full bg-black object-contain"
                  />
                ) : (
                  <div className="flex aspect-video items-center justify-center bg-muted">
                    {item.status === "FAILED" ? (
                      <span className="text-sm text-muted-foreground">Generation failed</span>
                    ) : (
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    )}
                  </div>
                )}
                <CardContent className="space-y-2 p-4">
                  <p className="line-clamp-2 text-sm">{item.prompt}</p>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant={STATUS_BADGE[item.status]}>{item.status.toLowerCase()}</Badge>
                    <span>{MODELS.find((m) => m.id === item.model)?.name ?? item.model}</span>
                    <span>·</span>
                    <span>{item.duration}s</span>
                    <span>·</span>
                    <span>{formatDate(item.createdAt)}</span>
                  </div>
                  <div className="flex gap-2 pt-1">
                    {item.outputVideoUrl && (
                      <Button variant="ghost" size="sm">
                        <a href={item.outputVideoUrl} download className="flex items-center gap-1.5">
                          <Download className="h-3.5 w-3.5" /> Download
                        </a>
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-400 hover:text-red-300"
                      onClick={() => remove(item.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          {cursor && (
            <div className="flex justify-center pt-2">
              <Button
                variant="outline"
                disabled={loadingMore}
                onClick={async () => {
                  setLoadingMore(true);
                  await load(true, cursor);
                  setLoadingMore(false);
                }}
              >
                {loadingMore ? <Loader2 className="h-4 w-4 animate-spin" /> : "Load more"}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
