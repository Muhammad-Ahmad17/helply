#!/usr/bin/env bash
# Post-deploy smoke tests for Ragify hybrid stack.
set -euo pipefail

DOMAIN="${DOMAIN:-ragify.tech}"
BASE="https://${DOMAIN}"

echo "=== Ragify smoke tests (${DOMAIN}) ==="

code=$(curl -s -o /dev/null -w "%{http_code}" "${BASE}/")
[[ "$code" == "200" ]] || { echo "FAIL: homepage HTTP $code"; exit 1; }
echo "OK: homepage"

code=$(curl -s -o /dev/null -w "%{http_code}" "${BASE}/widget.js")
[[ "$code" == "200" ]] || { echo "FAIL: widget.js HTTP $code"; exit 1; }
echo "OK: widget.js"

code=$(curl -s -o /dev/null -w "%{http_code}" -X OPTIONS "${BASE}/api/chat")
[[ "$code" == "204" ]] || { echo "FAIL: chat OPTIONS HTTP $code"; exit 1; }
echo "OK: chat OPTIONS"

code=$(curl -s -o /dev/null -w "%{http_code}" "${BASE}/api/bots/00000000-0000-0000-0000-000000000001")
[[ "$code" != "500" ]] || { echo "FAIL: /api/bots returned 500"; exit 1; }
echo "OK: /api/bots returned ${code}"

code=$(curl -s -o /dev/null -w "%{http_code}" "${BASE}/api/health" 2>/dev/null || echo "404")
if [[ "$code" == "200" ]]; then
  echo "OK: /health via api"
else
  code=$(curl -s -o /dev/null -w "%{http_code}" "${BASE}/health" 2>/dev/null || echo "000")
  [[ "$code" == "200" ]] && echo "OK: /health" || echo "WARN: health endpoint not exposed publicly (expected)"
fi

echo "=== All smoke tests passed ==="
