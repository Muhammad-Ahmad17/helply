#!/usr/bin/env bash
# Update Helply security lists + subnets only (no new instances).
# Use when reusing existing VMs or fixing firewall rules from terminal.
#
# Usage:
#   bash scripts/oci/apply-policies.sh

set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

bash "$ROOT/lib/network.sh"

log_msg() { echo "[helply-oci] $*"; }
log_msg "Policies applied. Existing instances pick up subnet rules automatically."
log_msg "Re-run host iptables fix on each VM if needed:"
log_msg "  VM1: sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT"
log_msg "  VM1: sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT"
log_msg "  VM2: sudo iptables -I INPUT -p tcp -s 10.0.0.0/16 --dport 6379 -j ACCEPT"
log_msg "  VM2: sudo iptables -I INPUT -p tcp -s 10.0.0.0/16 --dport 3002:3004 -j ACCEPT"
