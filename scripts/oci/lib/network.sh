#!/usr/bin/env bash
# Create Helply VCN, subnets, internet gateway, route table, and security lists.

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "$SCRIPT_DIR/common.sh"

load_env
check_prerequisites

CID="$HELPLY_COMPARTMENT_OCID"
VCN_NAME="${HELPLY_VCN_NAME:-helply-vcn}"
APP_SUBNET_NAME="${HELPLY_APP_SUBNET_NAME:-helply-app-subnet}"
WORKER_SUBNET_NAME="${HELPLY_WORKER_SUBNET_NAME:-helply-worker-subnet}"
IGW_NAME="${HELPLY_IGW_NAME:-helply-internet-gateway}"
RT_NAME="${HELPLY_ROUTE_TABLE_NAME:-helply-public-route-table}"
APP_SL_NAME="${HELPLY_APP_SECURITY_LIST_NAME:-helply-app-security-list}"
WORKER_SL_NAME="${HELPLY_WORKER_SECURITY_LIST_NAME:-helply-worker-security-list}"
VCN_CIDR="${HELPLY_VCN_CIDR:-10.0.0.0/16}"
APP_SUBNET_CIDR="${HELPLY_APP_SUBNET_CIDR:-10.0.1.0/24}"
WORKER_SUBNET_CIDR="${HELPLY_WORKER_SUBNET_CIDR:-10.0.2.0/24}"

# --- VCN ---
HELPLY_VCN_OCID="$(oci_find_by_name vcn "$VCN_NAME")"
if [[ -z "$HELPLY_VCN_OCID" ]]; then
  log "Creating VCN: $VCN_NAME ($VCN_CIDR)"
  HELPLY_VCN_OCID="$(oci network vcn create \
    --compartment-id "$CID" \
    --display-name "$VCN_NAME" \
    --cidr-block "$VCN_CIDR" \
    --dns-label helplyvcn \
    --query 'data.id' --raw-output)"
else
  log "VCN exists: $VCN_NAME ($HELPLY_VCN_OCID)"
fi

# --- Internet Gateway ---
IGW_OCID="$(oci network internet-gateway list \
  --compartment-id "$CID" --vcn-id "$HELPLY_VCN_OCID" \
  --display-name "$IGW_NAME" --query 'data[0].id' --raw-output 2>/dev/null | grep -v '^None$' || true)"

if [[ -z "$IGW_OCID" ]]; then
  log "Creating Internet Gateway: $IGW_NAME"
  IGW_OCID="$(oci network internet-gateway create \
    --compartment-id "$CID" \
    --vcn-id "$HELPLY_VCN_OCID" \
    --display-name "$IGW_NAME" \
    --is-enabled true \
    --query 'data.id' --raw-output)"
else
  log "Internet Gateway exists: $IGW_NAME"
fi

# --- Route Table (public: 0.0.0.0/0 → IGW) ---
RT_OCID="$(oci network route-table list \
  --compartment-id "$CID" --vcn-id "$HELPLY_VCN_OCID" \
  --display-name "$RT_NAME" --query 'data[0].id' --raw-output 2>/dev/null | grep -v '^None$' || true)"

ROUTE_RULES='[{"cidrBlock":"0.0.0.0/0","networkEntityId":"'"$IGW_OCID"'"}]'

if [[ -z "$RT_OCID" ]]; then
  log "Creating Route Table: $RT_NAME"
  RT_OCID="$(oci network route-table create \
    --compartment-id "$CID" \
    --vcn-id "$HELPLY_VCN_OCID" \
    --display-name "$RT_NAME" \
    --route-rules "$ROUTE_RULES" \
    --query 'data.id' --raw-output)"
else
  log "Updating Route Table: $RT_NAME"
  oci network route-table update --rt-id "$RT_OCID" \
    --route-rules "$ROUTE_RULES" --force >/dev/null
fi

# --- Security List: helply-app (SSH + HTTP + HTTPS) ---
create_app_security_list() {
  local ingress='[
    {"protocol":"6","source":"0.0.0.0/0","isStateless":false,"tcpOptions":{"destinationPortRange":{"min":22,"max":22}}},
    {"protocol":"6","source":"0.0.0.0/0","isStateless":false,"tcpOptions":{"destinationPortRange":{"min":80,"max":80}}},
    {"protocol":"6","source":"0.0.0.0/0","isStateless":false,"tcpOptions":{"destinationPortRange":{"min":443,"max":443}}},
    {"protocol":"17","source":"0.0.0.0/0","isStateless":false,"udpOptions":{"destinationPortRange":{"min":443,"max":443}}}
  ]'
  local egress='[{"protocol":"all","destination":"0.0.0.0/0","isStateless":false}]'

  HELPLY_APP_SECURITY_LIST_OCID="$(oci_find_by_name security-list "$APP_SL_NAME")"
  if [[ -z "$HELPLY_APP_SECURITY_LIST_OCID" ]]; then
    log "Creating Security List: $APP_SL_NAME (22, 80, 443/tcp+udp)"
    HELPLY_APP_SECURITY_LIST_OCID="$(oci network security-list create \
      --compartment-id "$CID" \
      --vcn-id "$HELPLY_VCN_OCID" \
      --display-name "$APP_SL_NAME" \
      --ingress-security-rules "$ingress" \
      --egress-security-rules "$egress" \
      --query 'data.id' --raw-output)"
  else
    log "Updating Security List: $APP_SL_NAME"
    oci network security-list update --security-list-id "$HELPLY_APP_SECURITY_LIST_OCID" \
      --ingress-security-rules "$ingress" \
      --egress-security-rules "$egress" --force >/dev/null
  fi
}

# --- Security List: helply-worker (SSH + Redis from VCN only) ---
create_worker_security_list() {
  local ingress='[
    {"protocol":"6","source":"0.0.0.0/0","isStateless":false,"tcpOptions":{"destinationPortRange":{"min":22,"max":22}}},
    {"protocol":"6","source":"'"$VCN_CIDR"'","isStateless":false,"tcpOptions":{"destinationPortRange":{"min":6379,"max":6379}}}
  ]'
  local egress='[{"protocol":"all","destination":"0.0.0.0/0","isStateless":false}]'

  HELPLY_WORKER_SECURITY_LIST_OCID="$(oci_find_by_name security-list "$WORKER_SL_NAME")"
  if [[ -z "$HELPLY_WORKER_SECURITY_LIST_OCID" ]]; then
    log "Creating Security List: $WORKER_SL_NAME (22, 6379 from $VCN_CIDR)"
    HELPLY_WORKER_SECURITY_LIST_OCID="$(oci network security-list create \
      --compartment-id "$CID" \
      --vcn-id "$HELPLY_VCN_OCID" \
      --display-name "$WORKER_SL_NAME" \
      --ingress-security-rules "$ingress" \
      --egress-security-rules "$egress" \
      --query 'data.id' --raw-output)"
  else
    log "Updating Security List: $WORKER_SL_NAME"
    oci network security-list update --security-list-id "$HELPLY_WORKER_SECURITY_LIST_OCID" \
      --ingress-security-rules "$ingress" \
      --egress-security-rules "$egress" --force >/dev/null
  fi
}

create_app_security_list
create_worker_security_list

create_subnet() {
  local name="$1"
  local cidr="$2"
  local sl_ocid="$3"
  local dns_label="$4"
  local out_var="$5"

  local subnet_ocid
  subnet_ocid="$(oci_find_by_name subnet "$name")"
  if [[ -z "$subnet_ocid" ]]; then
    log "Creating Subnet: $name ($cidr)"
    subnet_ocid="$(oci network subnet create \
      --compartment-id "$CID" \
      --vcn-id "$HELPLY_VCN_OCID" \
      --display-name "$name" \
      --cidr-block "$cidr" \
      --dns-label "$dns_label" \
      --route-table-id "$RT_OCID" \
      --security-list-ids "[\"$sl_ocid\"]" \
      --query 'data.id' --raw-output)"
  else
    log "Subnet exists: $name ($subnet_ocid)"
  fi
  eval "$out_var=\"$subnet_ocid\""
}

create_subnet "$APP_SUBNET_NAME" "$APP_SUBNET_CIDR" "$HELPLY_APP_SECURITY_LIST_OCID" \
  "helplyapp" "HELPLY_APP_SUBNET_OCID"
create_subnet "$WORKER_SUBNET_NAME" "$WORKER_SUBNET_CIDR" "$HELPLY_WORKER_SECURITY_LIST_OCID" \
  "helplywrk" "HELPLY_WORKER_SUBNET_OCID"

export HELPLY_VCN_OCID HELPLY_APP_SUBNET_OCID HELPLY_WORKER_SUBNET_OCID
export HELPLY_APP_SECURITY_LIST_OCID HELPLY_WORKER_SECURITY_LIST_OCID

save_state
log "Network provisioning complete."
