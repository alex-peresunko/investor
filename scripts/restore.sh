#!/usr/bin/env bash
# Replaces the current database contents with a dump made by backup.sh.
set -euo pipefail
cd "$(dirname "$0")/.."
file="${1:?usage: scripts/restore.sh <path to .dump>}"
[[ -f "$file" ]] || { echo "error: $file not found" >&2; exit 1; }
read -r -p "This replaces ALL current data with $file. Type 'restore' to continue: " answer
[[ "$answer" == "restore" ]] || { echo "aborted"; exit 1; }
podman compose stop backend
podman compose exec -T db pg_restore -U investor -d investor --clean --if-exists --no-owner <"$file"
podman compose start backend
echo "restored from $file"
