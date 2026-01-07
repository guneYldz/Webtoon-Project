import google.generativeai as genai

# Bot.py içindeki API KEY'ini buraya yapıştır
GOOGLE_API_KEY = "AIzaSyB5mA0tdQe7gQnAtHqsibZi0L6qtUO0Lqk"

genai.configure(api_key=GOOGLE_API_KEY)

print("Kullanılabilir Modeller Listeleniyor...")
try:
    for m in genai.list_models():
        if 'generateContent' in m.supported_generation_methods:
            print(f"- {m.name}")
except Exception as e:
    print(f"Hata: {e}")