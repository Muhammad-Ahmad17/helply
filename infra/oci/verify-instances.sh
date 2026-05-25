#!/usr/bin/env bash
# Verify Helply VM requirements over SSH (run from your laptop after provision).
#
# Usage:
#   bash scripts/oci/verify-instances.sh

set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
source "$ROOT/lib/common.sh"

load_env
load_state

: "${HELPLY_APP_PUBLIC_IP:?Missing HELPLY_APP_PUBLIC_IP in .state.env}"
: "${HELPLY_WORKER_PUBLIC_IP:?Missing HELPLY_WORKER_PUBLIC_IP in .state.env}"

SSH_USER="${HELPLY_SSH_USER:-ubuntu}"
SSH_OPTS=(-o StrictHostKeyChecking=accept-new -o ConnectTimeout=15)

REMOTE_CHECK='echo "=== OS ==="
lsb_release -ds 2>/dev/null || cat /etc/os-release | head -2
uname -m
echo "=== RAM / SWAP / DISK ==="
free -h
swapon --show || echo "NO SWAP"
df -h /
echo "=== CPU ==="
nproc
echo "=== INTERNET ==="
curl -s --max-time 5 ifconfig.me && echo " OK" || echo "FAIL"
hostname -I
echo "=== DOCKER ==="
docker --version 2>/dev/null || echo "Docker NOT installed"
docker compose version 2>/dev/null || echo "Compose NOT installed"
echo "=== LISTENING PORTS ==="
sudo ss -tlnp 2>/dev/null | grep -E ":22|:80|:443|:6379|:3000" || echo "(none yet)"'

check_host() {
  local name="$1"
  local ip="$2"
  echo ""
  echo "================================================================"
  echo "Checking $name ($ip)"
  echo "================================================================"
  if ssh "${SSH_OPTS[@]}" "${SSH_USER}@${ip}" "$REMOTE_CHECK"; then
    echo "[OK] $name reachable"
  else
    echo "[FAIL] Cannot SSH to $name — wait for cloud-init or check Security List"
    return 1
  fi
}

FAIL=0
check_host "helply-app" "$HELPLY_APP_PUBLIC_IP" || FAIL=1
check_host "helply-worker" "$HELPLY_WORKER_PUBLIC_IP" || FAIL=1

if [[ -n "${HELPLY_WORKER_PRIVATE_IP:-}" && -n "${HELPLY_APP_PUBLIC_IP:-}" ]]; then
  echo ""
  echo "=== Redis reachability (VM1 → VM2 private IP) ==="
  if ssh "${SSH_OPTS[@]}" "${SSH_USER}@${HELPLY_APP_PUBLIC_IP}" \
    "command -v redis-cli >/dev/null || sudo apt-get install -y redis-tools >/dev/null 2>&1; \
     redis-cli -h ${HELPLY_WORKER_PRIVATE_IP} ping 2>/dev/null || echo 'Redis not running yet (deploy VM2 compose first)'"; then
    :
  else
    FAIL=1
  fi
fi

echo ""
if [[ "$FAIL" -eq 0 ]]; then
  echo "All checks passed (or Redis pending deploy)."
else
  echo "Some checks failed — see output above."
  exit 1
fi
