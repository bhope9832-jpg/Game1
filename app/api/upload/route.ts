import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { uploadImage } from "@/lib/fal";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

/** Accepts a start-frame image for image-to-video and stages it with the provider. */
export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rl = rateLimit(`upload:${user.id}`, 20, 60);
  if (!rl.ok) return NextResponse.json({ error: "Too many uploads" }, { status: 429 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Attach an image as `file`" }, { status: 400 });
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ error: "Use a JPEG, PNG, or WebP image" }, { status: 415 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Image must be under 10 MB" }, { status: 413 });
  }

  try {
    const url = await uploadImage(file);
    return NextResponse.json({ url });
  } catch {
    return NextResponse.json({ error: "Upload failed, please retry" }, { status: 502 });
  }
}
