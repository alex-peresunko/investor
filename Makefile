SHELL := /bin/bash
# Testcontainers talks to podman through its machine socket; Ryuk does not run under podman.
PODMAN_SOCKET := $(shell podman machine inspect --format '{{.ConnectionInfo.PodmanSocket.Path}}' 2>/dev/null)
TEST_ENV := DOCKER_HOST=unix://$(PODMAN_SOCKET) TESTCONTAINERS_RYUK_DISABLED=true
UV := cd backend && env -u VIRTUAL_ENV uv run

.PHONY: start stop logs test test-backend test-frontend lint lint-backend lint-frontend \
        format openapi backup restore

start:
	scripts/start.sh

stop:
	podman compose down

logs:
	podman compose logs -f --tail=200

test: test-backend test-frontend

test-backend:
	$(UV) env $(TEST_ENV) pytest

test-frontend:
	cd frontend && npm test

lint: lint-backend lint-frontend

lint-backend:
	$(UV) ruff check .
	$(UV) ruff format --check .
	$(UV) mypy app tests

lint-frontend:
	cd frontend && npm run lint && npm run typecheck

format:
	$(UV) ruff format .
	$(UV) ruff check --fix .
	cd frontend && npm run format

# Regenerates openapi.json and the typed frontend client; run after any API change.
openapi:
	$(UV) env PYTHONPATH=. python scripts/export_openapi.py ../openapi.json
	cd frontend && npm run gen:api && npx prettier --write src/api/schema.d.ts >/dev/null

backup:
	scripts/backup.sh

restore:
	scripts/restore.sh $(FILE)
