#!/usr/bin/env bash
# VM1 full rewash — preserves TLS certs in caddy_data volume
set -euo pipefail

cd "$(dirname "$0")/../vm1"

echo "==> Stopping VM1 stack..."
docker compose down --remove-orphans

echo "==> Pruning images and build cache..."
docker image prune -af
docker builder prune -af

echo "==> Rebuilding..."
docker compose build --no-cache

echo "==> Starting..."
docker compose up -d --force-recreate

echo "==> Status:"
docker compose ps

echo "==> Recent logs:"
docker compose logs --tail=30 caddy chat-api web-static
