# Self-host Helply on Oracle Cloud (Docker + Caddy)

Step-by-step runbook to migrate Helply from Vercel Hobby to **two Oracle Cloud Free VMs** using Docker and Caddy (automatic HTTPS).

**Architecture**

| VM | Role | Services |
|----|------|----------|
| VM1 | Public app | Next.js + Caddy (ports 80/443) |
| VM2 | Private worker | Redis + crawl worker |

Managed services you keep: **Supabase** (DB/auth), **Groq** (LLM), **Jina** (embeddings).

---

## Table of contents

1. [Prerequisites](#1-prerequisites)
2. [Oracle Cloud setup](#2-oracle-cloud-setup)
3. [Bootstrap both VMs](#3-bootstrap-both-vms)
4. [Generate secrets](#4-generate-secrets)
5. [Deploy VM2 (worker + Redis)](#5-deploy-vm2-worker--redis)
6. [Deploy VM1 (app + Caddy)](#6-deploy-vm1-app--caddy)
7. [Domain and DNS](#7-domain-and-dns)
8. [Auth and OAuth redirects](#8-auth-and-oauth-redirects)
9. [Smoke tests](#9-smoke-tests)
10. [Day-2 operations](#10-day-2-operations)
11. [Deploy updates (no CI/CD yet)](#11-deploy-updates-no-cicd-yet)
12. [Troubleshooting](#12-troubleshooting)

---

## 1. Prerequisites

On your **local machine**:

- SSH key pair (`~/.ssh/id_ed25519` or similar)
- Git
- Domain purchased (Cloudflare Registrar ~$10/yr recommended)
- This repo cloned locally

**Accounts / keys you need:**

| Service | What you need |
|---------|---------------|
| Oracle Cloud | Free tier account |
| Supabase | Project URL + anon key + service role key |
| Groq | API key |
| Jina | API key |
| Google OAuth | Client ID (if using Google login) |

---

## 2. Oracle Cloud setup

**Terminal provisioning (recommended):** use the OCI CLI scripts in [`infra/oci/README.md`](../infra/oci/README.md):

```bash
cp infra/oci/env.example infra/oci/env.local   # fill compartment + region
bash infra/oci/provision-all.sh                  # VCN + policies + both VMs
bash infra/oci/verify-instances.sh               # SSH requirement check
```

Or follow the manual Console steps below.

Oracle has **two firewalls**. You must configure both.

### 2.1 Create a VCN

1. Oracle Console → **Networking** → **Virtual cloud networks** → **Create VCN**
2. Name: `helply-vcn`, CIDR: `10.0.0.0/16`
3. Use the wizard defaults (public + private subnet)

### 2.2 Create VM1 (App)

1. **Compute** → **Instances** → **Create instance**
2. Name: `helply-app`
3. Image: **Ubuntu 24.04** (or 22.04)
4. Shape: **Ampere A1** (4 OCPU / 24 GB) if available, else **VM.Standard.E2.1.Micro** (1 GB)
5. Networking: your VCN, **public subnet**, assign **public IPv4**
6. SSH key: paste your public key
7. Create

Note VM1 **public IP** and **private IP** (e.g. `10.0.0.12`).

### 2.3 Create VM2 (Worker)

Same steps, name `helply-worker`, **public subnet** (for SSH only), note **private IP** (e.g. `10.0.0.13`).

### 2.4 Security List (VCN firewall)

**Networking** → your VCN → **Security Lists** → Default Security List:

| Rule | Source | Protocol | Port | Notes |
|------|--------|----------|------|-------|
| Ingress | `0.0.0.0/0` | TCP | 22 | SSH (both VMs) |
| Ingress | `0.0.0.0/0` | TCP | 80 | HTTP — VM1 only |
| Ingress | `0.0.0.0/0` | TCP | 443 | HTTPS — VM1 only |
| Ingress | `10.0.0.0/16` | TCP | 6379 | Redis — VM1 → VM2 only |

Do **not** open 6379 to the public internet.

### 2.5 Instance iptables (Oracle quirk)

Oracle images ship with host-level iptables that block traffic even when the Security List allows it.

SSH into **VM1**:

```bash
ssh ubuntu@<VM1_PUBLIC_IP>

# Allow HTTP/HTTPS through host firewall
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save
```

Repeat on VM2 for port 6379 from VM1 private IP only (optional if using UFW + compose bind):

```bash
sudo iptables -I INPUT -s 10.0.0.12 -p tcp --dport 6379 -j ACCEPT
sudo netfilter-persistent save
```

Replace `10.0.0.12` with VM1's private IP.

### 2.6 SSH config (local machine)

Add to `~/.ssh/config`:

```
Host helply-app
  HostName <VM1_PUBLIC_IP>
  User ubuntu
  IdentityFile ~/.ssh/id_ed25519

Host helply-worker
  HostName <VM2_PUBLIC_IP>
  User ubuntu
  IdentityFile ~/.ssh/id_ed25519
```

Test: `ssh helply-app` and `ssh helply-worker`.

---

## 3. Bootstrap both VMs

The bootstrap script installs Docker, swap, UFW, fail2ban, and hardens SSH.

**VM1 (app):**

```bash
ssh helply-app
git clone https://github.com/Muhammad-Ahmad17/helply.git ~/ragify
cd ~/ragify
sudo bash infra/bootstrap-vm.sh app
```

**VM2 (worker):**

```bash
ssh helply-worker
git clone https://github.com/YOUR_USER/helply.git ~/ragify
cd ~/ragify
sudo bash infra/bootstrap-vm.sh worker
```

Log out and back in so the `docker` group applies:

```bash
exit
ssh helply-app
docker ps   # should work without sudo
```

---

## 4. Generate secrets

Run once on your laptop:

```bash
openssl rand -hex 32   # RATE_LIMIT_SECRET
openssl rand -hex 32   # CRON_SECRET
```

Save these in a password manager. You will paste them into `.env` on both VMs.

---

## 5. Deploy VM2 (worker + Redis)

SSH to VM2:

```bash
ssh helply-worker
cd ~/ragify/apps/worker
cp .env.example .env
nano .env
```

**VM2 `.env`** — see `apps/worker/.env.example`. Minimum:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
JINA_API_KEY=jina_...
REDIS_BIND=10.0.0.13
WORKER_POLL_MS=60000
WORKER_BATCH_SIZE=5
```

Start services:

```bash
docker compose up -d --build
docker compose ps
docker compose logs -f worker
```

Verify Redis from VM1 (after VM1 is bootstrapped):

```bash
ssh helply-app
redis-cli -h 10.0.0.13 ping
# PONG
```

If `redis-cli` is not installed: `sudo apt install redis-tools`.

---

## 6. Deploy VM1 (app + Caddy)

SSH to VM1:

```bash
ssh helply-app
cd ~/ragify/apps/app
cp .env.example .env
nano .env
```

**VM1 `.env`** (full production):

```env
# --- Supabase ---
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# --- Groq ---
GROQ_API_KEY=gsk_...
GROQ_MODEL=llama-3.3-70b-versatile

# --- Jina ---
JINA_API_KEY=jina_...

# --- App URL (your domain — set before first HTTPS request) ---
NEXT_PUBLIC_APP_URL=https://ragify.tech
DOMAIN=ragify.tech

# --- Redis on VM2 (private IP) ---
REDIS_URL=redis://10.0.0.13:6379

# --- Security ---
RATE_LIMIT_SECRET=<openssl rand -hex 32>
CRON_SECRET=<openssl rand -hex 32>

# --- Optional ---
# DISABLE_RATE_LIMIT=false
# LEMON_WEBHOOK_SECRET=
# NEXT_PUBLIC_SENTRY_DSN=
# RESEND_API_KEY=
# RESEND_FROM_EMAIL=Ragify <notifications@yourdomain.com>
```

Build and start:

```bash
docker compose up -d --build
docker compose ps
docker compose logs -f
```

Caddy will request a Let's Encrypt certificate once DNS points to this VM (next section).

---

## 7. Domain and DNS

1. Buy domain at Cloudflare (or any registrar).
2. Add an **A record**:
   - Name: `helply` (or `@` for apex)
   - Content: **VM1 public IP**
   - TTL: Auto
3. **Important for first cert:** set Cloudflare proxy to **DNS only** (grey cloud) until HTTPS works.
4. Wait 5–15 minutes for DNS propagation.
5. Visit `https://helply.yourdomain.com` — Caddy provisions the cert automatically.
6. After HTTPS works, optionally enable Cloudflare proxy (orange cloud) for DDoS protection.

Update bot **Allowed domains** in the dashboard: add `https://helply.yourdomain.com`.

---

## 8. Auth and OAuth redirects

### Supabase

Dashboard → **Authentication** → **URL configuration**:

- Site URL: `https://helply.yourdomain.com`
- Redirect URLs: add `https://helply.yourdomain.com/auth/callback`

### Google OAuth (if enabled)

Google Cloud Console → Credentials → OAuth client:

- Authorized redirect URI: `https://YOUR_PROJECT.supabase.co/auth/v1/callback` (Supabase handles this)
- Also ensure Supabase Google provider is enabled with your client ID/secret

---

## 9. Smoke tests

```bash
# Health — should return HTML
curl -I https://helply.yourdomain.com

# Login page
curl -s https://helply.yourdomain.com/login | head

# Chat API (replace bot ID)
curl -N -X POST https://helply.yourdomain.com/api/chat \
  -H "Content-Type: application/json" \
  -H "Origin: https://helply.yourdomain.com" \
  -d '{"botId":"YOUR-BOT-UUID","messages":[{"role":"user","content":"hello"}]}'
```

Browser checks:

1. Open `https://helply.yourdomain.com/login` — Google OAuth works
2. Create/open a bot, add allowed domain
3. Open embed: `https://helply.yourdomain.com/embed/YOUR-BOT-ID`
4. Send several messages — no 504 errors
5. Trigger a crawl — worker on VM2 should process jobs in logs

---

## 10. Day-2 operations

### View logs

```bash
# VM1
ssh helply-app 'cd ~/ragify/apps/app && docker compose logs -f --tail=100'

# VM2 worker
ssh helply-worker 'cd ~/ragify/apps/worker && docker compose logs -f worker'
```

### Restart

```bash
ssh helply-app 'cd ~/ragify/apps/app && docker compose restart'
ssh helply-worker 'cd ~/ragify/apps/worker && docker compose restart'
```

### Roll back

```bash
ssh helply-app 'cd ~/ragify && git log --oneline -5'
ssh helply-app 'cd ~/ragify && git checkout <previous-commit> && docker compose up -d --build'
```

### Backups

- **Supabase**: use built-in backups (Dashboard → Database → Backups)
- **Redis**: cache/rate-limit only — no backup needed
- **Caddy certs**: stored in Docker volume `caddy_data` — persists across restarts

### Memory (1 GB VMs)

If the app OOMs during `docker compose build`:

```bash
# Build with swap (bootstrap script adds 2G swap)
docker compose build --no-cache
# Or build locally and push image to a registry (advanced)
```

---

## 11. Deploy updates (no CI/CD yet)

**Recommended for solo dev:** one-time SSH deploy via Makefile.

On your laptop (after `git push`):

```bash
# ~/.ssh/config must have helply-app and helply-worker hosts
make deploy
```

Or manually:

```bash
ssh helply-app  'cd ~/ragify && git pull && cd apps/app && docker compose up -d --build'
ssh helply-worker 'cd ~/ragify && git pull && cd apps/worker && docker compose up -d --build'
```

**When to add CI/CD:** after ~10 deploys/week or when you have paying users. A GitHub Action with `appleboy/ssh-action` (~20 lines) can replace `make deploy` later.

---

## 12. Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Connection refused on 443 | Oracle iptables or Security List | Open 443 in both; run iptables rules from §2.5 |
| Caddy cert failed | DNS not pointing to VM1, or Cloudflare proxy on | Grey-cloud DNS; wait for propagation |
| 502 Bad Gateway | Next.js container not running | `docker compose logs web` on VM1 |
| Chat works but no RAG context | Jina timeout or no chunks | Check JINA_API_KEY; re-crawl sources |
| Rate limit not working | REDIS_URL wrong | `redis-cli -h VM2_IP ping` from VM1 |
| Worker not processing jobs | crawl_jobs migration missing | Run `0004_crawl_jobs.sql` in Supabase |
| OOM during build | 1 GB RAM | Ensure swap exists; build off-peak |
| Origin not allowed (403) | Domain not in bot settings | Add full origin URL in bot Settings |
| OAuth redirect to localhost | NEXT_PUBLIC_APP_URL wrong | Set to production domain in VM1 `.env`, rebuild |

### Useful commands

```bash
# Disk space
df -h

# Docker resource usage
docker stats --no-stream

# Caddy cert status
docker compose exec caddy caddy list-certificates

# Test Redis from VM1
redis-cli -h <VM2_PRIVATE_IP> ping
```

---

## What you gain vs Vercel Hobby

| | Vercel Hobby | Self-hosted |
|--|--------------|-------------|
| Chat timeout | ~10s → 504 | 60s+ |
| Crawl depth | 2 pages, 15 chunks | 50 pages inline + worker queue |
| Cron | Once/day | Worker polls every 60s |
| Cold starts | Yes | No (always-on) |
| HTTPS | Automatic | Caddy automatic |
| Cost | $0 | $0 (Oracle free tier) + domain |

---

## File reference

| File | Purpose |
|------|---------|
| `apps/app/Dockerfile` | Next.js standalone app image |
| `apps/worker/Dockerfile` | Crawl worker image |
| `apps/app/docker-compose.yml` | VM1: web + caddy |
| `apps/worker/docker-compose.yml` | VM2: redis + worker |
| `apps/app/Caddyfile` | Auto HTTPS reverse proxy |
| `infra/bootstrap-vm.sh` | One-time VM hardening |
| `apps/worker/src/index.ts` | Background crawl job poller |
| `infra/Makefile` | `make -C infra deploy` from laptop |
| `packages/core/` | Shared crawler, embeddings, Supabase |

---

*Save this doc and follow section-by-section tomorrow. No rush — each section is independent after VMs exist.*
