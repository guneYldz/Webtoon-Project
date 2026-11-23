# Kaos Manga - Veritabanı Mimarisi ve Migrasyon Yönetimi

## Genel Bakış
Canlı üretim ortamında kullanılan veritabanı **PostgreSQL 15**'tir (Docker üzerinde `webtoon_db` servisi olarak çalışır).

Eski ve geçersiz olan MS-SQL tabanlı `sema.sql` dosyası arşivlenip kaldırılmıştır. Veritabanı şeması ve tüm tablo değişiklikleri artık SQLAlchemy ORM modelleri üzerinden **Alembic** migrasyon sistemi ile versiyon kontrollü olarak yönetilmektedir.

## Mimari Şema
Klasörde bulunan `diagram.jpeg` görseli, veritabanının temel ilişkisel domain modelini (kullanıcılar, seriler, bölümler, yorumlar, favoriler, okuma geçmişi vb.) göstermektedir.

## Migrasyon Yönetimi (Alembic)
Tüm migrasyon dosyaları ve yapılandırması `Backend/` dizininde yer almaktadır:
- Yapılandırma: `Backend/alembic.ini`
- Ortam Betiği: `Backend/alembic/env.py`
- Sürüm Dosyaları: `Backend/alembic/versions/`

### Sık Kullanılan Komutlar

1. **Şemayı En Son Sürüme Yükseltme (Deploy / Upgrade):**
   ```bash
   # Sunucuda (Docker compose üzerinden)
   docker compose exec backend alembic upgrade head

   # Yerel Geliştirme Ortamında (Backend dizininde)
   alembic upgrade head
   ```

2. **Yeni Otomatik Migrasyon Dosyası Üretme (Yeni bir model alanı eklendiğinde):**
   ```bash
   cd Backend
   alembic revision --autogenerate -m "aciklama_metni"
   ```

3. **Geri Alma (Rollback):**
   ```bash
   docker compose exec backend alembic downgrade -1
   ```

4. **Üretim Ortamı Faz 1 Güvenli Migrasyon Betiği:**
   Sunucuda `~/webtoon/Backend/scripts/migrate_phase1.sh` betiği, migrasyonu çalıştırmadan önce `~/webtoon_backups` dizinine tam bir pg_dump yedeği alır.
