# Split Ragify into App + Worker (monorepo)

Goal: one Git repo, two deployable units — each VM clones the same repo but only builds/runs its folder.

```
ragify/                         ← single GitHub repo (helply)
├── apps/
│   ├── app/                    ← VM1: Next.js + Caddy
│   └── worker/                 ← VM2: Redis + crawl worker
├── packages/
│   └── core/                   ← shared crawl, embeddings, Supabase
├── infra/                      ← OCI scripts, bootstrap, deploy Makefile
├── supabase/migrations/        ← DB (shared, run once in Supabase)
└── package.json                ← npm workspaces root
```

---

## What goes where

### `apps/app` (VM1 — ragify.tech)

| Current path | New path |
|--------------|----------|
| `src/app/` (except cron crawl-worker if removed) | `apps/app/src/app/` |
| `src/components/` | `apps/app/src/components/` |
| `src/lib/` (app-only: rate-limit, security, quota-alerts, supabase client/server) | `apps/app/src/lib/` |
| `src/middleware.ts` | `apps/app/src/middleware.ts` |
| `Dockerfile` | `apps/app/Dockerfile` |
| `docker-compose.yml` | `apps/app/docker-compose.yml` |
| `Caddyfile` | `apps/app/Caddyfile` |
| `next.config.ts`, `tsconfig.json`, etc. | `apps/app/` |

**Env vars (VM1):** Supabase, Groq, Jina, Redis URL, DOMAIN, RATE_LIMIT_SECRET

### `apps/worker` (VM2 — private)

| Current path | New path |
|--------------|----------|
| `scripts/worker.ts` | `apps/worker/src/index.ts` |
| `Dockerfile.worker` | `apps/worker/Dockerfile` |
| `docker-compose.worker.yml` | `apps/worker/docker-compose.yml` |

**Env vars (VM2):** Supabase service role, JINA_API_KEY, REDIS_BIND only

**Does NOT need:** Groq, Next.js, Caddy, public DOMAIN

### `packages/core` (shared npm package)

Extract code used by **both** app and worker:

```
packages/core/src/
├── crawler.ts
├── crawl-worker.ts      ← claimAndProcessJobs, processSourceCrawl
├── ai/
│   ├── chunk.ts
│   └── embeddings.ts
├── supabase/
│   └── service.ts
├── log.ts
└── types.ts             ← CrawlJob, Bot types worker needs
```

Published locally as `@ragify/core` via npm workspaces.

App imports:
```ts
import { processSourceCrawl } from "@ragify/core/crawl-worker";
import { embedQuery } from "@ragify/core/ai/embeddings";
```

Worker imports:
```ts
import { claimAndProcessJobs } from "@ragify/core/crawl-worker";
```

### `infra/` (laptop / Cloud Shell only)

| Current path | New path |
|--------------|----------|
| `scripts/oci/` | `infra/oci/` |
| `scripts/bootstrap-vm.sh` | `infra/bootstrap-vm.sh` |
| `Makefile` | `infra/Makefile` |
| `docs/SELF_HOST.md` | `docs/SELF_HOST.md` (update paths) |

### Stays at repo root

- `supabase/migrations/` — one database for both
- `README.md` — links to apps
- Root `package.json` — workspaces only

---

## Target deploy commands

**VM1 (app):**
```bash
git clone https://github.com/Muhammad-Ahmad17/helply.git ~/ragify
cd ~/ragify/apps/app
cp .env.example .env   # fill in
docker compose up -d --build
```

**VM2 (worker):**
```bash
git clone https://github.com/Muhammad-Ahmad17/helply.git ~/ragify
cd ~/ragify/apps/worker
cp .env.example .env   # fill in
docker compose up -d --build
```

**Laptop deploy:**
```bash
make -C infra deploy-app
make -C infra deploy-worker
```

---

## Implementation steps (do in order)

### Phase 1 — Scaffold (no behavior change)

1. **Create root workspace `package.json`:**
   ```json
   {
     "name": "ragify",
     "private": true,
     "workspaces": ["apps/*", "packages/*"]
   }
   ```

2. **Create `packages/core/package.json`:**
   ```json
   {
     "name": "@ragify/core",
     "version": "0.1.0",
     "private": true,
     "main": "./src/index.ts",
     "types": "./src/index.ts",
     "exports": {
       "./*": "./src/*"
     },
     "dependencies": {
       "@supabase/supabase-js": "...",
       "cheerio": "...",
       "p-limit": "..."
     }
   }
   ```

3. **Move shared files** from `src/lib/` into `packages/core/src/` (list above).

4. **Create `apps/app/`** — move Next.js app files; update `tsconfig.json` paths:
   ```json
   "paths": {
     "@/*": ["./src/*"],
     "@ragify/core/*": ["../../packages/core/src/*"]
   }
   ```

5. **Create `apps/worker/`** with minimal `package.json`:
   ```json
   {
     "name": "@ragify/worker",
     "private": true,
     "scripts": { "start": "tsx src/index.ts" },
     "dependencies": { "@ragify/core": "*" }
   }
   ```

6. **Move `infra/`** — OCI scripts + Makefile; update paths inside Makefile:
   ```makefile
   REMOTE_APP_DIR ?= ~/ragify/apps/app
   REMOTE_WORKER_DIR ?= ~/ragify/apps/worker
   ```

### Phase 2 — Fix imports

7. In **app**: replace `@/lib/crawler`, `@/lib/crawl-worker`, `@/lib/ai/*` with `@ragify/core/...` where shared.

8. In **worker** `src/index.ts`: only import from `@ragify/core`.

9. Run `npm install` at repo root (links workspaces).

10. Run `npm run typecheck` in `apps/app` and `apps/worker`.

### Phase 3 — Docker

11. **`apps/app/Dockerfile`** — build context is `apps/app`, but must copy `packages/core`:
    ```dockerfile
    # Option A: build from repo root
    # docker compose build context: ../..  dockerfile: apps/app/Dockerfile

    # Option B (recommended): multi-stage from monorepo root
    COPY packages/core packages/core
    COPY apps/app apps/app
    WORKDIR apps/app
    RUN npm run build
    ```

12. **`apps/worker/Dockerfile`** — only copies `packages/core` + `apps/worker` (~200MB vs 1.7GB today).

13. Update **`apps/app/docker-compose.yml`** build context to monorepo root if needed.

### Phase 4 — VM migration

14. On **VM1:**
    ```bash
    cd ~/helply
    docker compose down
    git pull
    cd apps/app
    # move .env from ~/helply/.env to ~/helply/apps/app/.env
    docker compose up -d --build
    ```

15. On **VM2:**
    ```bash
    cd ~/helply
    docker compose -f docker-compose.worker.yml down
    git pull
    cd apps/worker
    # move .env
    docker compose up -d --build
    ```

16. Remove old root-level `docker-compose*.yml` after confirming both VMs work.

### Phase 5 — Cleanup

17. Delete moved files from old locations (`src/lib/crawler.ts` at root, root `Dockerfile.worker`, etc.).

18. Update `docs/SELF_HOST.md` paths.

19. Update `README.md` with monorepo layout.

---

## Optional: split into 2 GitHub repos later

When you want separate repos (not required now):

```bash
# From monorepo root — extract app repo
git subtree split --prefix=apps/app -b ragify-app-only
git push git@github.com:Muhammad-Ahmad17/ragify-app.git ragify-app-only:main

# Extract worker repo
git subtree split --prefix=apps/worker -b ragify-worker-only
git push git@github.com:Muhammad-Ahmad17/ragify-worker.git ragify-worker-only:main
```

For separate repos, publish `@ragify/core` as:
- GitHub npm package, or
- git dependency: `"@ragify/core": "github:Muhammad-Ahmad17/ragify-core"`

**Recommendation:** stay monorepo until you have paying users. One `git pull` updates both; shared types never drift.

---

## Before vs after (VM disk)

| | Today | After split |
|--|-------|-------------|
| VM1 clone | Full repo + builds worker image accidentally | `apps/app` only (~300MB image) |
| VM2 clone | Full repo + Next.js in node_modules | `apps/worker` + core (~250MB image) |
| Shared code | Duplicated via full `src/` copy in worker Dockerfile | `@ragify/core` package |

---

## Checklist

- [x] Phase 1: workspace + folders created
- [x] Phase 2: imports + typecheck pass
- [x] Phase 3: Docker builds from new paths
- [ ] Phase 4: VM1 + VM2 redeployed (your step)
- [x] Phase 5: old files removed, docs updated
- [ ] Supabase migrations unchanged (root `supabase/`)
- [ ] `ragify.tech` still serves app
- [ ] Worker logs show crawl jobs processing

---

## What NOT to split

| Keep shared | Reason |
|-------------|--------|
| `supabase/migrations/` | One database |
| Google OAuth / Supabase auth | App only, but config is central |
| `@ragify/core` | Avoid duplicating crawl + embed logic |
| `infra/oci/` | Provisions both VMs from one place |
