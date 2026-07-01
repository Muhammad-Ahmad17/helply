# Ragify

> Paste a URL → get an AI chatbot trained on that content → embed it anywhere with one line of code.

**Modular monolith** · **Vite SPA** · **Hono API** · **BullMQ worker** · **Self-hosted embeddings** · **Hybrid DO + OCI**

---

## Architecture

| Component | Host | Role |
|-----------|------|------|
| `apps/web` | DO droplet (Caddy) | React dashboard + embed widget |
| `apps/api` | DO droplet | Modular monolith (chat, crawl, billing, admin, cron) |
| Postgres + pgvector + Redis | DO droplet | Data + BullMQ queue |
| `apps/embed` | OCI free VM | Self-hosted `bge-small-en-v1.5` embeddings (384-dim, free) |
| `apps/worker` | OCI free VM | BullMQ crawl/embed/index worker |

Auth: **Clerk** · Billing: **Stripe** · LLM: **Groq** · Observability: **Sentry + Datadog**

---

## Repo layout

```
ragify/
├── apps/
│   ├── web/           ← Vite/React SPA
│   ├── api/           ← Modular monolith (Hono)
│   ├── embed/         ← transformers.js embedding service
│   └── worker/        ← BullMQ crawl worker
├── packages/core/     ← Shared crawler, chunk, db, queue, zyte
├── db/migrations/     ← Postgres schema (384-dim vectors)
├── deploy/
│   ├── do/            ← DO droplet compose (Caddy, API, Postgres, Redis)
│   └── oci/           ← OCI compose (embed + worker)
├── infra/terraform/   ← DO droplet + OCI VMs + firewall + Spaces
└── .github/workflows/ ← ci.yml, deploy.yml, terraform.yml
```

---

## Local dev

```bash
npm install
cp apps/web/.env.example apps/web/.env.local
cp deploy/do/.env.example deploy/do/.env   # for reference

# Start Postgres + Redis (or use docker compose in deploy/do)
npm run dev              # SPA at :5173
npm run dev:api          # API at :3000
npm run dev:embed        # Embed service at :8080
npm run dev:worker       # BullMQ worker
```

Set `EMBED_URL=http://localhost:8080` and `DATABASE_URL` / `REDIS_URL` in your environment.

---

## Deploy

```bash
# Terraform (DO + OCI)
cd infra/terraform && cp terraform.tfvars.example terraform.tfvars
terraform init && terraform apply

# Manual deploy
make -C deploy deploy
make -C deploy verify
```

See **[docs/DEPLOY.md](docs/DEPLOY.md)** and **[docs/CICD.md](docs/CICD.md)**.

---

## Scripts

```bash
npm run typecheck
npm run build
bash deploy/scripts/verify.sh
```
