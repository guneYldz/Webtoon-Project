import requests
import os
from dotenv import load_dotenv

load_dotenv()

API_URL = "http://127.0.0.1:8000"
USERNAME = os.getenv("BOT_USERNAME")
PASSWORD = os.getenv("BOT_PASSWORD")
if not USERNAME or not PASSWORD:
    raise RuntimeError("BOT_USERNAME ve BOT_PASSWORD .env içinde olmalı")

# Olası tüm giriş adresleri
olasi_adresler = [
    "/auth/token",          # FastAPI Standart
    "/auth/giris-yap",      # Türkçe
    "/auth/login",          # İngilizce
    "/token",               # Ana dizin standart
    "/login",               # Ana dizin basit
    "/giris-yap",           # Ana dizin Türkçe
    "/users/token",         # Alternatif
    "/api/auth/token"       # Prefixli
]

print("🕵️ Dedektif Modu: Giriş adresi aranıyor...\n")

for adres in olasi_adresler:
    tam_url = f"{API_URL}{adres}"
    print(f"Denenen Adres: {adres} ...", end=" ")
    
    try:
        # JSON ile dene
        res = requests.post(tam_url, json={"username": USERNAME, "password": PASSWORD})
        
        if res.status_code == 200:
            print("✅ BULUNDU! (JSON ile çalıştı)")
            print(f"\n🎉 DOĞRU ADRES: {adres}")
            print("Lütfen bot.py dosyanı bu adrese göre güncelle.")
            break
        elif res.status_code == 422:
            # Belki Form Data istiyordur
            res = requests.post(tam_url, data={"username": USERNAME, "password": PASSWORD})
            if res.status_code == 200:
                print("✅ BULUNDU! (Form Data ile çalıştı)")
                print(f"\n🎉 DOĞRU ADRES: {adres}")
                print("Lütfen bot.py dosyanı bu adrese göre güncelle.")
                break
            else:
                print("❌ (422 Veri Tipi Hatası)")
        elif res.status_code == 404:
            print("❌ (404 Yok)")
        elif res.status_code == 405:
            print("❌ (405 Metod İzin Verilmedi)")
        else:
            print(f"❌ ({res.status_code})")
            
    except Exception as e:
        print(f"❌ Bağlantı Hatası: {e}")

print("\n--- Tarama Bitti ---")