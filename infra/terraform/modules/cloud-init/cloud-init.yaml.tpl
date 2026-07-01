#cloud-config
package_update: true
package_upgrade: true

packages:
  - ca-certificates
  - curl
  - gnupg
  - ufw
  - fail2ban
  - unattended-upgrades

write_files:
  - path: /usr/local/bin/ragify-bootstrap.sh
    permissions: "0755"
    content: |
      #!/bin/bash
      set -euo pipefail
      ROLE="${role}"
      SWAP_SIZE="${swap_size}"

      if ! swapon --show | grep -q swapfile; then
        fallocate -l "$SWAP_SIZE" /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=2048
        chmod 600 /swapfile
        mkswap /swapfile
        swapon /swapfile
        grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
      fi

      if ! command -v docker &>/dev/null; then
        install -m 0755 -d /etc/apt/keyrings
        curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
        chmod a+r /etc/apt/keyrings/docker.gpg
        echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" > /etc/apt/sources.list.d/docker.list
        apt-get update -qq
        DEBIAN_FRONTEND=noninteractive apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-compose-plugin
        systemctl enable docker
        systemctl start docker
      fi

      id ubuntu &>/dev/null && usermod -aG docker ubuntu || true

      ufw --force reset
      ufw default deny incoming
      ufw default allow outgoing
      ufw allow 22/tcp
      %{ if role == "app" ~}
      ufw allow 80/tcp
      ufw allow 443/tcp
      ufw allow 443/udp
      %{ endif ~}
      %{ if role == "embed" ~}
      ufw allow 8080/tcp
      %{ endif ~}
      ufw --force enable

      systemctl enable fail2ban || true
      systemctl restart fail2ban || true

runcmd:
  - /usr/local/bin/ragify-bootstrap.sh
  - mkdir -p /home/ubuntu/ragify
  - chown -R ubuntu:ubuntu /home/ubuntu/ragify || true
