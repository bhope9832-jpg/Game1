# VidForge — AI Video Generation Studio

A production-oriented, publicly accessible AI video generation SaaS in the spirit of Artlist's AI
Toolkit / Runway / Kling. Users generate videos with **Seedance 2.0** (via fal.ai) plus Kling 2.1,
Luma Dream Machine, and MiniMax Hailuo 02 — no API keys required on their side; all model calls run
server-side.

## Features

- **Text-to-Video & Image-to-Video** studio with drag-and-drop start frames
- **Model selector** — Seedance 2.0 (+ Fast variant), Kling 2.1, Luma Dream Machine, MiniMax Hailuo 02
- Full controls: prompt with character count, negative prompt, duration (4–15s), aspect ratio
  (16:9 / 9:16 / 1:1 / 4:3 / 21:9), resolution (480p / 720p), seed, camera motion
- **Live progress** (queued → generating → ready) via polling; result page with player, download,
  “Generate variation”, “Use as start frame” (frame capture), and public share links (`/v/[id]`)
- **Auth**: Google OAuth + email magic links (NextAuth.js v5, database sessions)
- **Credits**: 10-credit welcome bonus (sized so every model is affordable on day one) + free
  daily allowance (lazy refresh, no cron needed), paid balance, atomic deduction with automatic
  refund on failure, full audit trail (`CreditTransaction`)
- **Billing**: Stripe subscriptions (Starter / Pro / Unlimited) + one-time credit packs, webhook
  fulfillment with idempotency, customer portal
- **Storage**: completed videos are downloaded from fal and re-hosted on Cloudflare R2 (fal URLs are
  temporary); falls back to provider URLs in local dev
- **Safety & abuse protection**: prompt moderation blocklist, per-user rate limiting, server-side
  validation of every option and price
- **Teams**: shared workspaces with a pooled credit balance, roles (OWNER / ADMIN / MEMBER),
  email invites (auto-claimed on sign-up), member management, and a shared video feed
- **RBAC** (`lib/rbac.ts`): three layers — platform admin → team role → ownership — enforced in
  every API route, page, and server action
- **Platform Admin dashboard** (`/admin`, bootstrapped by `ADMIN_EMAILS`): full access to all
  users, teams, and generations; ban/unban, credit adjustments, promote/demote platform admins
- Dark-first responsive UI (Tailwind, shadcn-style components), skeleton loaders, toasts, empty
  states, prompt inspiration gallery

## Stack

Next.js 15 (App Router, TypeScript) · Tailwind CSS · Prisma + PostgreSQL · NextAuth.js v5 ·
Stripe · `@fal-ai/client` · Cloudflare R2 (S3 API) · deployable on Vercel.

## Setup

### 1. Install & configure

```bash
npm install
cp .env.example .env
```

Fill in `.env` (see the file for descriptions):

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL (Supabase/Neon/RDS) |
| `AUTH_SECRET` | `openssl rand -base64 32` |
| `AUTH_URL` / `NEXT_PUBLIC_APP_URL` | Deployment URL |
| `AUTH_GOOGLE_ID/SECRET` | Google OAuth credentials |
| `AUTH_RESEND_KEY`, `EMAIL_FROM` | Magic-link email via Resend |
| `FAL_KEY` | fal.ai API key (server-only) |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Stripe |
| `STRIPE_PRICE_*` | Price IDs for plans & credit packs |
| `R2_*` | Cloudflare R2 bucket for permanent video storage |
| `ADMIN_EMAILS` | Comma-separated admin emails |

### 2. Database

```bash
npx prisma db push        # dev; use `prisma migrate deploy` in production
```

### 3. Stripe

1. Create recurring prices for Starter/Pro/Unlimited and one-time prices for the credit packs; put
   their IDs in `.env`.
2. Point a webhook at `/api/webhooks/stripe` with events: `checkout.session.completed`,
   `invoice.paid`, `customer.subscription.created`, `customer.subscription.updated`,
   `customer.subscription.deleted`. Locally: `stripe listen --forward-to localhost:3000/api/webhooks/stripe`.

### 4. Run

```bash
npm run dev     # http://localhost:3000
npm run build && npm start   # production
```

### Smoke test: new-signup model access

With the dev server running, verify a brand-new account can use every model:

```bash
node --env-file=.env scripts/smoke-signup-access.mjs
```

It creates a throwaway user through the real onboarding path, checks the starting balance covers
every model's cheapest run, submits one generation per model, and confirms refunds — then cleans up.

## Roles & permissions

| Action | Personal owner | Team MEMBER | Team ADMIN | Team OWNER | Platform Admin |
| --- | --- | --- | --- | --- | --- |
| Generate (personal wallet) | ✅ | — | — | — | ✅ |
| Generate (team pool) | — | ✅ | ✅ | ✅ | ✅ |
| View team videos | — | ✅ | ✅ | ✅ | ✅ (all teams) |
| Delete a team video | creator only | own only | ✅ | ✅ | ✅ |
| Invite members / top up pool | — | — | ✅ | ✅ | ✅ |
| Change roles / rename / delete team | — | — | — | ✅ | ✅ |
| Ban users, adjust any wallet, promote admins | — | — | — | — | ✅ |

Platform admins are bootstrapped via `ADMIN_EMAILS` (applied at first sign-in) and can
promote/demote others from `/admin`. All checks live in `lib/rbac.ts`.

## Architecture notes

- **Model catalog** lives in `lib/models.ts` — endpoints, capabilities, and credit pricing per
  model. Verify fal endpoint slugs against https://fal.ai/models before deploying; adding a model
  is a one-file change.
- **Generation flow**: `POST /api/generate` validates options against the catalog, moderates the
  prompt, reserves credits atomically, then submits to the fal queue. The client polls
  `GET /api/generations/[id]`, which advances state, re-hosts the finished video to R2, and refunds
  credits automatically on failure — users only pay for successful videos.
- **Daily credits** refresh lazily on the first balance check of each UTC day (no cron required).
- **Rate limiting** (`lib/rate-limit.ts`) is in-memory; swap in Upstash Redis for multi-instance
  deployments (call sites unchanged).
- Secrets never reach the client: fal/Stripe/R2 clients are lazily constructed server-side only.

## API routes

| Route | Purpose |
| --- | --- |
| `POST /api/generate` | Submit a generation |
| `GET /api/generations` | Paginated history with filters |
| `GET/DELETE /api/generations/[id]` | Poll status / delete |
| `POST /api/upload` | Stage start-frame image |
| `GET /api/me` | Live credit balance |
| `POST /api/checkout` | Stripe Checkout (plan or pack) |
| `POST /api/billing/portal` | Stripe customer portal |
| `POST /api/webhooks/stripe` | Billing fulfillment |
| `/api/auth/*` | NextAuth |
