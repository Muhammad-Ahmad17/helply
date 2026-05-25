# Ragify

> Paste a URL → get an AI chatbot trained on that content → embed it anywhere with one line of code.

Microservices monorepo: **Vite SPA** · **Hono APIs** · **Caddy edge** · **@ragify/core**

---

## Repo layout

```
ragify/
├── apps/web/              ← Vite/React SPA (dashboard, embed, marketing)
├── services/
│   ├── chat-api/          ← streaming RAG chat (VM1)
│   ├── crawl-api/         ← crawl enqueue (VM2)
│   ├── webhooks/          ← Lemon Squeezy (VM2)
│   ├── cron/              ← health, export, crawl fallback (VM2)
│   └── worker/            ← background crawl poller (VM2)
├── packages/core/         ← shared crawler, embeddings, types
├── deploy/
│   ├── vm1/               ← Caddy + SPA + chat-api
│   └── vm2/               ← Redis + backend services
├── infra/                 ← OCI scripts, bootstrap
└── supabase/              ← DB migrations
```

---

## Quick start (local dev)

```bash
npm install
cp apps/web/.env.example apps/web/.env.local
# Fill VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_APP_URL

npm run dev              # SPA at http://localhost:5173
npm run dev:chat         # chat-api at :3001 (separate terminal)
npm run dev:crawl        # crawl-api at :3002 (separate terminal)
npm run worker           # crawl worker poller
```

---

## Production deploy

See **[docs/DEPLOY.md](docs/DEPLOY.md)** for Oracle Cloud 2-VM setup.

```bash
# From laptop
make -C deploy deploy      # git pull + compose up on both VMs
make -C deploy rewash-all  # full rebuild both VMs
make -C deploy status
```

On each VM:

```bash
cd ~/ragify/deploy/vm1 && docker compose up -d --build   # VM1
cd ~/ragify/deploy/vm2 && docker compose up -d --build   # VM2
```

---

## Environment variables

| Service | Key vars |
|---------|----------|
| **web (build)** | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_APP_URL` |
| **chat-api** | `GROQ_API_KEY`, `JINA_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `REDIS_URL` |
| **crawl-api** | `SUPABASE_*`, `JINA_API_KEY`, `SUPABASE_ANON_KEY` (JWT auth) |
| **worker** | `SUPABASE_*`, `JINA_API_KEY` |
| **Caddy** | `DOMAIN`, `VM2_PRIVATE_IP` |

Copy from `deploy/vm1/.env.example` and `deploy/vm2/.env.example`.

---

## Scripts

```bash
npm run typecheck    # all workspaces
npm run build        # Vite SPA production build
```
