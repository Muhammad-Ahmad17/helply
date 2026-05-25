#!/usr/bin/env bash
# Post-deploy verification — run from laptop after rewash-all
set -euo pipefail

DOMAIN="${DOMAIN:-ragify.tech}"

echo "==> HTTPS homepage"
curl -sfI "https://${DOMAIN}" | head -5

echo "==> Widget script"
curl -sf "https://${DOMAIN}/widget.js" | head -3

echo "==> Chat API OPTIONS"
curl -sfI -X OPTIONS "https://${DOMAIN}/api/chat" | head -5

echo "==> Bots API (expect 404 for fake id, not 500)"
bots_status=$(curl -s -o /dev/null -w "%{http_code}" "https://${DOMAIN}/api/bots/00000000-0000-0000-0000-000000000001")
if [ "$bots_status" = "500" ]; then
  echo "FAIL: /api/bots returned 500 — check chat-api env (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)"
  exit 1
fi
echo "OK: /api/bots returned ${bots_status}"

echo "==> Crawl API via Caddy (expect 401 without auth, NOT 502)"
crawl_status=$(curl -s -o /dev/null -w "%{http_code}" -X POST "https://${DOMAIN}/api/crawl" \
  -H "Content-Type: application/json" -d '{"botId":"00000000-0000-0000-0000-000000000001"}')
if [ "$crawl_status" = "502" ]; then
  echo "FAIL: /api/crawl returned 502 — VM1 cannot reach VM2:3002"
  echo "      Fix OCI security list (ports 3002-3004 from VCN) and check: docker compose ps on VM2"
  exit 1
fi
echo "OK: /api/crawl returned ${crawl_status}"

echo "==> All checks passed for ${DOMAIN}"
