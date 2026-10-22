#!/usr/bin/env bash
# Telif/özet onarımı — daima kaosnovelbot dalından çeker, sonra --onar --telif çalıştırır.
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$DIR/../.." && pwd)"
cd "$REPO"

if ! git rev-parse --git-dir >/dev/null 2>&1; then
  echo "❌ Burası git deposu değil: $REPO"
  exit 1
fi

echo "📁 Repo: $REPO"
echo "📡 origin/kaosnovelbot çekiliyor..."
git fetch origin kaosnovelbot
git checkout kaosnovelbot
git pull --ff-only origin kaosnovelbot

echo "📌 Dal: $(git rev-parse --abbrev-ref HEAD)  ($(git log -1 --oneline))"
cd "$DIR"

if command -v python3 >/dev/null 2>&1; then
  PY=python3
elif [ -x "$DIR/.venv/bin/python" ]; then
  PY="$DIR/.venv/bin/python"
else
  echo "❌ python3 yok."
  exit 1
fi

exec "$PY" "$DIR/kaosnovelbot.py" --onar --telif "$@"
