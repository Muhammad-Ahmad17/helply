# CI/CD

Single GitHub Actions pipeline:

1. **PR (`ci.yml`)** — typecheck, web build, Terraform fmt/validate
2. **Push to main (`deploy.yml`)** — test → build/push GHCR images → SSH deploy to OCI (embed, worker) then DO droplet → smoke tests
3. **Terraform (`terraform.yml`)** — plan on PR, apply on manual dispatch

## Required GitHub secrets

| Secret | Purpose |
|--------|---------|
| `DEPLOY_SSH_KEY` | SSH private key for all hosts |
| `DROPLET_HOST` | DO droplet IP |
| `OCI_EMBED_HOST` | OCI embed VM IP |
| `OCI_WORKER_HOST` | OCI worker VM IP |
| `DOMAIN` | Production domain for smoke tests |
| `VITE_CLERK_PUBLISHABLE_KEY` | SPA build arg |
| `VITE_APP_URL` | SPA build arg |
| `VITE_STRIPE_PUBLISHABLE_KEY` | SPA build arg |
| `DO_TOKEN` | Terraform apply |
| `POSTGRES_PASSWORD` / `REDIS_PASSWORD` | Terraform |

Each host needs the repo cloned at `~/ragify` with `.env` files from `deploy/do/.env.example` and `deploy/oci/.env.example`.
