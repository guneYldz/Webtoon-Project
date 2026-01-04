# 📚 Webtoon & Manga Platformu

Bu proje, modern web teknolojileri kullanılarak geliştirilmiş, ölçeklenebilir bir Webtoon/Manga okuma platformudur. "Monorepo" mimarisi ile Backend ve Frontend tek çatı altında yönetilmektedir.

## 🚀 Teknolojiler

### Backend (Arka Uç)
* **Dil:** Python 3.10+
* **Framework:** FastAPI (Yüksek performanslı API)
* **Veritabanı:** MSSQL (Microsoft SQL Server)
* **ORM:** SQLAlchemy

### Frontend (Ön Yüz)
* **Framework:** React.js (Geliştirme aşamasında)
* **Stil:** CSS / Tailwind (Planlanan)

## 📂 Proje Yapısı

* `/Backend`: Python API kodları, router yapıları ve statik dosyalar.
* `/Database`: Veritabanı şeması ve SQL scriptleri.
* `/Frontend`: React tabanlı kullanıcı arayüzü.

## 🛠️ Kurulum

1.  Repoyu klonlayın.
2.  Backend klasöründe `pip install -r requirements.txt` ile kütüphaneleri kurun.
3.  Database klasöründeki SQL scriptini çalıştırarak veritabanını oluşturun.
4.  `uvicorn main:app --reload` komutu ile sunucuyu başlatın.