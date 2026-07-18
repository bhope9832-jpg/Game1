# Owner-key backend — "users just sign in and generate"

This turns the app into what big AI sites do: **one hidden key (yours) powers
everyone**, visitors never see keys or billing, and you can require Google
sign-in and cap each user's pages per day. Total setup ≈ 10 minutes.

## Step 1 — activate Google's $300 free trial credit (≈4 min)

1. Go to [aistudio.google.com/apikey](https://aistudio.google.com/apikey),
   create (or reuse) an API key.
2. Click the key's project → **Set up billing** → activate the **free trial**
   ($300 credit for new Google Cloud accounts). A generated page costs ~4¢, so
   the credit ≈ 7,000 pages. Nothing is charged until the credit is exhausted
   and you explicitly upgrade.

## Step 2 — deploy the worker on Cloudflare's free tier (≈5 min)

1. Create a free account at [dash.cloudflare.com](https://dash.cloudflare.com).
2. **Workers & Pages → Create → Worker**, name it (e.g. `comic-api`), deploy
   the hello-world, then **Edit code**: replace everything with `worker.js`
   from this folder and **Deploy**.
3. Worker **Settings → Variables and Secrets**:
   - Secret `GEMINI_API_KEY` = your key from step 1  (required)
   - Variable `ALLOWED_ORIGIN` = `https://YOURNAME.github.io`  (recommended)
4. Copy the worker URL, e.g. `https://comic-api.YOURNAME.workers.dev`.

## Step 3 — wire the app to it

Give the worker URL to Claude (or wire it yourself): add a "hosted" engine in
`index.html` that POSTs `{model, contents, generationConfig}` to the worker URL
instead of calling Google directly — the request/response shapes are identical
to the existing `callGemini()`, so it's a ~20-line change.

## Optional — require Google sign-in + daily limits

Without this, anyone who finds the worker URL can generate on your credit
(origin-locking already blocks other websites; this blocks abusive individuals).

1. [console.cloud.google.com/apis/credentials](https://console.cloud.google.com/apis/credentials)
   → **Create credentials → OAuth client ID → Web application**; add your site
   (`https://YOURNAME.github.io`) to *Authorized JavaScript origins*. Copy the
   client ID.
2. Worker variables: `REQUIRE_LOGIN` = `true`, `OAUTH_CLIENT_ID` = the client ID.
3. Per-user daily cap: create a KV namespace (**Storage & Databases → KV**),
   bind it to the worker as `LIMITS`, and optionally set `DAILY_LIMIT` (default 20).
4. The app then needs a **Sign in with Google** button (Google Identity
   Services) that sends the ID token as a Bearer header — ask Claude to wire
   it when you're ready.

## What stays free forever vs. what uses the credit

- Cloudflare Worker: free tier (100k requests/day) — effectively free forever.
- Google sign-in: free.
- Image generation: ~4¢/page from your $300 credit; when it runs out,
  generation stops with a clear error until you add funds (nothing auto-charges).
