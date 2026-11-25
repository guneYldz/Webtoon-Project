#!/usr/bin/env sh
set -eu

# Ensure persistent static media subdirectories exist
mkdir -p \
  /app/static/covers \
  /app/static/novel_covers \
  /app/static/images \
  /app/static/profile_images \
  /app/static/announcements

# Fix ownership on bind-mounted static volume before dropping root privileges
if [ "$(id -u)" = "0" ]; then
  chown -R appuser:appuser /app/static || true
  if [ "$#" -gt 0 ]; then
    exec gosu appuser "$@"
  fi
  exec gosu appuser python -m uvicorn main:app \
    --host 0.0.0.0 \
    --port 8000 \
    --workers "${UVICORN_WORKERS:-2}" \
    --proxy-headers \
    --forwarded-allow-ips='*'
fi

if [ "$#" -gt 0 ]; then
  exec "$@"
fi

exec python -m uvicorn main:app \
  --host 0.0.0.0 \
  --port 8000 \
  --workers "${UVICORN_WORKERS:-2}" \
  --proxy-headers \
  --forwarded-allow-ips='*'
