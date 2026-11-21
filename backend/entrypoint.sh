#!/bin/sh
set -eu
# Forward-only schema upgrade; never drops existing data.
alembic upgrade head
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --proxy-headers --forwarded-allow-ips='*'
