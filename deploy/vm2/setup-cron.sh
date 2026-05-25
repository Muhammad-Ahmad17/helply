#!/usr/bin/env bash
# Install VM2 crontab entries for Ragify cron endpoints.
# Run once on helply-worker after deploy/vm2/.env is configured.
#
# Usage: bash deploy/vm2/setup-cron.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/.env"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing ${ENV_FILE} — copy from .env.example first."
  exit 1
fi

# shellcheck disable=SC1090
source "$ENV_FILE"

if [[ -z "${CRON_SECRET:-}" ]]; then
  echo "CRON_SECRET is not set in ${ENV_FILE}"
  exit 1
fi

DOMAIN="${DOMAIN:-ragify.tech}"
BASE="https://${DOMAIN}/api/cron"
AUTH="Authorization: Bearer ${CRON_SECRET}"

CRON_FILE="$(mktemp)"
crontab -l 2>/dev/null | grep -v "ragify.tech/api/cron" > "$CRON_FILE" || true

cat >> "$CRON_FILE" <<EOF
# Ragify cron jobs (managed by deploy/vm2/setup-cron.sh)
*/5 * * * * curl -sf -H "${AUTH}" "${BASE}/health-check" >/dev/null 2>&1 || logger "ragify health-check failed"
*/10 * * * * curl -sf -H "${AUTH}" "${BASE}/crawl-worker" >/dev/null 2>&1 || logger "ragify crawl-worker failed"
0 3 * * 0 curl -sf -H "${AUTH}" "${BASE}/export-conversations" >/dev/null 2>&1 || logger "ragify export failed"
0 * * * * curl -sf -H "${AUTH}" "${BASE}/quota-alerts" >/dev/null 2>&1 || logger "ragify quota-alerts failed"
EOF

crontab "$CRON_FILE"
rm -f "$CRON_FILE"

echo "Crontab installed:"
crontab -l | grep ragify.tech || true
