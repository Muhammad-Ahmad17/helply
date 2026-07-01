#!/usr/bin/env bash
# Stop all Ragify containers and prune Docker on a host.
set -euo pipefail

echo "==> Stopping Ragify stacks..."
docker compose -f ~/ragify/deploy/do/docker-compose.yml down --remove-orphans 2>/dev/null || true
docker compose -f ~/ragify/deploy/oci/docker-compose.embed.yml down --remove-orphans 2>/dev/null || true
docker compose -f ~/ragify/deploy/oci/docker-compose.worker.yml down --remove-orphans 2>/dev/null || true

echo "==> Pruning unused Docker resources..."
docker system prune -af

echo "==> Done. Clone/pull ragify and deploy from deploy/do or deploy/oci."
