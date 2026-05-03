#!/bin/bash
set -e

if [ -f package-lock.json ]; then
  npm ci --no-audit --no-fund --prefer-offline 2>&1 || npm install --no-audit --no-fund
else
  npm install --no-audit --no-fund
fi

echo "[post-merge] done"
