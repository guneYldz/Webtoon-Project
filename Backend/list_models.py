import google.generativeai as genai
import os
from dotenv import load_dotenv

load_dotenv()

api_key = os.getenv("GOOGLE_API_KEY")

if not api_key:
    print("HATA: .env dosyasında API Key bulunamadı!")
else:
    genai.configure(api_key=api_key)
    
    print("\n🔍 Senin API Anahtarının kullanabildiği modeller aranıyor...\n")
    try:
        # Mevcut modelleri listele
        for m in genai.list_models():
            if 'generateContent' in m.supported_generation_methods:
                print(f"✅ İSİM: {m.name}")
    except Exception as e:
        print(f"❌ HATA: {e}")