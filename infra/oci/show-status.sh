#!/usr/bin/env bash
# Print Helply resource summary from OCI (IDs, IPs, lifecycle state).
#
# Usage:
#   bash scripts/oci/show-status.sh

set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/common.sh
source "$ROOT/lib/common.sh"

load_env

if [[ -f "${HELPLY_STATE_FILE:-$ROOT/.state.env}" ]]; then
  # shellcheck disable=SC1090
  source "${HELPLY_STATE_FILE:-$ROOT/.state.env}"
fi

CID="$HELPLY_COMPARTMENT_OCID"

print_instance() {
  local name="$1"
  local ocid
  ocid="$(oci_find_by_name instance "$name")"
  if [[ -z "$ocid" ]]; then
    echo "  $name: (not found)"
    return
  fi
  local info
  info="$(oci compute instance get --instance-id "$ocid" \
    --query 'data.{state:"lifecycle-state",shape:shape,time:"time-created"}' 2>/dev/null)"
  get_instance_ips "$ocid"
  echo "  $name:"
  echo "    ocid:    $ocid"
  echo "    state:   $(echo "$info" | jq -r '.state')"
  echo "    shape:   $(echo "$info" | jq -r '.shape')"
  echo "    public:  $_INSTANCE_PUBLIC_IP"
  echo "    private: $_INSTANCE_PRIVATE_IP"
}

echo "Helply OCI status (region=$HELPLY_REGION)"
echo ""
echo "Network:"
VCN_OCID="$(oci_find_by_name vcn "${HELPLY_VCN_NAME:-helply-vcn}")"
echo "  ${HELPLY_VCN_NAME:-helply-vcn}: ${VCN_OCID:-not found}"
APP_SUB="$(oci_find_by_name subnet "${HELPLY_APP_SUBNET_NAME:-helply-app-subnet}")"
WORKER_SUB="$(oci_find_by_name subnet "${HELPLY_WORKER_SUBNET_NAME:-helply-worker-subnet}")"
echo "  ${HELPLY_APP_SUBNET_NAME:-helply-app-subnet}: ${APP_SUB:-not found}"
echo "  ${HELPLY_WORKER_SUBNET_NAME:-helply-worker-subnet}: ${WORKER_SUB:-not found}"

echo ""
echo "Instances:"
print_instance "${HELPLY_APP_INSTANCE_NAME:-helply-app}"
print_instance "${HELPLY_WORKER_INSTANCE_NAME:-helply-worker}"

echo ""
echo "State file: ${HELPLY_STATE_FILE:-$ROOT/.state.env}"
