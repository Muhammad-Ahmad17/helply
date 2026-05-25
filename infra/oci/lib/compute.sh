#!/usr/bin/env bash
# Launch helply-app and helply-worker instances with cloud-init (Oracle iptables fix).

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "$SCRIPT_DIR/common.sh"

load_env
check_prerequisites
load_state

: "${HELPLY_APP_SUBNET_OCID:?Run lib/network.sh first}"
: "${HELPLY_WORKER_SUBNET_OCID:?Run lib/network.sh first}"

CID="$HELPLY_COMPARTMENT_OCID"
APP_NAME="${HELPLY_APP_INSTANCE_NAME:-helply-app}"
WORKER_NAME="${HELPLY_WORKER_INSTANCE_NAME:-helply-worker}"
VCN_CIDR="${HELPLY_VCN_CIDR:-10.0.0.0/16}"
SSH_KEY="$(read_ssh_public_key)"  # validated; launch uses --ssh-authorized-keys-file
IMAGE_OCID="$(resolve_ubuntu_image_ocid)"
[[ -n "$IMAGE_OCID" && "$IMAGE_OCID" != "null" ]] || die "Could not resolve Ubuntu 24.04 image — set HELPLY_UBUNTU_IMAGE_OCID in env.local"

AD="$(oci iam availability-domain list --compartment-id "$CID" \
  --query 'data[0].name' --raw-output)"

SHAPE_ARGS="$(build_shape_args)"
log "Using image $IMAGE_OCID, AD $AD, shape ${HELPLY_INSTANCE_SHAPE}"

CLOUD_INIT_DIR="$(mktemp -d)"
trap 'rm -rf "$CLOUD_INIT_DIR"' EXIT

cat > "$CLOUD_INIT_DIR/helply-app-init.yaml" <<EOF
#cloud-config
package_update: true
packages:
  - iptables-persistent
runcmd:
  - iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
  - iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
  - mkdir -p /etc/iptables
  - iptables-save > /etc/iptables/rules.v4
EOF

cat > "$CLOUD_INIT_DIR/helply-worker-init.yaml" <<EOF
#cloud-config
package_update: true
packages:
  - iptables-persistent
runcmd:
  - iptables -I INPUT -p tcp -s ${VCN_CIDR} --dport 6379 -j ACCEPT
  - mkdir -p /etc/iptables
  - iptables-save > /etc/iptables/rules.v4
EOF

launch_instance() {
  local name="$1"
  local subnet_ocid="$2"
  local cloud_init_file="$3"
  local var_prefix="$4"

  local existing
  existing="$(oci_find_by_name instance "$name")"
  if [[ -n "$existing" ]]; then
    log "Instance exists: $name ($existing)"
    eval "${var_prefix}_INSTANCE_OCID=\"$existing\""
    wait_for_instance_running "$existing" "$name"
    get_instance_ips "$existing"
    eval "${var_prefix}_PUBLIC_IP=\"$_INSTANCE_PUBLIC_IP\""
    eval "${var_prefix}_PRIVATE_IP=\"$_INSTANCE_PRIVATE_IP\""
    return
  fi

  log "Launching instance: $name"
  # shellcheck disable=SC2086
  local instance_ocid
  instance_ocid="$(oci compute instance launch \
    --compartment-id "$CID" \
    --availability-domain "$AD" \
    --display-name "$name" \
    $SHAPE_ARGS \
    --image-id "$IMAGE_OCID" \
    --subnet-id "$subnet_ocid" \
    --assign-public-ip true \
    --ssh-authorized-keys-file "${HELPLY_SSH_PUBLIC_KEY_FILE/#\~/$HOME}" \
    --user-data-file "$cloud_init_file" \
    --query 'data.id' --raw-output)"

  wait_for_instance_running "$instance_ocid" "$name"
  get_instance_ips "$instance_ocid"

  eval "${var_prefix}_INSTANCE_OCID=\"$instance_ocid\""
  eval "${var_prefix}_PUBLIC_IP=\"$_INSTANCE_PUBLIC_IP\""
  eval "${var_prefix}_PRIVATE_IP=\"$_INSTANCE_PRIVATE_IP\""
  log "$name public=$_INSTANCE_PUBLIC_IP private=$_INSTANCE_PRIVATE_IP"
}

launch_instance "$APP_NAME" "$HELPLY_APP_SUBNET_OCID" \
  "$CLOUD_INIT_DIR/helply-app-init.yaml" "HELPLY_APP"

launch_instance "$WORKER_NAME" "$HELPLY_WORKER_SUBNET_OCID" \
  "$CLOUD_INIT_DIR/helply-worker-init.yaml" "HELPLY_WORKER"

export HELPLY_APP_INSTANCE_OCID HELPLY_APP_PUBLIC_IP HELPLY_APP_PRIVATE_IP
export HELPLY_WORKER_INSTANCE_OCID HELPLY_WORKER_PUBLIC_IP HELPLY_WORKER_PRIVATE_IP

save_state

cat <<EOF

================================================================
Helply instances ready
================================================================
  helply-app
    public:  ${HELPLY_APP_PUBLIC_IP}
    private: ${HELPLY_APP_PRIVATE_IP}

  helply-worker
    public:  ${HELPLY_WORKER_PUBLIC_IP}
    private: ${HELPLY_WORKER_PRIVATE_IP}

Add to ~/.ssh/config:

  Host helply-app
    HostName ${HELPLY_APP_PUBLIC_IP}
    User ubuntu

  Host helply-worker
    HostName ${HELPLY_WORKER_PUBLIC_IP}
    User ubuntu

Next:
  ssh helply-app  'git clone <repo> ~/helply && cd ~/helply && sudo bash scripts/bootstrap-vm.sh app'
  ssh helply-worker 'git clone <repo> ~/helply && cd ~/helply && sudo bash scripts/bootstrap-vm.sh worker'

VM2 .env:  REDIS_BIND=${HELPLY_WORKER_PRIVATE_IP}
VM1 .env:  REDIS_URL=redis://${HELPLY_WORKER_PRIVATE_IP}:6379
================================================================
EOF
