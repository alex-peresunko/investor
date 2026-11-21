#!/usr/bin/env bash
# Demo stack, isolated from the real one: own project, volume and port; shares only the DB
# password secret.
#   scripts/demo.sh up     start it and load 24 months of demo data (once per volume)
#   scripts/demo.sh down   stop it and delete its data
set -euo pipefail
cd "$(dirname "$0")/.."

export INVESTOR_PROJECT=investor-demo
export INVESTOR_VOLUME=investor_demo_pgdata
export INVESTOR_PORT="${INVESTOR_DEMO_PORT:-8081}"
compose=(podman compose -p "$INVESTOR_PROJECT")

case "${1:-}" in
  up)
    scripts/start.sh
    echo "waiting for the demo backend..."
    for _ in $(seq 60); do
      if "${compose[@]}" exec -T backend python -c \
        "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/v1/health')" \
        >/dev/null 2>&1; then
        "${compose[@]}" exec -T backend python -m app.demo
        echo "Demo is running at http://127.0.0.1:$INVESTOR_PORT (remove it with: make demo-clean)"
        exit 0
      fi
      sleep 2
    done
    echo "error: the demo backend did not become healthy; see: ${compose[*]} logs backend" >&2
    exit 1
    ;;
  down)
    "${compose[@]}" down
    if podman volume exists "$INVESTOR_VOLUME"; then
      podman volume rm "$INVESTOR_VOLUME" >/dev/null
      echo "deleted podman volume $INVESTOR_VOLUME"
    fi
    ;;
  *)
    echo "usage: $0 up|down" >&2
    exit 2
    ;;
esac
