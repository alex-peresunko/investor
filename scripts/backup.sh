#!/usr/bin/env bash
# Writes a compressed pg_dump of the running database to $INVESTOR_HOME/backups/.
set -euo pipefail
cd "$(dirname "$0")/.."
INVESTOR_HOME="${INVESTOR_HOME:-$HOME/.investor}"
mkdir -p "$INVESTOR_HOME/backups"
out="$INVESTOR_HOME/backups/investor-$(date +%Y%m%d-%H%M%S).dump"
podman compose exec -T db pg_dump -U investor -d investor --format=custom >"$out"
chmod 600 "$out"
echo "backup written to $out"
