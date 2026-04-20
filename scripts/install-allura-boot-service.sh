#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
TEMPLATE_FILE="$SCRIPT_DIR/systemd/allura-memory-stack.service.template"

install_user_service() {
  local user_dir service_file
  user_dir="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"
  service_file="$user_dir/allura-memory-stack.service"

  mkdir -p "$user_dir"
  sed "s|__REPO_ROOT__|$REPO_ROOT|g" "$TEMPLATE_FILE" > "$service_file"

  systemctl --user daemon-reload
  systemctl --user enable --now allura-memory-stack.service

  cat <<EOF
✅ Installed user service: $service_file

The service is enabled for your user session.
To start it on computer boot before login, enable lingering once:

  sudo loginctl enable-linger $USER

Useful commands:
  systemctl --user status allura-memory-stack.service
  systemctl --user restart allura-memory-stack.service
EOF
}

if [[ ! -f "$TEMPLATE_FILE" ]]; then
  echo "❌ Missing template: $TEMPLATE_FILE"
  exit 1
fi

case "${1:---user}" in
  --user)
    install_user_service
    ;;
  *)
    echo "Usage: bash scripts/install-allura-boot-service.sh --user"
    exit 1
    ;;
esac
