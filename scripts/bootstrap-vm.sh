#!/usr/bin/env bash
# Bootstrap Oracle Cloud VM for Helply (Ubuntu 22.04/24.04).
# Run once per VM as root or with sudo:
#   curl -fsSL ... | bash
#   OR: sudo bash scripts/bootstrap-vm.sh [app|worker]
#
# app    — VM1: open 22/80/443, install Docker
# worker — VM2: open 22, install Docker (Redis port restricted via compose)

set -euo pipefail

ROLE="${1:-app}"
SWAP_SIZE="${SWAP_SIZE:-2G}"

log() { echo "[bootstrap] $*"; }

if [[ $EUID -ne 0 ]]; then
  echo "Run as root: sudo bash $0 $ROLE"
  exit 1
fi

log "Updating packages..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get upgrade -y -qq

log "Installing base tools..."
apt-get install -y -qq \
  ca-certificates curl gnupg lsb-release \
  ufw fail2ban unattended-upgrades iptables-persistent

# --- Swap (1GB VMs need this for Docker builds) ---
if ! swapon --show | grep -q swapfile; then
  log "Creating ${SWAP_SIZE} swap..."
  fallocate -l "$SWAP_SIZE" /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

# --- Docker ---
if ! command -v docker &>/dev/null; then
  log "Installing Docker..."
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
    $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -qq
  apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-compose-plugin
  systemctl enable docker
  systemctl start docker
fi

# Add default ubuntu user to docker group if present
if id ubuntu &>/dev/null; then
  usermod -aG docker ubuntu
fi

# --- UFW ---
log "Configuring UFW for role: $ROLE"
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp comment 'SSH'

if [[ "$ROLE" == "app" ]]; then
  ufw allow 80/tcp comment 'HTTP (Caddy ACME)'
  ufw allow 443/tcp comment 'HTTPS'
  ufw allow 443/udp comment 'HTTP/3'
fi

ufw --force enable

# --- fail2ban ---
cat > /etc/fail2ban/jail.local << 'EOF'
[sshd]
enabled = true
port = ssh
filter = sshd
logpath = /var/log/auth.log
maxretry = 5
bantime = 3600
findtime = 600
EOF
systemctl enable fail2ban
systemctl restart fail2ban

# --- Unattended security updates ---
cat > /etc/apt/apt.conf.d/20auto-upgrades << 'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APT::Periodic::AutocleanInterval "7";
EOF

# --- SSH hardening (key-only; ensure you have a key before disconnecting) ---
if grep -q '^#*PasswordAuthentication' /etc/ssh/sshd_config; then
  sed -i 's/^#*PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
fi
if grep -q '^#*PermitRootLogin' /etc/ssh/sshd_config; then
  sed -i 's/^#*PermitRootLogin.*/PermitRootLogin prohibit-password/' /etc/ssh/sshd_config
fi
systemctl reload sshd || systemctl reload ssh

log "Done. Role=$ROLE"
log "Next: clone repo, create .env, run docker compose"
if [[ "$ROLE" == "app" ]]; then
  log "  cd ~/helply && docker compose up -d --build"
else
  log "  cd ~/helply && docker compose -f docker-compose.worker.yml up -d --build"
fi
