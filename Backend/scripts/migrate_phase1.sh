#!/usr/bin/env bash
# ==============================================================================
# Kaos Manga - Faz 1 Güvenli Veritabanı Migrasyon Betiği (Production VPS)
# ==============================================================================
# Bu betik ~/webtoon dizininde çalıştırılmalıdır.
# 1) ~/webtoon_backups dizininde sıkıştırılmış (-Fc) PostgreSQL yedeği alır.
# 2) Yedek başarısız olursa migrasyonu durdurur.
# 3) 'docker compose exec -T backend alembic upgrade head' ile şemayı günceller.
# 4) Başarı veya hata durumunda açık Türkçe geri alma (rollback) yönergeleri sunar.
# ==============================================================================

set -euo pipefail

BACKUP_DIR="${HOME}/webtoon_backups"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP_FILE="${BACKUP_DIR}/pre_phase1_${TIMESTAMP}.dump"

echo "------------------------------------------------------------"
echo "🚀 [1/3] Faz 1 Veritabanı Yedeği Alınıyor..."
echo "------------------------------------------------------------"
mkdir -p "${BACKUP_DIR}"

if docker compose exec -T db pg_dump -U webtoon_admin -Fc webtoon_db > "${BACKUP_FILE}"; then
    BACKUP_SIZE="$(du -h "${BACKUP_FILE}" | cut -f1)"
    echo "✅ Veritabanı yedeği başarıyla oluşturuldu:"
    echo "   Dosya: ${BACKUP_FILE} (${BACKUP_SIZE})"
else
    echo "❌ HATA: Veritabanı yedeği alınamadı! Migrasyon iptal edildi." >&2
    rm -f "${BACKUP_FILE}"
    exit 1
fi

echo ""
echo "------------------------------------------------------------"
echo "⚙️  [2/3] Alembic Migrasyonu Başlatılıyor (alembic upgrade head)..."
echo "------------------------------------------------------------"

if docker compose exec -T backend alembic upgrade head; then
    echo ""
    echo "------------------------------------------------------------"
    echo "🎉 [3/3] Migrasyon Başarıyla Tamamlandı!"
    echo "------------------------------------------------------------"
    echo "✅ Veritabanı şeması en son sürüme (head) yükseltildi."
    echo "📁 Alınan güvenlik yedeği: ${BACKUP_FILE}"
    echo ""
    echo "ℹ️  Gerektiğinde Yedeğe Dönüş (Rollback) Komutu:"
    echo "    docker compose exec -T db pg_restore -U webtoon_admin -d webtoon_db --clean --if-exists < \"${BACKUP_FILE}\""
else
    EXIT_CODE=$?
    echo "" >&2
    echo "------------------------------------------------------------" >&2
    echo "❌ HATA: Alembic migrasyonu başarısız oldu! (Çıkış Kodu: ${EXIT_CODE})" >&2
    echo "------------------------------------------------------------" >&2
    echo "⚠️  ACİL GERİ ALMA (ROLLBACK) SEÇENEKLERİ:" >&2
    echo "1. Alembic sürümünü bir önceki revizyona çekmek için:" >&2
    echo "   docker compose exec -T backend alembic downgrade -1" >&2
    echo "" >&2
    echo "2. VEYA alınan tam yedeği veritabanına geri yüklemek için:" >&2
    echo "   docker compose exec -T db pg_restore -U webtoon_admin -d webtoon_db --clean --if-exists < \"${BACKUP_FILE}\"" >&2
    echo "------------------------------------------------------------" >&2
    exit ${EXIT_CODE}
fi
