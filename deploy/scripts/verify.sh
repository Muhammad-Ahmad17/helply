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

echo "==> All checks passed for ${DOMAIN}"
