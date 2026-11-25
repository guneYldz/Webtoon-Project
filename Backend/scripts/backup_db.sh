#!/usr/bin/env bash
# ==============================================================================
# Kaos Manga — Otomatik Günlük PostgreSQL Yedekleme Betiği (Faz 2)
# ==============================================================================
# Kurulum (VPS üzerinde her gece 04:00'te otomatik çalışması için):
#   crontab -e
#   0 4 * * * cd ~/webtoon && bash Backend/scripts/backup_db.sh >> ~/webtoon_backups/backup.log 2>&1
# ==============================================================================

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-${HOME}/webtoon_backups/daily}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
FILE="${BACKUP_DIR}/webtoon_db_${TIMESTAMP}.dump"

mkdir -p "${BACKUP_DIR}"

echo "[$(date -Iseconds)] PostgreSQL yedeği alınıyor: ${FILE}"

if docker compose exec -T db pg_dump -U webtoon_admin -Fc webtoon_db > "${FILE}"; then
  if [ ! -s "${FILE}" ]; then
    echo "❌ HATA: Oluşturulan yedek dosyası boş (${FILE})!" >&2
    rm -f "${FILE}"
    exit 1
  fi
  BACKUP_SIZE="$(du -h "${FILE}" | cut -f1)"
  echo "✅ Yedek tamamlandı: ${FILE} (${BACKUP_SIZE})"
else
  echo "❌ HATA: pg_dump komutu başarısız oldu!" >&2
  rm -f "${FILE}"
  exit 1
fi

# Eski yedekleri temizle (varsayılan: 14 günden eski .dump dosyaları)
find "${BACKUP_DIR}" -maxdepth 1 -type f -name "*.dump" -mtime +"${RETENTION_DAYS}" -delete
echo "🧹 ${RETENTION_DAYS} günden eski yedekler temizlendi."
