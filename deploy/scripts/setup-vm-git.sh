#!/usr/bin/env bash
# One-time: allow git pull on an Oracle VM without passwords.
# Run ON EACH VM (helply-app and helply-worker) as the deploy user.
#
# Usage:
#   GITHUB_REPO=your-org/siiuuu bash deploy/scripts/setup-vm-git.sh
#
# Then add the printed public key to GitHub → Repo → Settings → Deploy keys (read-only).

set -euo pipefail

GITHUB_REPO="${GITHUB_REPO:?Set GITHUB_REPO e.g. your-org/siiuuu}"
REMOTE_DIR="${REMOTE_DIR:-$HOME/helply}"
KEY_PATH="${KEY_PATH:-$HOME/.ssh/ragify_deploy_key}"

mkdir -p "$(dirname "$KEY_PATH")"
chmod 700 "$(dirname "$KEY_PATH")"

if [[ ! -f "$KEY_PATH" ]]; then
  ssh-keygen -t ed25519 -f "$KEY_PATH" -N "" -C "ragify-deploy@$(hostname)"
fi

mkdir -p "$HOME/.ssh"
chmod 700 "$HOME/.ssh"

if ! grep -q "Host github.com" "$HOME/.ssh/config" 2>/dev/null; then
  cat >> "$HOME/.ssh/config" <<EOF

Host github.com
  HostName github.com
  User git
  IdentityFile ${KEY_PATH}
  IdentitiesOnly yes
EOF
  chmod 600 "$HOME/.ssh/config"
fi

if [[ -d "$REMOTE_DIR/.git" ]]; then
  cd "$REMOTE_DIR"
  git remote set-url origin "git@github.com:${GITHUB_REPO}.git"
else
  git clone "git@github.com:${GITHUB_REPO}.git" "$REMOTE_DIR"
fi

echo ""
echo "=== Add this deploy key to GitHub (read-only) ==="
cat "${KEY_PATH}.pub"
echo ""
echo "Repo: https://github.com/${GITHUB_REPO}/settings/keys"
echo "Test:  cd ${REMOTE_DIR} && git pull"
