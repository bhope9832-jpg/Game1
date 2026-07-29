import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

/**
 * Re-hosts generated videos on Cloudflare R2 (S3-compatible). fal.ai result
 * URLs are temporary, so every completed video is copied here before being
 * shown to the user. If R2 is not configured (local dev), the provider URL is
 * used as-is — fine for development, not for production.
 */

function r2Configured(): boolean {
  return Boolean(
    process.env.R2_ACCOUNT_ID &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      process.env.R2_BUCKET &&
      process.env.R2_PUBLIC_URL,
  );
}

let client: S3Client | null = null;
function s3(): S3Client {
  if (!client) {
    client = new S3Client({
      region: "auto",
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
    });
  }
  return client;
}

/**
 * Download a video from the provider and store it permanently.
 * Returns the permanent public URL, or the original URL when R2 is not set up.
 */
export async function persistVideo(sourceUrl: string, generationId: string): Promise<string> {
  if (!r2Configured()) return sourceUrl;

  const res = await fetch(sourceUrl);
  if (!res.ok) throw new Error(`Failed to download video (${res.status})`);
  const body = Buffer.from(await res.arrayBuffer());

  const key = `videos/${generationId}.mp4`;
  await s3().send(
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET!,
      Key: key,
      Body: body,
      ContentType: res.headers.get("content-type") ?? "video/mp4",
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );
  return `${process.env.R2_PUBLIC_URL!.replace(/\/$/, "")}/${key}`;
}
