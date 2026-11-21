# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Local web app for tracking investments, starting with Ukrainian domestic government bonds (OVDP).
Cash flows are in UAH; profit and loss is reported in both UAH and USD. The repo is public: secrets
and user data never live in it.

## Commands

| Task | Command |
|---|---|
| Start / rebuild the stack | `make start` (runs `scripts/start.sh`; first run creates the podman secret and volume) |
| Stop | `make stop` |
| All tests | `make test` (backend pytest uses a throwaway Postgres via testcontainers on the podman socket) |
| One backend test | `cd backend && env -u VIRTUAL_ENV DOCKER_HOST=unix://$(podman machine inspect --format '{{.ConnectionInfo.PodmanSocket.Path}}') TESTCONTAINERS_RYUK_DISABLED=true uv run pytest tests/test_x.py::test_name` |
| One frontend test | `cd frontend && npx vitest run src/path/file.test.tsx` |
| Lint + types | `make lint` (ruff, ruff format, mypy --strict, eslint, prettier, tsc) |
| Autoformat | `make format` |
| After any API change | `make openapi` (regenerates `openapi.json` and `frontend/src/api/schema.d.ts`; commit both) |
| New migration | `cd backend && env -u VIRTUAL_ENV uv run alembic revision -m "<msg>"` with `INVESTOR_DATABASE_URL` pointing at a DB; write it by hand |
| Backup / restore | `make backup`, `make restore FILE=<path>` (files live in `~/.investor/backups/`) |
| Frontend dev server | `cd frontend && npm run dev` (proxies `/api` to 127.0.0.1:8000) |

Dependency versions are pinned exactly (`==` in `backend/pyproject.toml`, exact in
`frontend/package.json`). Never `uv add` or `npm install <pkg>` without an explicit version.

## Architecture

- `podman-compose.yml`: `db` (Postgres, internal network only), `backend` (FastAPI, read-only
  rootfs), `frontend` (nginx serving the SPA and proxying `/api/` to backend, the only published
  port, `127.0.0.1:8080`). `frontend/nginx.conf.template` is rendered at container start; nginx
  re-resolves `backend` on every request because its IP changes when that container restarts.
  podman-compose ignores Containerfile `HEALTHCHECK` and does not recreate containers when only
  the image changed, so healthchecks live in compose and `start.sh` passes `--force-recreate`. The DB password is the external podman secret `investor_db_password`;
  data is the external volume `investor_pgdata`. Both are created by `scripts/start.sh` and survive
  `down -v` and rebuilds.
- Backend `backend/app/`, strictly layered:
  - `api/`: thin routers under `/api/v1`, registered in `api/router.py`. Only call services.
  - `schemas/`: Pydantic request/response models. ORM objects are never returned directly.
  - `services/`: business rules and validation; raise `core.errors` exceptions
    (`NotFoundError` 404, `ConflictError` 409, `ValidationError` 422), which become
    `application/problem+json`.
  - `repositories/`: SQLAlchemy 2 queries only.
  - `models/`: ORM models on `models.base.Base`; every model module must be imported in
    `models/__init__.py` or Alembic will not see it.
  - `engine/`: pure calculation code. `schedule.py` generates coupon schedules; `portfolio.py`
    `Portfolio` derives holdings, payment allocation, valuation, period P&L and XIRR. No DB,
    FastAPI or ORM imports; inputs are plain dataclasses. `services/portfolio_loader.py` builds a
    `Portfolio` from the DB on every report request.
  - `core/`: settings (`INVESTOR_*` env vars; `INVESTOR_DATABASE_URL` overrides the secret-file
    URL), DB session dependency `get_session` (commits per request), logging, errors.
- The container runs `alembic upgrade head` on every start. Migrations are forward-only and must
  never drop user data.
- Frontend `frontend/src/`: React + TypeScript + Mantine. `app/` holds the shell, router and
  providers; `features/<area>/` holds pages, components and query hooks; `api/client.ts` is the
  typed `openapi-fetch` client generated from the backend spec (`unwrap()` turns problem
  responses into thrown errors); `lib/format.ts` holds the EU number/date formatting used
  everywhere.

## Domain rules

- Money and quantities: `Decimal` in Python, `NUMERIC` in Postgres, decimal strings in JSON.
  Never float.
- "Package" in the UI = `lot` in code: one purchase of one bond.
- Every operation stores its own USD/UAH `fx_rate` (UAH per 1 USD). USD amounts are always the
  operation's UAH amount divided by that operation's rate. Derived values (P&L, allocations,
  valuations) are computed on request and never stored.
- Coupons and redemptions are recorded once per bond (`payment`) and split across lots by
  quantity held at the end of the day before the payment date. A redemption closes every lot of
  that bond.
- Open lots are valued at amortized cost plus accrued coupon. Amortized cost moves linearly from
  the clean purchase price (cost minus accrued paid, per unit) to face value at maturity; accrued
  coupon is linear between schedule dates. `frontend/src/lib/accrued.ts` must use the same
  accrual formula as `engine.portfolio.accrued_coupon`.
- Period P&L = closing value − opening value + received − invested. Opening is valued at the
  end of the day before `start`. Valuations convert to USD at the NBU rate for the valuation date
  (`services/fx.py`, cached in `fx_rate`); flows convert at their own operation's rate.
- Valuation assumes every scheduled coupon was recorded. If a coupon date has passed without a
  `payment` record, the accrued coupon drops to zero on that date and P&L understates.
