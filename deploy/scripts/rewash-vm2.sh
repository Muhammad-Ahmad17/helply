#!/usr/bin/env bash
# VM2 full rewash
set -euo pipefail

cd "$(dirname "$0")/../vm2"

echo "==> Stopping VM2 stack..."
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
docker compose logs --tail=30 worker crawl-api redis
