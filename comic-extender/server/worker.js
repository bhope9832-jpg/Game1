/**
 * Comic Page Extender — owner-key backend (Cloudflare Worker, free tier).
 *
 * Visitors never see a key: the browser POSTs generation requests here, and
 * this worker forwards them to the Gemini API with YOUR key (stored as a
 * Worker secret). Optional Google sign-in gating + per-user daily limits.
 *
 * Deploy: see README.md in this folder. Configuration (Worker settings):
 *   Secret  GEMINI_API_KEY   – your Gemini key from a billed project (required)
 *   Var     ALLOWED_ORIGIN   – e.g. https://YOURNAME.github.io  (recommended)
 *   Var     REQUIRE_LOGIN    – "true" to demand Google sign-in (optional)
 *   Var     OAUTH_CLIENT_ID  – your Google OAuth client ID (with REQUIRE_LOGIN)
 *   Var     DAILY_LIMIT      – pages per user per day, default 20 (optional)
 *   KV bind LIMITS           – KV namespace for counting usage (optional;
 *                              without it, no limits are enforced)
 */

const ALLOWED_MODELS = /^gemini-[a-z0-9.-]+$/i;

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const cors = {
      "Access-Control-Allow-Origin": env.ALLOWED_ORIGIN || origin || "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    };
    if (request.method === "OPTIONS") return new Response(null, { headers: cors });
    if (request.method !== "POST")   return json({ error: "POST only" }, 405, cors);
    if (env.ALLOWED_ORIGIN && origin && origin !== env.ALLOWED_ORIGIN)
      return json({ error: "origin not allowed" }, 403, cors);

    // ---- optional Google sign-in gate -----------------------------------
    let user = "anonymous";
    if (env.REQUIRE_LOGIN === "true") {
      const token = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
      if (!token) return json({ error: "sign-in required" }, 401, cors);
      const info = await fetch("https://oauth2.googleapis.com/tokeninfo?id_token=" + encodeURIComponent(token));
      if (!info.ok) return json({ error: "sign-in invalid or expired — sign in again" }, 401, cors);
      const claims = await info.json();
      if (env.OAUTH_CLIENT_ID && claims.aud !== env.OAUTH_CLIENT_ID)
        return json({ error: "sign-in from wrong app" }, 401, cors);
      user = claims.sub; // stable Google user id
    }

    // ---- optional per-user daily limit (needs the LIMITS KV binding) ----
    if (env.LIMITS) {
      const key = user + ":" + new Date().toISOString().slice(0, 10);
      const used = parseInt((await env.LIMITS.get(key)) || "0", 10);
      const max = parseInt(env.DAILY_LIMIT || "20", 10);
      if (used >= max)
        return json({ error: "daily limit reached (" + max + " pages) — try again tomorrow" }, 429, cors);
      await env.LIMITS.put(key, String(used + 1), { expirationTtl: 60 * 60 * 26 });
    }

    // ---- forward to Gemini with the hidden key --------------------------
    let body;
    try { body = await request.json(); } catch { return json({ error: "bad JSON" }, 400, cors); }
    const model = ALLOWED_MODELS.test(body.model || "") ? body.model : "gemini-3.1-flash-image";
    const upstream = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY },
        body: JSON.stringify({ contents: body.contents, generationConfig: body.generationConfig }),
      }
    );
    const text = await upstream.text();
    return new Response(text, { status: upstream.status, headers: { ...cors, "Content-Type": "application/json" } });
  },
};

function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), { status, headers: { ...cors, "Content-Type": "application/json" } });
}
