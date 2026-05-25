#!/usr/bin/env bash
# External uptime probe — run from laptop, cron, or UptimeRobot webhook host.
# Exit 0 when healthy, 1 when any check fails.
set -euo pipefail

DOMAIN="${DOMAIN:-ragify.tech}"
CRON_SECRET="${CRON_SECRET:-}"

fail=0

check() {
  local name="$1"
  local url="$2"
  local expect="${3:-200}"
  local code
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 15 "$url" || echo "000")
  if [[ "$code" != "$expect" ]]; then
    echo "FAIL ${name}: HTTP ${code} (expected ${expect})"
    fail=1
  else
    echo "OK   ${name}: HTTP ${code}"
  fi
}

check "homepage" "https://${DOMAIN}/"
check "widget" "https://${DOMAIN}/widget.js"
check "chat-options" "https://${DOMAIN}/api/chat" "204"

if [[ -n "$CRON_SECRET" ]]; then
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 20 \
    -H "Authorization: Bearer ${CRON_SECRET}" \
    "https://${DOMAIN}/api/cron/health-check" || echo "000")
  if [[ "$code" != "200" ]]; then
    echo "FAIL cron-health: HTTP ${code} (expected 200)"
    fail=1
  else
    echo "OK   cron-health: HTTP ${code}"
  fi
else
  echo "SKIP cron-health (set CRON_SECRET to enable)"
fi

exit "$fail"
