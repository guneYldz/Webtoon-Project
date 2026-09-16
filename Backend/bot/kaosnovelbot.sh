#!/usr/bin/env bash
# Ubuntu PEP 668: kaosnovelbot da botoon ile aynı .venv'i kullanır.
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

if [ ! -x "$DIR/.venv/bin/python" ]; then
  echo "Önce ./botoon.sh bir kez çalıştır (veya: python3 -m venv .venv && .venv/bin/pip install -r requirements.txt)"
  exit 1
fi

if [ ! -f "$DIR/.venv/.req.stamp" ] || [ "$DIR/requirements.txt" -nt "$DIR/.venv/.req.stamp" ]; then
  echo "📦 Paketler güncelleniyor..."
  "$DIR/.venv/bin/pip" install -U pip
  "$DIR/.venv/bin/pip" install -r "$DIR/requirements.txt"
  touch "$DIR/.venv/.req.stamp"
fi

exec "$DIR/.venv/bin/python" "$DIR/kaosnovelbot.py" "$@"
