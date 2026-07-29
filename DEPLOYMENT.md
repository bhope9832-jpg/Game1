# Deploying VidForge to Vercel

Follow these steps top to bottom. Steps 1–5 get you a live site you can sign
into (~15 minutes); steps 6–8 turn on generation, billing, and permanent video
storage and can be done later.

## 1. Database (Neon — free tier)

1. Create an account at https://neon.tech and create a project.
2. Copy the **connection string** (`postgresql://...`). That's `DATABASE_URL`.

(Supabase works identically: Project Settings → Database → connection string,
use the "Transaction" pooler URL.)

## 2. Google OAuth

1. Go to https://console.cloud.google.com/apis/credentials → **Create
   Credentials → OAuth client ID → Web application**.
2. Authorized redirect URI: `https://YOUR-DOMAIN.vercel.app/api/auth/callback/google`
   (add `http://localhost:3000/api/auth/callback/google` too for local dev).
3. Copy the client ID and secret → `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`.

## 3. Import the repo into Vercel

1. https://vercel.com/new → import `bhope9832-jpg/Game1`, branch
   `claude/ai-video-generation-saas-pzo7og` (or merge to `main` first).
2. Framework preset: **Next.js** — the defaults are correct
   (`npm run build` already runs `prisma generate`).

## 4. Environment variables (Vercel → Project → Settings → Environment Variables)

Required to launch:

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | from step 1 |
| `AUTH_SECRET` | run `openssl rand -base64 32` |
| `AUTH_URL` | `https://YOUR-DOMAIN.vercel.app` |
| `NEXT_PUBLIC_APP_URL` | `https://YOUR-DOMAIN.vercel.app` |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | from step 2 |
| `ADMIN_EMAILS` | `adam@sharpautoglass.net` |
| `UNLIMITED_EMAILS` | `adam@sharpautoglass.net` |

`ADMIN_EMAILS` makes your account a **platform admin** on first sign-in.
`UNLIMITED_EMAILS` gives your account **unlimited access — every model, zero
credit charges** — and no one else. Both are checked live, so they apply even
if you signed up before setting them.

## 5. Create the tables & deploy

From your machine (or the Vercel build command once):

```bash
DATABASE_URL="postgresql://..." npx prisma db push
```

Then **Deploy**. Sign in with your Google account — you should see the
`∞ Unlimited` badge in the navbar and the Admin link. That's the site live.

## 6. Generation (fal.ai)

1. Create an API key at https://fal.ai/dashboard/keys → `FAL_KEY`.
2. Verify the endpoint slugs in `lib/models.ts` against https://fal.ai/models
   (Seedance 2.0 IDs are set per spec; confirm they match fal's catalog).

## 7. Billing (Stripe) — optional until you want paid plans

1. Create 3 recurring prices (Starter/Pro/Unlimited) and 2 one-time prices
   (credit packs) → fill the five `STRIPE_PRICE_*` vars.
2. `STRIPE_SECRET_KEY` from the API keys page.
3. Webhook: endpoint `https://YOUR-DOMAIN.vercel.app/api/webhooks/stripe`,
   events: `checkout.session.completed`, `invoice.paid`,
   `customer.subscription.created`, `customer.subscription.updated`,
   `customer.subscription.deleted` → copy signing secret to
   `STRIPE_WEBHOOK_SECRET`.

## 8. Permanent video storage (Cloudflare R2) — recommended before real traffic

fal.ai result URLs are temporary; R2 re-hosts finished videos permanently.

1. Cloudflare dashboard → R2 → create bucket `vidforge-videos`.
2. Create an R2 API token (Object Read & Write) → `R2_ACCESS_KEY_ID` /
   `R2_SECRET_ACCESS_KEY`; account ID → `R2_ACCOUNT_ID`.
3. Enable public access (custom domain or r2.dev) → `R2_PUBLIC_URL`.

Until R2 is configured the app falls back to the temporary fal URLs — fine for
testing, not for production.

## Post-deploy checklist

- [ ] Sign in → navbar shows `∞ Unlimited` and the **Admin** link
- [ ] `/admin` loads and lists your user with the `platform admin` role
- [ ] Generate a test video in the Studio (needs `FAL_KEY`)
- [ ] `/pricing` checkout redirects to Stripe (if configured)
- [ ] Completed video URL points at your R2 domain (if configured)
