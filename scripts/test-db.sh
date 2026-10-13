#!/usr/bin/env bash
# Runs every migration on a throwaway local Postgres, then the SQL scenario tests.
# Needs Postgres 15+ binaries (initdb, pg_ctl) on this machine.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PGBIN="${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
DIR="$(mktemp -d)"
PORT="${PGPORT:-55432}"
trap '"$PGBIN/pg_ctl" -D "$DIR" stop -m immediate >/dev/null 2>&1 || true; rm -rf "$DIR"' EXIT
if [ "$(id -u)" = "0" ]; then RUN=(runuser -u postgres --); chown postgres "$DIR"; else RUN=(); fi
"${RUN[@]}" "$PGBIN/initdb" -D "$DIR" -A trust -U postgres >/dev/null
"${RUN[@]}" "$PGBIN/pg_ctl" -D "$DIR" -o "-p $PORT -k $DIR -c listen_addresses=''" -l "$DIR/log" start >/dev/null
PSQL=(psql -h "$DIR" -p "$PORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -q)
"${PSQL[@]}" -f "$ROOT/supabase/tests/supabase-stub.sql"
for f in "$ROOT"/supabase/migrations/*.sql; do echo "migrate: $(basename "$f")"; "${PSQL[@]}" -f "$f" >/dev/null; done
for t in ${ONLY:-"$ROOT"/supabase/tests/*.test.sql}; do echo "test: $(basename "$t")"; "${PSQL[@]}" -f "$t"; done
