# 1. Senin bilgisayarındaki sürümün aynısı (Hafif Linux tabanlı)
FROM python:3.14-slim

# 2. Çalışma klasörünü ayarla
WORKDIR /app

# 3. Önce gereksinimleri kopyala (Cache optimizasyonu için)
COPY requirements.txt .

# 4. Gerekli sistem araçlarını kur
# (Not: Python 3.14 çok yeni olduğu için bazı derleyiciler gerekebilir, build-essential önemli)
RUN apt-get update && apt-get install -y \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# 5. Kütüphaneleri kur
RUN pip install --no-cache-dir -r requirements.txt

# 6. Kodları içeri aktar
COPY . .

# 7. Portu dışarı aç
EXPOSE 8000

# 8. BAŞLATMA KOMUTU (Senin istediğin güvenli yöntem)
# "python -m" modül olarak çalıştırır, path sorunlarını engeller.
CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
