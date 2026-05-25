#!/usr/bin/env bash
# Rewash both VMs from laptop via SSH
set -euo pipefail

VM1="${VM1:-helply-app}"
VM2="${VM2:-helply-worker}"
REMOTE_DIR="${REMOTE_DIR:-~/ragify}"

echo "==> Rewashing VM2 (worker) first..."
ssh "$VM2" "cd ${REMOTE_DIR} && git pull && bash deploy/scripts/rewash-vm2.sh"

echo "==> Rewashing VM1 (app)..."
ssh "$VM1" "cd ${REMOTE_DIR} && git pull && bash deploy/scripts/rewash-vm1.sh"

echo "==> Done. Verify: curl -I https://ragify.tech"
