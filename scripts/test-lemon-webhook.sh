#!/usr/bin/env bash
# Send a signed test Lemon Squeezy webhook to local or production.
#
# Usage:
#   LEMON_WEBHOOK_SECRET=xxx USER_ID=<supabase-uuid> bash scripts/test-lemon-webhook.sh
#   BASE_URL=https://ragify.tech LEMON_WEBHOOK_SECRET=xxx USER_ID=... bash scripts/test-lemon-webhook.sh

set -euo pipefail

BASE="${BASE_URL:-http://localhost:3003}"
SECRET="${LEMON_WEBHOOK_SECRET:-}"
USER_ID="${USER_ID:-}"

if [[ -z "$SECRET" || -z "$USER_ID" ]]; then
  echo "Set LEMON_WEBHOOK_SECRET and USER_ID"
  exit 1
fi

BODY=$(cat <<EOF
{
  "meta": {
    "event_name": "subscription_created",
    "custom_data": { "user_id": "${USER_ID}" }
  },
  "data": {
    "id": "test-event-$(date +%s)",
    "attributes": {
      "status": "active",
      "variant_name": "Ragify Starter",
      "customer_id": 12345
    }
  }
}
EOF
)

SIG=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "$SECRET" | awk '{print $2}')

echo "POST ${BASE}/api/webhooks/lemon"
curl -s -w "\nHTTP %{http_code}\n" -X POST "${BASE}/api/webhooks/lemon" \
  -H "Content-Type: application/json" \
  -H "x-signature: ${SIG}" \
  -d "$BODY"
