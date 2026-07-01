# Ragify deployment (hybrid DO + OCI)

## Architecture

| Host | Path | Services |
|------|------|----------|
| DigitalOcean droplet | `deploy/do/` | Caddy, API, Postgres+pgvector, Redis, SPA |
| OCI embed VM | `deploy/oci/docker-compose.embed.yml` | Self-hosted embeddings |
| OCI worker VM | `deploy/oci/docker-compose.worker.yml` | BullMQ crawl worker |

## 1. Provision infrastructure

```bash
cd infra/terraform
cp terraform.tfvars.example terraform.tfvars
# Edit: DO token, domain, OCI public IPs, passwords
terraform init && terraform apply
```

Bootstrap each host once (as root):

```bash
sudo bash infra/bootstrap-vm.sh app     # DO droplet
sudo bash infra/bootstrap-vm.sh embed   # OCI embed VM
sudo bash infra/bootstrap-vm.sh worker  # OCI worker VM
```

## 2. Database

Postgres runs in Docker on the DO droplet. Migrations in `db/migrations/` are applied automatically on first `postgres` container start via `docker-entrypoint-initdb.d`.

To re-run manually:

```bash
docker compose -f deploy/do/docker-compose.yml exec postgres \
  psql -U ragify -d ragify -f /docker-entrypoint-initdb.d/001_init.sql
```

## 3. Configure environment

**DO droplet** (`deploy/do/.env`):

```bash
cp deploy/do/.env.example deploy/do/.env
# Set: DOMAIN, DATABASE_URL, REDIS_URL, CLERK_*, STRIPE_*, GROQ_*, EMBED_URL, etc.
```

**OCI worker** (`deploy/oci/.env`):

```bash
cp deploy/oci/.env.example deploy/oci/.env
# Point DATABASE_URL and REDIS_URL at DO droplet public IP (firewall allowlisted)
```

**OCI embed** — set `EMBED_API_KEY` in compose env or `.env` next to embed compose file.

## 4. Deploy

From your laptop:

```bash
make -C deploy deploy
make -C deploy verify
```

Or on each host after `git pull`:

```bash
# DO
cd ~/ragify/deploy/do && docker compose up -d --build

# OCI embed
cd ~/ragify/deploy/oci && docker compose -f docker-compose.embed.yml up -d --build

# OCI worker
cd ~/ragify/deploy/oci && docker compose -f docker-compose.worker.yml up -d --build
```

## 5. Cron jobs (optional)

Schedule on DO droplet or any host with `CRON_SECRET`:

```cron
*/5  * * * * curl -sf -H "Authorization: Bearer $CRON_SECRET" https://ragify.tech/api/cron/health-check
0    * * * * curl -sf -H "Authorization: Bearer $CRON_SECRET" https://ragify.tech/api/cron/quota-alerts
0    3 * * 0 curl -sf -H "Authorization: Bearer $CRON_SECRET" https://ragify.tech/api/cron/export-conversations
```

## 6. Backups

Enable nightly Postgres dumps to DO Spaces:

```bash
cd deploy/do
docker compose --profile backup up -d backup
```

Restore: `bash deploy/do/scripts/restore-pg.sh backups/ragify-TIMESTAMP.sql.gz`

## Troubleshooting

- **502 on /api/crawl** — worker can't reach DO Postgres/Redis; check Terraform firewall + `DATABASE_URL`/`REDIS_URL` on OCI worker.
- **Chat returns empty context** — check `EMBED_URL` from API to OCI embed VM (`curl http://embed-ip:8080/health`).
- **Smoke tests** — `bash deploy/scripts/verify.sh`
