#!/bin/sh
set -e

# Run pending migrations against DATABASE_URL before booting the app.
# Idempotent — fast no-op when the DB is already up to date.
if [ -n "$DATABASE_URL" ]; then
  echo "▶ prisma migrate deploy"
  node ./node_modules/prisma/build/index.js migrate deploy
else
  echo "⚠ DATABASE_URL not set — skipping migrate deploy"
fi

exec "$@"
