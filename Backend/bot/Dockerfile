# Hafif bir Python sürümü seçiyoruz
FROM python:3.11-slim

# Çalışma dizinini ayarlıyoruz
WORKDIR /app

# Önce ihtiyaç listesini kopyalayıp kütüphaneleri kuruyoruz
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Sonra botun kendi kodlarını kopyalıyoruz
COPY . .

# Konteyner çalışınca botu ateşle
CMD ["python", "kaosnovelbot.py"]
