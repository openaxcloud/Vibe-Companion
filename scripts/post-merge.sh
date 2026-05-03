#!/bin/bash
set -e

if [ -f package-lock.json ]; then
  npm ci --no-audit --no-fund --prefer-offline 2>&1 || npm install --no-audit --no-fund
else
  npm install --no-audit --no-fund
fi

if [ -n "$DATABASE_URL" ]; then
  npx --yes drizzle-kit push --force 2>&1 || echo "[post-merge] drizzle push skipped/failed (non-fatal)"
fi

echo "[post-merge] done"
