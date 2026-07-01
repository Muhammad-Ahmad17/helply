#!/usr/bin/env bash
# CI/CD deploy helper — SSH fan-out to OCI then DO.
set -euo pipefail

REMOTE_DIR="${REMOTE_DIR:-~/ragify}"
GIT_REF="${GIT_REF:-main}"

deploy_stack() {
  local host="$1"
  local label="$2"
  local script="$3"

  echo "==> Deploying ${label} on ${host}..."
  ssh -o StrictHostKeyChecking=accept-new "${host}" bash -s <<EOF
set -euo pipefail
cd ${REMOTE_DIR}
git fetch origin
git checkout ${GIT_REF}
git pull --ff-only origin ${GIT_REF} || true
${script}
EOF
}

EMBED_HOST="${OCI_EMBED_HOST:?Set OCI_EMBED_HOST}"
WORKER_HOST="${OCI_WORKER_HOST:?Set OCI_WORKER_HOST}"
DROPLET_HOST="${DROPLET_HOST:?Set DROPLET_HOST}"
EMBED_USER="${OCI_EMBED_USER:-ubuntu}"
WORKER_USER="${OCI_WORKER_USER:-ubuntu}"
DROPLET_USER="${DROPLET_USER:-root}"

deploy_stack "${EMBED_USER}@${EMBED_HOST}" "OCI embed" \
  "cd deploy/oci && docker compose -f docker-compose.embed.yml up -d --build"

deploy_stack "${WORKER_USER}@${WORKER_HOST}" "OCI worker" \
  "cd deploy/oci && docker compose -f docker-compose.worker.yml up -d --build"

deploy_stack "${DROPLET_USER}@${DROPLET_HOST}" "DO droplet" \
  "cd deploy/do && docker compose up -d --build"

echo "==> Deploy complete."
