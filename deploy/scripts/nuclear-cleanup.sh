#!/usr/bin/env bash
# Nuclear cleanup — run on a VM before first deploy of new stack
set -euo pipefail

echo "==> Stopping all containers..."
docker stop $(docker ps -aq) 2>/dev/null || true
docker rm $(docker ps -aq) 2>/dev/null || true

echo "==> Removing old compose stacks..."
docker compose -f ~/helply/docker-compose.yml down --remove-orphans 2>/dev/null || true
docker compose -f ~/helply/apps/app/docker-compose.yml down --remove-orphans 2>/dev/null || true
docker compose -f ~/helply/apps/worker/docker-compose.yml down --remove-orphans 2>/dev/null || true
docker compose -f ~/ragify/deploy/vm1/docker-compose.yml down --remove-orphans 2>/dev/null || true
docker compose -f ~/ragify/deploy/vm2/docker-compose.yml down --remove-orphans 2>/dev/null || true

docker network prune -f
docker system prune -af

echo "==> Done. Clone/pull ragify and deploy from deploy/vm1 or deploy/vm2."
