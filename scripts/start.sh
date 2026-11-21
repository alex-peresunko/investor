#!/usr/bin/env bash
# Idempotent: creates the secret, volume and host data dir on first run only, then starts the stack.
set -euo pipefail
cd "$(dirname "$0")/.."

INVESTOR_HOME="${INVESTOR_HOME:-$HOME/.investor}"
# scripts/demo.sh overrides these to run an isolated demo stack.
project="${INVESTOR_PROJECT:-investor}"
volume="${INVESTOR_VOLUME:-investor_pgdata}"
export INVESTOR_VOLUME="$volume"
mkdir -p "$INVESTOR_HOME/backups" "$INVESTOR_HOME/imports"
chmod 700 "$INVESTOR_HOME"

if ! podman secret exists investor_db_password; then
  # Regenerating this for an existing volume would lock the app out of its database.
  for existing in investor_pgdata "$volume"; do
    if podman volume exists "$existing"; then
      echo "error: volume $existing exists but secret investor_db_password is missing." >&2
      echo "Restore the secret with the original password, or restore from a backup into a new volume." >&2
      exit 1
    fi
  done
  openssl rand -base64 32 | tr -d '\n' | podman secret create investor_db_password - >/dev/null
  echo "created podman secret investor_db_password"
fi

if ! podman volume exists "$volume"; then
  podman volume create "$volume" >/dev/null
  echo "created podman volume $volume"
fi

# podman-compose does not recreate containers when only the image changed.
podman compose -p "$project" up -d --build --force-recreate "$@"
echo "Investor is starting at http://127.0.0.1:${INVESTOR_PORT:-8080}"
