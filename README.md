# Ragify

> Paste a URL → get an AI chatbot trained on that content → embed it anywhere with one line of code.

Monorepo: **apps/app** (Next.js + Caddy) · **apps/worker** (crawl + Redis) · **packages/core** (shared)

---

## Repo layout

```
ragify/
├── apps/app/          ← VM1: ragify.tech (Next.js + Caddy)
├── apps/worker/       ← VM2: Redis + crawl worker
├── packages/core/     ← shared crawler, embeddings, Supabase service
├── infra/             ← OCI scripts, bootstrap, Makefile
└── supabase/          ← DB migrations
```

---

## Quick start (local dev)

### 1. Create the three free accounts

| Service | What you'll get | Link |
| --- | --- | --- |
| **Supabase** | Postgres + auth + pgvector | https://supabase.com/dashboard/projects |
| **Groq** | Free LLM inference (Llama 3.3 70B) | https://console.groq.com/keys |
| **Jina AI** | Free embeddings (~1M tokens/mo) | https://jina.ai/?sui=apikey |

### 2. Set up the database

1. In Supabase, create a new project (any region, free tier).
2. Open **SQL Editor → New query**.
3. Paste the contents of [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) and click **Run**.
4. Open **Project Settings → API** and copy the three values you need into `.env.local` (see step 4 below).

### 3. Install & configure

```bash
npm install
cp apps/app/.env.example apps/app/.env.local
```

Fill in `apps/app/.env.local`:

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `GROQ_API_KEY`, `JINA_API_KEY`
- `NEXT_PUBLIC_APP_URL` — `http://localhost:3000` for dev

### 4. Run

```bash
npm run dev          # http://localhost:3000
npm run worker       # crawl worker (optional)
```

Open http://localhost:3000.

---

## First-bot walkthrough

1. Click **Get started** → enter your email → click the magic link in your inbox.
2. Click **New bot** → name it (e.g., "Tailwind docs") → paste a URL (e.g., `https://tailwindcss.com/docs/installation`) → **Create**.
3. On the bot page, go to **Sources** → the URL should already be there. Click the refresh icon to crawl it. (5–15 seconds.)
4. Go to **Embed code** tab → see your live preview iframe → copy the `<script>` snippet.
5. Paste the snippet into any HTML file or website to ship it.

---

## Deploy to Vercel (free)

1. Push this repo to GitHub.
2. https://vercel.com/new → import the repo.
3. Add the same env vars from `.env.local` (Vercel dashboard → Project → Settings → Environment Variables).
4. Set `NEXT_PUBLIC_APP_URL` to your production URL, e.g. `https://helply.aamad.app`.
5. Add your custom subdomain in **Settings → Domains**. Point a CNAME from your registrar to `cname.vercel-dns.com`.

After deploy, update Supabase **Authentication → URL Configuration → Site URL** to your production URL so magic-link redirects work.

---

## Tech stack

| Layer | Tool | Why |
| --- | --- | --- |
| Framework | Next.js 16 (App Router) | RSC, server actions, streaming |
| UI | React 19 + Tailwind CSS 4 | Modern, zero-config |
| DB | Supabase Postgres + pgvector | Free, RLS, vector search in SQL |
| Auth | Supabase magic links | No passwords, no OAuth setup |
| LLM | Groq Llama 3.3 70B | Free, ~10x faster than OpenAI |
| Embeddings | Jina AI v3 (1024-dim) | Free tier, task-specific quality |
| AI client | Vercel AI SDK v6 | Provider-agnostic streaming |
| Crawler | cheerio | No headless browser needed |
| Hosting | Vercel | Free for hobby/indie |

---

## Project structure

```
src/
├── app/
│   ├── page.tsx                  ← landing
│   ├── layout.tsx
│   ├── globals.css
│   ├── login/page.tsx            ← magic link
│   ├── auth/callback/route.ts    ← OAuth callback
│   ├── dashboard/
│   │   ├── layout.tsx            ← gated by middleware
│   │   ├── page.tsx              ← bot list
│   │   ├── actions.ts            ← server actions
│   │   └── bots/
│   │       ├── new/page.tsx
│   │       └── [id]/
│   │           ├── page.tsx
│   │           └── bot-detail.tsx
│   ├── api/
│   │   ├── chat/route.ts         ← streaming RAG chat (public, CORS)
│   │   ├── crawl/route.ts        ← ingest a URL (auth)
│   │   └── widget.js/route.ts    ← serves the embed script
│   └── embed/[botId]/
│       ├── layout.tsx
│       ├── page.tsx
│       └── chat-ui.tsx           ← iframe chat UI
├── lib/
│   ├── supabase/{client,server,service}.ts
│   ├── ai/{embeddings,chunk}.ts
│   ├── crawler.ts
│   ├── types.ts
│   └── utils.ts
└── middleware.ts                 ← auth refresh + /dashboard gate

supabase/migrations/0001_init.sql ← run this once in Supabase SQL editor
```

---

## Learn the stack as you go

See [LEARN.md](LEARN.md) — explains every modern-stack concept used in this repo (Server Components vs Client Components, Server Actions, RSC streaming, RLS, pgvector + HNSW, RAG pattern, Edge vs Node runtimes, etc.).

---

## What's next

This is the **MVP**. Things you'd add as you grow:

- [ ] Sitemap.xml multi-page crawl (currently one URL at a time)
- [ ] Lemon Squeezy webhook → automatic plan upgrades (Pakistan-friendly payments)
- [ ] Conversation viewer in dashboard
- [ ] Rate limiting on `/api/chat` (Upstash free tier)
- [ ] Custom domain support per bot
- [ ] Email transcripts (Resend free tier)
- [ ] Bring-your-own-LLM-key (premium tier feature)

---

## License

MIT — do what you want.
