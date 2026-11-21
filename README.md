# investor

A local web app for tracking investments in Ukrainian domestic government bonds (OVDP). Every
operation is recorded in UAH, and profit and loss is reported in both UAH and USD. USD amounts use
the USD/UAH rate of each operation's own date, so currency moves show up in the USD result.

- Buy bonds, sell part of a package, and record coupons and redemptions. Every record can be
  edited or deleted, and all figures are recalculated on the fly.
- The official NBU USD/UAH rate is filled in automatically and can be overridden with your bank's
  rate.
- A bond's coupon schedule is generated from its terms and can be edited by hand.
- Dashboard for any period: P&L, current value, invested, received, XIRR, and a value chart. The
  same is available per package.
- Calendar of upcoming coupons and redemptions; Excel and CSV export.
- A one-command demo with 24 months of sample data (`make demo`), separate from your own data.

## Requirements

- macOS or Linux with [podman](https://podman.io) and `podman-compose` (on macOS, a running
  `podman machine`)
- `openssl` (generates the database password on first start)

## Try it with demo data

```bash
git clone https://github.com/alex-peresunko/investor.git && cd investor
make demo         # open http://127.0.0.1:8081 (set INVESTOR_DEMO_PORT to change the port)
make demo-clean   # when done: stop the demo and delete its data
```

`make demo` starts a separate copy of the app with its own database (podman volume
`investor_demo_pgdata`) and fills it with six fictional bonds and 24 months of history ending
today: purchases, partial sales, coupons, redemptions and an upcoming maturity. USD amounts use
the real NBU rates of each date, so the first run needs internet access. Running it again keeps
the existing demo data.

The demo never touches the data of `make start`, and both can run at the same time. While both
run, a **My data | Demo** switch in the header opens the same page in the other one. To start
from scratch with your own data, run `make demo-clean`, then `make start` (below).

## Run

```bash
make start            # or: scripts/start.sh
```

Then open http://127.0.0.1:8080. The app listens on localhost only.

On the first start, `scripts/start.sh`:

1. creates `~/.investor/` (mode 700; set `INVESTOR_HOME` to choose another location) for backups
   and import files;
2. generates a random database password and stores it in the podman secret `investor_db_password`;
3. creates the podman volume `investor_pgdata` for the database.

Later starts reuse all three. Secrets and data never live in this repository.

The data survives container restarts, image rebuilds and `podman compose down -v`. Only
`podman volume rm investor_pgdata` deletes it.

## Backup and restore

```bash
make backup                                   # writes ~/.investor/backups/investor-<timestamp>.dump
make restore FILE=~/.investor/backups/<file>  # asks for confirmation, then replaces all data
```

## Development

Additional requirements: [uv](https://docs.astral.sh/uv/) and Node.js 24.

```bash
cd frontend && npm ci && cd ..   # once
make lint                        # ruff, mypy, eslint, prettier, tsc
make test                        # pytest (throwaway Postgres in podman) + vitest
make openapi                     # after API changes: regenerate the typed frontend client
```

See `CLAUDE.md` for the architecture.
