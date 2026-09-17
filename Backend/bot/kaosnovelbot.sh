#!/usr/bin/env bash
# Ubuntu PEP 668: sistem pip'i kapalı. Bot kendi .venv'inde çalışır.
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 yok. Kur: apt install python3 python3-venv python3-full"
  exit 1
fi

if [ ! -x "$DIR/.venv/bin/python" ]; then
  echo "🔧 Sanal ortam kuruluyor (.venv)..."
  if ! python3 -m venv "$DIR/.venv"; then
    echo "venv oluşturulamadı. Kur: apt install python3-venv python3-full"
    exit 1
  fi
fi

if [ ! -f "$DIR/.venv/.req.stamp" ] || [ "$DIR/requirements.txt" -nt "$DIR/.venv/.req.stamp" ]; then
  echo "📦 Paketler kuruluyor (bir kez, overlay + botoon)..."
  "$DIR/.venv/bin/pip" install -U pip
  "$DIR/.venv/bin/pip" install -r "$DIR/requirements.txt"
  touch "$DIR/.venv/.req.stamp"
fi

exec "$DIR/.venv/bin/python" "$DIR/kaosnovelbot.py" "$@"
