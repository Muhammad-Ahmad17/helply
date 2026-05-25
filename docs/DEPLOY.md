# Self-host Ragify on Oracle Cloud (Docker + Caddy)

Two-VM microservices layout: **Vite SPA + Caddy edge + chat-api** on VM1, **Redis + worker + crawl-api + webhooks + cron** on VM2.

**Architecture**

| VM | Role | Services |
|----|------|----------|
| VM1 | Public edge | Caddy (TLS, rate limits, security headers) + static SPA + chat-api |
| VM2 | Private backend | Redis + crawl worker + crawl-api + webhooks + cron |

Managed services: **Supabase**, **Groq**, **Jina**.

```
Internet → Caddy (VM1)
            ├── /           → Vite SPA (static)
            ├── /api/chat   → chat-api (VM1)
            ├── /api/crawl  → crawl-api (VM2)
            ├── /api/webhooks → webhooks (VM2)
            └── /api/cron   → cron (VM2)
```

---

## Deploy paths

| Path | Purpose |
|------|---------|
| `deploy/vm1/` | VM1 docker-compose + Caddyfile |
| `deploy/vm2/` | VM2 docker-compose |
| `deploy/scripts/` | rewash + nuclear cleanup scripts |
| `deploy/Makefile` | Laptop deploy helpers |

Clone on both VMs at **`~/ragify`**.

---

## 5. Deploy VM2 (backend) — deploy first

```bash
ssh helply-worker
cd ~/ragify
git pull
cp deploy/vm2/.env.example deploy/vm2/.env
nano deploy/vm2/.env
cd deploy/vm2
docker compose up -d --build
docker compose ps
docker compose logs -f worker crawl-api
```

**VM2 `.env` minimum:**

```env
REDIS_BIND=10.0.2.46
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
JINA_API_KEY=jina_...
CRON_SECRET=...
WORKER_POLL_MS=60000
```

---

## 6. Deploy VM1 (edge + SPA + chat-api)

```bash
ssh helply-app
cd ~/ragify
git pull
cp deploy/vm1/.env.example deploy/vm1/.env
nano deploy/vm1/.env
cd deploy/vm1
docker compose up -d --build
docker compose ps
docker compose logs -f caddy chat-api
```

**VM1 `.env` minimum:**

```env
DOMAIN=ragify.tech
VM2_PRIVATE_IP=10.0.2.46
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_APP_URL=https://ragify.tech
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
GROQ_API_KEY=gsk_...
JINA_API_KEY=jina_...
REDIS_URL=redis://10.0.2.46:6379
RATE_LIMIT_SECRET=...
```

---

## Rewash (clean redeploy)

**VM1** (preserves TLS certs):

```bash
cd ~/ragify/deploy/vm1
bash ../scripts/rewash-vm1.sh
```

**VM2:**

```bash
cd ~/ragify/deploy/vm2
bash ../scripts/rewash-vm2.sh
```

**Nuclear cleanup** (both VMs — removes all containers/images):

```bash
bash ~/ragify/deploy/scripts/nuclear-cleanup.sh
```

**From laptop:**

```bash
make -C deploy rewash-all
make -C deploy deploy
make -C deploy status
```

---

## Auth (Supabase)

- Site URL: `https://ragify.tech`
- Redirect URLs: `https://ragify.tech/auth/callback`

---

## Smoke tests

```bash
curl -I https://ragify.tech
curl -I https://ragify.tech/api/chat   # OPTIONS or POST
curl https://ragify.tech/widget.js | head -5
```

See full OCI provisioning steps in sections 1–4 of the original runbook (unchanged).
