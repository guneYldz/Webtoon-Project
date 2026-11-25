#!/usr/bin/env bash
# ==============================================================================
# Kaos Manga — Faz 3 Güvenli Veritabanı Migrasyon Betiği (Production VPS)
# ==============================================================================
# 1) backup_db.sh ile sıkıştırılmış (-Fc) tam PostgreSQL yedeği alır.
# 2) 'docker compose exec -T backend alembic upgrade head' ile 001 -> 004
#    migrasyonlarını uygular.
# 3) 'alembic current' çıktısını doğrular.
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "------------------------------------------------------------"
echo "🚀 [1/3] Faz 3 Öncesi Veritabanı Yedeği Alınıyor..."
echo "------------------------------------------------------------"
bash "${SCRIPT_DIR}/backup_db.sh"

echo ""
echo "------------------------------------------------------------"
echo "⚙️  [2/3] Alembic Migrasyonu Uygulanıyor (upgrade head)..."
echo "------------------------------------------------------------"
docker compose exec -T backend alembic upgrade head

echo ""
echo "------------------------------------------------------------"
echo "🔍 [3/3] Aktif Alembic Sürümü Doğrulanıyor (alembic current)..."
echo "------------------------------------------------------------"
docker compose exec -T backend alembic current

echo ""
echo "✅ Faz 3 veritabanı migrasyonu başarıyla tamamlandı!"
