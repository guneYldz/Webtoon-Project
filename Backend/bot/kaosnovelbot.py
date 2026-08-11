import requests
from bs4 import BeautifulSoup
from google import genai
import time
import os
import sys
import json
import itertools
from dotenv import load_dotenv
import cloudscraper
import re  # Bölüm başlığı regex için

# ==========================================
# ⚙️ AYARLAR VE YAPILANDIRMA
# ==========================================
load_dotenv()

# 4 API Key Rotasyonu
GOOGLE_API_KEYS = [
    k for k in [
        os.getenv("GOOGLE_API_KEY"),
        os.getenv("GOOGLE_API_KEY_2"),
        os.getenv("GOOGLE_API_KEY_3"),
        os.getenv("GOOGLE_API_KEY_4"),
        os.getenv("GOOGLE_API_KEY_5"),
        os.getenv("GOOGLE_API_KEY_6"),
        os.getenv("GOOGLE_API_KEY_7")

    ] if k
]

_current_key_index = 0

def get_gemini_client():
    return genai.Client(api_key=GOOGLE_API_KEYS[_current_key_index])

def rotate_key():
    global _current_key_index
    _current_key_index = (_current_key_index + 1) % len(GOOGLE_API_KEYS)
    print(f"🔄 API Key rotasyonu: Key #{_current_key_index + 1} aktif")

client = get_gemini_client() if GOOGLE_API_KEYS else None

# LOCALHOST AYARI: Docker'ın dışarı açtığı porta bağlanıyoruz.
API_URL = "http://127.0.0.1:8000"

BOT_USERNAME = os.getenv("BOT_USERNAME", "gunyz.62@gmail.com")
BOT_PASSWORD = os.getenv("BOT_PASSWORD", "62dersim62")
BEKLEME_SURESI = 15


# SERİYE ÖZEL AYARLAR (Config Yapısı)
NOVEL_CONFIGS = {
    "Shadow Slave": """
        1. "Nightmare Spell" -> "Kabus Büyüsü"
        2. "First Trial" -> "İlk Sınav"
        3. "Aspirant" -> "Aday"
        4. "Awakened" -> "Uyanmış"
        5. "Sleeper" -> "Uyuyan"
        6. "Sunny" -> "Sunny", "Nephis" -> "Nephis"
        7. "Legacy" -> "Miras"
        8. "Aspect" -> "Veçhe"
        9. "Memory" -> "Anı"
        10. "Echo" -> "Yankı"
    """,
    "Ghost Story": """
        1. "Ghost Story" -> "Hayalet Hikayesi"
        2. "Entity" -> "Varlık" (Eğer korkutucu bir tondaysa "Ucube" de kullanılabilir)
        3. "Cursed" -> "Lanetli"
        4. "Talisman" -> "Tılsım"
        5. "Exorcist" -> "Ruh Kovucu"
        6. "Evil Spirit" -> "Kötücül Ruh"
        7. "Eerie" -> "Ürkütücü / Tekin olmayan"
        8. "Haunted" -> "Perili / Musallatlı"
        9. "System" -> "Sistem"
        10. "Still gotta work" -> "Hâlâ çalışmak lazım" (Serinin ironik tonunu koru)
        11. Karakter adlarını (varsa özel isimler) ASLA çevirme.
        12. Ton: Gerilimli ama ana karakterin işine bağlılığını hissettiren, hafif absürt ve edebi bir dil.
    """,
    "default": """
        1. Özel isimleri (Karakter adları, şehir adları) ASLA çevirme.
        2. Büyü isimlerini mümkünse Türkçe karşılığıyla, parantez içinde İngilizcesi olacak şekilde çevir.
        3. Ton: Edebi, akıcı ve romanın türüne uygun.
    """,
}

# ==========================================
# 🔑 YARDIMCI FONKSİYONLAR
# ==========================================
def get_auth_token():
    try:
        response = requests.post(f"{API_URL}/auth/giris-yap", data={"username": BOT_USERNAME, "password": BOT_PASSWORD})
        if response.status_code == 200:
            print("✅ Giriş Başarılı! Token alındı.")
            return response.json().get("access_token")
        else:
            print(f"❌ Giriş Reddedildi! Kod: {response.status_code} | Hata: {response.text}")
            return None
    except Exception as e:
        print(f"❌ Sunucuya Bağlanılamadı (Local API): {e}")
        return None

def get_last_chapter_number(token, novel_id, novel_slug):
    headers = {"Authorization": f"Bearer {token}"}
    for identifier in [novel_id, novel_slug]:
        try:
            res = requests.get(f"{API_URL}/novels/{identifier}", headers=headers)
            if res.status_code == 200:
                chapters = res.json().get("chapters", [])
                return max([ch["chapter_number"] for ch in chapters]) if chapters else 0
        except: continue
    return 0

def get_all_novels(token):
    headers = {"Authorization": f"Bearer {token}"}
    try:
        res = requests.get(f"{API_URL}/novels/", headers=headers)
        if res.status_code == 200:
            return res.json()
        else:
            print(f"❌ Romanlar çekilemedi! Sunucu Kod: {res.status_code}")
            return []
    except Exception as e:
        print(f"❌ Roman API'sine bağlanırken hata: {e}")
        return []

# ==========================================
# 🕷️ SCRAPER
# ==========================================
# 🚨 HAYALET BÖLÜM (Ghost Chapter) Koruması
# Freewebnovel olmayan bölümlerde 404 vermek yerine sahte sayfa gösterebilir.
# Bu anahtar kelimelerden biri içerikteyse bölüm sahte demektir.
GHOST_CHAPTER_KEYWORDS = [
    "coming soon", "chapter not found", "this chapter is locked",
    "chapter is not available", "no chapter found", "page not found",
    "does not exist", "chapter coming soon", "will be released",
    "subscribe to read", "premium chapter", "locked chapter",
]
MIN_CHAPTER_LENGTH = 1500  # Gerçek bir roman bölümü en az ~300 kelime = ~1500 karakter

# ✅ DÜZELTME: Scraper GLOBAL SINGLETON olarak yaratılır.
# Her bölümde yeni scraper açmak 'Too many open files' hatasına yol açar.
# cloudscraper 'with' bloğunu (context manager) DESTEKLEMEZ — AttributeError verir.
_scraper = cloudscraper.create_scraper()

def _reset_scraper():
    """SSL veya bağlantı hatası sonrası eski scraper'ı kapat, yenisini aç."""
    global _scraper
    try:
        _scraper.close()  # Açık bağlantıları temizle
    except Exception:
        pass
    _scraper = cloudscraper.create_scraper()
    print("   🔄 Scraper yeniden başlatıldı.")

def scrape_chapter(url, current_ch_num):
    print(f"   🌍 Kaynak taranıyor: {url}")
    # Global singleton scraper kullanılıyor — her çağrıda YENİ scraper AÇILMAZ
    global _scraper
    MAX_RETRIES = 3
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            # 🛡️ KORUMA 1: Yönlendirme (Redirect) Algılayıcı
            response = _scraper.get(url, timeout=15)
            break  # Başarılıysa döngüden çık
        except Exception as e:
            err_str = str(e)
            is_ssl_or_file_error = "SSLError" in err_str or "Too many open files" in err_str or "Max retries" in err_str
            if is_ssl_or_file_error and attempt < MAX_RETRIES:
                print(f"   ⚠️ Bağlantı hatası (Deneme {attempt}/{MAX_RETRIES}), scraper sıfırlanıyor ve 10sn bekleniyor...")
                _reset_scraper()
                time.sleep(10)
            else:
                print(f"   ❌ Scraping Hatası: {e}")
                return None, None
    else:
        # MAX_RETRIES deneme de başarısız olduysa
        return None, None

    try:
        if response.status_code != 200: return None, None

        # Final URL ile istenen URL'i karşılaştır
        final_url = response.url.rstrip('/')
        requested_url = url.rstrip('/')
        if final_url != requested_url:
            print(f"   🚨 SERİ SONU TESPİT EDİLDİ! (Yönlendirme — kesin bitiş)")
            print(f"      İstenen : {requested_url}")
            print(f"      Gidilen  : {final_url}")
            # "SERIES_END" sinyali → ana döngü hemen break yapar
            return "SERIES_END", None

        soup = BeautifulSoup(response.text, 'html.parser')
        title_tag = soup.find('h1') or soup.find('span', class_='title__')

        content = soup.find('div', class_='txt') or soup.find('div', id='content')

        if content:
            for bad in content.find_all(['script', 'style', 'iframe', 'a']):
                bad.decompose()

            # --- BAŞLIK TEMİZLİĞİ BAŞLIYOR (Terminatör Radar) ---
            clean_title = f"Bölüm {current_ch_num}"  # Varsayılan halimiz

            # Sitenin başlık barındırabilecek TÜM etiketlerini acımadan tarıyoruz
            for tag in soup.find_all(['title', 'h1', 'h2', 'h3', 'h4', 'span', 'div']):
                text = tag.get_text(separator=" ", strip=True)

                # "Chapter 1 Nightmare Begins" veya "Chapter 1 - Nightmare Begins" formatını ara
                match = re.search(rf'Chapter\s*{re.escape(str(current_ch_num))}\s*[:-]?\s*(.+)', text, re.IGNORECASE)

                if match:
                    extra_name = match.group(1).strip()

                    # Reklam ve site adı kalıntılarını temizle
                    extra_name = re.sub(r'(?i)\s*online for free.*$', '', extra_name).strip()
                    extra_name = re.sub(r'(?i)\s*-?\s*freewebnovel.*$', '', extra_name).strip()
                    extra_name = re.sub(r'(?i)\s*-?\s*read online.*$', '', extra_name).strip()
                    extra_name = re.sub(r'(?i)\s*\|\s*.*$', '', extra_name).strip()  # "Title | SiteName" kalıpları

                    # Bulunan isim mantıklı bir uzunluktaysa (ne çok kısa, ne de destan gibi uzun)
                    if 1 < len(extra_name) < 80:
                        clean_title = f"Bölüm {current_ch_num} - {extra_name}"
                        print(f"   🎯 Başlık bulundu: '{clean_title}'")
                        break  # Hedefi vurduk, taramayı durdur!
            # --- BAŞLIK TEMİZLİĞİ BİTTİ ---

            raw_text = content.get_text(separator="\n\n").strip()

            # 🛡️ KORUMA 2: Minimum Karakter Sayısı Kontrolü
            if len(raw_text) < MIN_CHAPTER_LENGTH:
                print(f"   👻 HAYALET BÖLÜM! (Çok Kısa İçerik: {len(raw_text)} karakter) — Bölüm {current_ch_num} atlanıyor.")
                print(f"      İçerik önizleme: '{raw_text[:200]}'")
                # "GHOST" sinyali → ana döngü bu bölümü atlayıp devam eder
                return "GHOST", None

            # 🛡️ KORUMA 3: Sahte İçerik Anahtar Kelime Filtresi
            # Sadece metnin İLK 500 karakterine bakıyoruz.
            # Gerçek "coming soon" sayfaları bu metni hemen başta içerir.
            # 1095 gibi gerçek bölümlerde sidebar/reklam köşesinde geçen
            # keyword'ler artık bölümü hayalet saymaz.
            raw_head_lower = raw_text[:500].lower()
            for keyword in GHOST_CHAPTER_KEYWORDS:
                if keyword in raw_head_lower:
                    print(f"   👻 HAYALET BÖLÜM! (İlk 500 karakterde sahte kelime: '{keyword}') — Bölüm {current_ch_num} atlanıyor.")
                    # "GHOST" sinyali → ana döngü bu bölümü atlayıp devam eder
                    return "GHOST", None

            return clean_title, raw_text
        return None, None
    except Exception as e:
        print(f"   ❌ Parse Hatası: {e}")
        return None, None
# ==========================================
# 🤖 ÇEVİRİ VE YÜKLEME
# ==========================================

# Kalıcı olarak reddedilen (ban yemiş / geçersiz) key'lerin indexleri.
# Bu key'ler oturum boyunca bir daha denenmez.
_dead_keys = set()

# 🤖 MODEL LİSTESİ (öncelik sırasıyla):
# gemini-2.5-flash yeni projelere KAPATILDI (404 "no longer available to new users").
# Google'ın resmi önerisi: gemini-3.6-flash. Bir model 404 verirse sıradakine geçilir.
GEMINI_MODELS = ["gemini-3.6-flash", "gemini-3.1-flash-lite", "gemini-2.5-flash"]
_current_model_index = 0

def call_gemini(prompt_text, label=""):
    """
    Gemini'yi çağır. 429/rate limit üzerinde key rotasyonu uygular.
    403/PERMISSION_DENIED veren key'i ölü sayıp kalıcı olarak atlar.
    404 "model kullanılamıyor" hatasında listedeki sıradaki modele geçer.
    Başarılıysa metin döndürür, tüm denemeler biterse None döndürür.
    """
    global client, _current_model_index
    max_cycles = 3
    for cycle in range(max_cycles):
        for _ in range(len(GOOGLE_API_KEYS)):
            # Ölü olduğu bilinen key'i deneme, direkt sonrakine geç
            if _current_key_index in _dead_keys:
                if len(_dead_keys) >= len(GOOGLE_API_KEYS):
                    print("❌ TÜM KEY'LER ÖLÜ (403/geçersiz)! Yeni key gerekiyor.")
                    return None
                rotate_key()
                continue
            try:
                client = get_gemini_client()
                response = client.models.generate_content(
                    model=GEMINI_MODELS[_current_model_index],
                    contents=prompt_text
                )
                return response.text.strip()
            except Exception as e:
                err = str(e)
                if "429" in err or "RESOURCE_EXHAUSTED" in err:
                    print(f"⚠️ Rate limit ({label}) - Key #{_current_key_index + 1} doldu, sonraki key'e geçiliyor...")
                    rotate_key()
                elif "404" in err and ("no longer available" in err or "NOT_FOUND" in err or "not found" in err):
                    # Model bu key/proje için kullanılamıyor → sıradaki modele geç
                    if _current_model_index + 1 < len(GEMINI_MODELS):
                        _current_model_index += 1
                        print(f"🔁 Model kullanılamıyor ({label}) → '{GEMINI_MODELS[_current_model_index]}' modeline geçiliyor...")
                    else:
                        print(f"   ❌ Listedeki hiçbir model kullanılamıyor ({label}): {e}")
                        return None
                elif "403" in err or "PERMISSION_DENIED" in err or "API_KEY_INVALID" in err or "API key not valid" in err:
                    # KALICI key hatası: Google bu key'in projesini reddetmiş.
                    # Bu key'i ölü işaretle, kalan key'lerle devam et.
                    print(f"💀 Key #{_current_key_index + 1} ÖLÜ (403/geçersiz — Google erişimi reddetti). Bu key artık atlanacak.")
                    _dead_keys.add(_current_key_index)
                    rotate_key()
                elif "503" in err or "UNAVAILABLE" in err or "500" in err or "INTERNAL" in err or "DEADLINE" in err:
                    # GEÇİCİ Google sunucu hatası (model yoğun vb.) — pes etme, bekle ve tekrar dene
                    print(f"⚠️ Geçici sunucu hatası ({label}): model yoğun/erişilemez. 30sn beklenip tekrar denenecek...")
                    time.sleep(30)
                    rotate_key()  # farklı key farklı kapasiteye düşebilir, denemeye değer
                else:
                    print(f"   ❌ API Hatası ({label}): {e}")
                    return None
        if len(_dead_keys) >= len(GOOGLE_API_KEYS):
            print("❌ TÜM KEY'LER ÖLÜ (403/geçersiz)! Yeni key gerekiyor.")
            return None
        print(f"⏳ Kullanılabilir key'ler rate limit'e çarptı. 65sn bekleniyor... (Döngü {cycle+1}/{max_cycles})")
        time.sleep(65)
    print("❌ Tüm API denemeleri başarısız.")
    return None


def split_text_into_chunks(text, max_chars=9000):
    """
    Metni paragraf sınırlarından bölerek max_chars'ı aşmayan parçalara ayırır.
    Uzun bölümlerin [:8000] kırpması yüzünden eksik çevrilmesini önler:
    her parça ayrı çevrilip sonra birleştirilir.
    """
    paragraphs = text.split("\n\n")
    chunks = []
    current = ""
    for p in paragraphs:
        if current and len(current) + len(p) + 2 > max_chars:
            chunks.append(current)
            current = p
        else:
            current = f"{current}\n\n{p}" if current else p
    if current:
        chunks.append(current)
    return chunks


def translate_and_upload(token, novel, chapter_num, eng_title, eng_text, guncelle=False):
    """
    guncelle=False → yeni bölüm ekler (POST /novels/bolum-ekle)
    guncelle=True  → mevcut bölümün İÇERİĞİNİ günceller (PUT), Türkçe başlık korunur.
    """
    global client

    if not client:
        print("❌ HATA: Gemini client başlatılamadı!")
        return "ERROR"

    novel_key = "default"
    if "Shadow Slave" in novel['title']: novel_key = "Shadow Slave"
    elif "Ghost Story" in novel['title']: novel_key = "Ghost Story"

    config = NOVEL_CONFIGS[novel_key]

    # Başlıktaki özel ismi çıkar (örn: "Bölüm 1 - Nightmare Begins" → "Nightmare Begins")
    # Tire yoksa (düz "Bölüm 1") eng_isim boş kalır — o zaman başlık çevirisi istemeyiz
    eng_isim = ""
    if " - " in eng_title:
        eng_isim = eng_title.split(" - ", 1)[1].strip()

    # ==================================================
    # METNİ PARÇALARA BÖL (uzun bölümler eksik çevrilmesin)
    # Eski kod eng_text[:8000] ile kırpıyordu → bölüm sonu kayboluyordu.
    # ==================================================
    chunks = split_text_into_chunks(eng_text)
    print(f"   🤖 AI ({novel_key}) Çeviriyor... ({len(eng_text)} karakter, {len(chunks)} parça) (Key: {GOOGLE_API_KEYS[_current_key_index][:5]}...)")

    if eng_isim:
        baslik_talimati = f"""
BÖLÜM İSMİ ÇEVİRİSİ:
- Şu İngilizce bölüm ismini Türkçeye çevir: "{eng_isim}"
- Çeviriyi şu formatta yaz (tırnak veya noktalama eklemeden):
  BAŞLIK: <Türkçe isim>
"""
    else:
        baslik_talimati = "BÖLÜM İSMİ: Bu bölümün özel bir ismi yok, BAŞLIK satırı yazma."

    ceviri_kurallari = f"""
ROMAN METNİ ÇEVİRİSİ KURALLARI (ZORUNLU):
1. ASLA "Elbette", "İşte çeviri", "Tabii ki" gibi AI giriş cümleleri YAZMA.
2. SADECE çevrilmiş roman metnini döndür — açıklama, not veya yorum EKLEME.
3. Paragraf düzenini KORU: Orijinaldeki her paragraf ayrı paragraf olarak kalmalı.
4. Metnin TAMAMINI çevir — hiçbir cümleyi veya paragrafı ATLAMA, özetleme.
5. Kopuk, anlamsız veya yarım kalan cümle BIRAKMA — gerekirse önceki/sonraki cümleyle birleştir.
6. "Ve...", "Ama..." ile başlayan tek başına duran kısa cümleleri önceki cümleye ekle.
7. Bire bir sözcük çevirisi YAPMA; anlamı, duyguyu ve romanın akışını Türkçeye taşı.
8. Her cümle akışkan, doğal, kitap okur gibi hissettirmeli.

ROMANIN TÜRÜNE ÖZEL TALİMATLAR:
{config}
"""

    translated_parts = []
    for i, chunk in enumerate(chunks, 1):
        if i == 1:
            translation_prompt = f"""
Sen usta bir roman çevirmenisin. Tek seferde hem bölüm ismini hem de metni Türkçeye çevir.

{baslik_talimati}

{ceviri_kurallari}

ÇEVİRİLECEK METİN:
{chunk}
"""
        else:
            translation_prompt = f"""
Sen usta bir roman çevirmenisin. Aşağıdaki metin, bir roman bölümünün DEVAMIDIR (parça {i}/{len(chunks)}). Türkçeye çevir.

BAŞLIK satırı YAZMA — bu sadece metin devamıdır.

{ceviri_kurallari}

ÇEVİRİLECEK METİN:
{chunk}
"""
        parca = call_gemini(translation_prompt, label=f"Çeviri {i}/{len(chunks)}")
        if parca is None:
            print("❌ Çeviri başarısız. Bot 1 saat uyuyor...")
            time.sleep(3600)
            return "ERROR"
        translated_parts.append(parca)
        if len(chunks) > 1:
            print(f"      ✔ Parça {i}/{len(chunks)} çevrildi.")

    ceviri_ham = "\n\n".join(translated_parts)

    # ==================================================
    # ÇIKTIYI AYRIŞTIR: BAŞLIK + METİN
    # ==================================================
    tr_title = f"Bölüm {chapter_num}"  # varsayılan

    if eng_isim:
        # "BAŞLIK: Kabus Başlıyor" satırını ara (Gemini'nin nereye yazdığına bakmaksızın)
        baslik_match = re.search(r'BAŞLIK\s*:\s*(.+)', ceviri_ham, re.IGNORECASE)
        if baslik_match:
            tr_isim = baslik_match.group(1).strip().strip('"\'')
            # Başlık mantıklı uzunluktaysa kullan, değilse İngilizce orijinali koy
            if 1 < len(tr_isim) < 100:
                tr_title = f"Bölüm {chapter_num} - {tr_isim}"
                print(f"   🎯 Türkçe başlık: '{tr_title}'")
            else:
                tr_title = f"Bölüm {chapter_num} - {eng_isim}"
                print(f"   ⚠️ Başlık parse hatası, İngilizce kullanıldı: '{tr_title}'")
            # BAŞLIK satırını metinden çıkar
            ceviri_metin = re.sub(r'BAŞLIK\s*:\s*.+\n?', '', ceviri_ham, flags=re.IGNORECASE).strip()
        else:
            # Marker bulunamadı — ilk satırı başlık say, kalanı metin
            print("   ⚠️ BAŞLIK marker bulunamadı, ilk satır deneniyor...")
            satirlar = ceviri_ham.split('\n', 1)
            ilk_satir = satirlar[0].strip()
            # İlk satır kısa ve AI giriş cümlesi değilse başlık kabul et
            ai_giris = any(ilk_satir.lower().startswith(k) for k in ["işte", "elbette", "tabii", "çeviri", "aşağıda"])
            if not ai_giris and len(ilk_satir) < 80:
                tr_title = f"Bölüm {chapter_num} - {ilk_satir}"
                ceviri_metin = satirlar[1].strip() if len(satirlar) > 1 else ceviri_ham
            else:
                tr_title = f"Bölüm {chapter_num} - {eng_isim}"  # güvenli fallback
                ceviri_metin = ceviri_ham
    else:
        # Özel isim yoktu, tüm yanıt metindir
        ceviri_metin = ceviri_ham

    # Kalan AI giriş cümlelerini temizle
    for giris in ["İşte çeviri:\n", "Elbette!\n", "Tabii ki:\n", "Aşağıda:\n"]:
        if ceviri_metin.startswith(giris):
            ceviri_metin = ceviri_metin[len(giris):].strip()

    # ==================================================
    # 2. PAŞ: EDEBİYAT EDİTÖRÜ (Sadece metin — başlık kilitli)
    # tr_title zaten güvende, buna HİÇ dokunmuyoruz
    # ==================================================
    polish_chunks = split_text_into_chunks(ceviri_metin)
    print(f"   ✨ Edebiyat editörü devrede (2. paş, {len(polish_chunks)} parça)...")

    polished_parts = []
    polish_failed = False
    for i, p_chunk in enumerate(polish_chunks, 1):
        polish_prompt = f"""
Sen titiz bir Türk edebiyat editörüsün. Aşağıdaki roman çevirisini, anlamını veya paragraf sayısını DEĞİŞTİRMEDEN yeniden yaz.

YAPACAKLARIN:
1. Mekanik, ruhsuz veya "çeviri gibi" hissettiren cümleleri doğal, akıcı Türkçeye dönüştür.
2. Kopuk, yarım veya bağlaçla başlayan kısa cümleleri bir öncekiyle birleştir.
3. İngilizce cümle yapısından kaynaklanan kelime sırası bozukluklarını düzelt.
4. Karakterin sesini, tonunu ve duygusunu koru — anlamı asla değiştirme.
5. Gereksiz tekrarları at, ama yeni cümle veya fikir EKLEME.

SERİYE ÖZEL TALIMATLAR (bunu da uygula):
{config}

YAPAMAYACAKLARIN:
- "İşte", "Elbette", "Düzeltilmiş metin:" gibi AI çıkış cümleleri YAZMA.
- Paragraf SILME veya BİRLEŞTİRME — her paragraf ayrı kalmalı.
- Metni KISALTMA veya ÖZETLEME — tamamını yeniden yaz.
- Yorum veya açıklama EKLEME.

ÇEVİRİ METNİ:
{p_chunk}
"""
        parca_polish = call_gemini(polish_prompt, label=f"Editör {i}/{len(polish_chunks)}")
        if parca_polish:
            # Giriş cümlesi varsa temizle
            for giris in ["İşte", "Elbette", "Düzeltilmiş", "Aşağıda", "Tabii"]:
                if parca_polish.lstrip().startswith(giris):
                    parca_polish = "\n".join(parca_polish.split("\n")[1:]).strip()
                    break
            polished_parts.append(parca_polish)
        else:
            # Bu parça için editör başarısız → ham çeviri parçasını koru
            polish_failed = True
            polished_parts.append(p_chunk)

    ceviri_metin = "\n\n".join(polished_parts)
    if polish_failed:
        print("   ⚠️ Editör pası kısmen başarısız, o parçalarda ham çeviri kullanıldı.")
    else:
        print(f"   ✅ Editör tamamladı.")

    # ==================================================
    # KAYDET  (tr_title Pass 1'den kilitli, asla değişmedi)
    # ==================================================
    headers = {"Authorization": f"Bearer {token}"}

    if guncelle:
        # ONARIM: mevcut bölümün içeriğini değiştir, başlığa dokunma (zaten Türkçe)
        payload = {"content": ceviri_metin}
        res = requests.put(f"{API_URL}/novels/{novel['slug']}/chapters/{chapter_num}", data=payload, headers=headers)
        if res.status_code == 200:
            print(f"   🎉 Bölüm {chapter_num} GÜNCELLENDİ! (Yeni içerik: {len(ceviri_metin)} karakter)")
            return "SUCCESS"
        print(f"   ❌ Güncelleme Hatası: {res.status_code} - {res.text}")
        return "ERROR"

    payload = {"novel_id": novel['id'], "chapter_number": chapter_num, "title": tr_title, "content": ceviri_metin}
    res = requests.post(f"{API_URL}/novels/bolum-ekle", data=payload, headers=headers)

    if res.status_code in [200, 201]:
        print(f"   🎉 Bölüm {chapter_num} BAŞARIYLA KAYDEDİLDİ! (Başlık: {tr_title})")
        return "SUCCESS"
    elif res.status_code == 400 and "mevcut" in res.text:
        return "SKIP"
    else:
        print(f"   ❌ Kayıt Hatası: {res.status_code} - {res.text}")
        return "ERROR"

# ==========================================
# 🔧 ONARIM MODU (--onar)
# Eski [:8000] kırpma hatası yüzünden eksik çevrilmiş bölümleri bulur
# ve tamamını yeniden çevirip günceller. Sağlam bölümlere DOKUNMAZ.
# ==========================================
ONARIM_CHECKPOINT_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "onar_checkpoint.json")
ONARIM_SURUM = 2         # Tespit mantığı değişirse artır → eski checkpoint sıfırlanır, her şey yeniden kontrol edilir
ONARIM_EN_MIN = 8000     # İngilizce kaynak bundan kısaysa kırpma hatasından etkilenmemiştir
ONARIM_ORAN_ESIK = 0.80  # TR/EN karakter oranı bunun altındaysa şüpheli (tam çeviri ~%85-110 olur)
ONARIM_TR_SUPHE_MAX = 9200  # Kırpık çeviri en fazla ~8000×1.15 karakter olabilir.
                            # TR bundan uzunsa bölüm kesin tam çevrilmiştir.

def load_onarim_checkpoint(checkpoint_file):
    """Daha önce doğrulanan bölümleri diskten yükle (bot yarıda kesilirse kaldığı yerden devam eder)."""
    try:
        with open(checkpoint_file, "r", encoding="utf-8") as f:
            data = json.load(f)
        if data.get("_surum") != ONARIM_SURUM:
            print("   ♻️ Tespit mantığı güncellendi — eski checkpoint sıfırlanıyor, tüm bölümler yeniden kontrol edilecek.")
            return {"_surum": ONARIM_SURUM}
        return data
    except Exception:
        return {"_surum": ONARIM_SURUM}

def save_onarim_checkpoint(checkpoint, checkpoint_file):
    try:
        with open(checkpoint_file, "w", encoding="utf-8") as f:
            json.dump(checkpoint, f, ensure_ascii=False, indent=1)
    except Exception as e:
        print(f"   ⚠️ Checkpoint kaydedilemedi: {e}")

def get_chapter_list(token, novel):
    """Romanın veritabanındaki bölüm listesini (numara + başlık) getirir."""
    headers = {"Authorization": f"Bearer {token}"}
    for identifier in [novel.get('slug'), novel.get('id')]:
        try:
            res = requests.get(f"{API_URL}/novels/{identifier}", headers=headers)
            if res.status_code == 200:
                return res.json().get("chapters", [])
        except Exception:
            continue
    return []

def get_chapter_content(novel_slug, chapter_number):
    """Mevcut bölümün Türkçe içeriğini getirir. Hata olursa None döner."""
    try:
        res = requests.get(f"{API_URL}/novels/{novel_slug}/chapters/{chapter_number}")
        if res.status_code == 200:
            return res.json().get("content", "") or ""
    except Exception:
        pass
    return None

def repair_mode(kesin=False):
    if kesin:
        # KESİN MOD: Oran tahminine güvenme. İngilizcesi 8000 karakterden uzun
        # olan (yani kırpma hatasından etkilenmiş OLABİLECEK) her bölümü,
        # Türkçesi zaten kesin-tam olanlar (TR ≥ 9200) hariç, yeniden çevir.
        checkpoint_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), "onar_checkpoint_kesin.json")
        print("🔧 ONARIM MODU BAŞLATILDI (--onar --kesin)")
        print("   KESİN MOD: Etkilenmiş olabilecek TÜM bölümler orana bakılmadan yeniden çevrilecek.")
    else:
        checkpoint_file = ONARIM_CHECKPOINT_FILE
        print("🔧 ONARIM MODU BAŞLATILDI (--onar)")
        print("   Eksik çevrilmiş (8000 karakterde kırpılmış) bölümler tespit edilip yeniden çevrilecek.")
    print(f"   Checkpoint dosyası: {checkpoint_file}")

    token = get_auth_token()
    if not token:
        print("❌ Giriş yapılamadı, onarım iptal.")
        return

    novels = get_all_novels(token)
    KAOS_DOMAINS = ["freewebnovel.com"]
    active_novels = [
        n for n in novels
        if n.get('source_url') and any(d in n['source_url'] for d in KAOS_DOMAINS)
    ]
    print(f"🎯 Kontrol edilecek roman sayısı: {len(active_novels)}")

    checkpoint = load_onarim_checkpoint(checkpoint_file)
    stats = {"saglam": 0, "onarildi": 0, "eklendi": 0, "kaynak_yok": 0, "hata": 0}

    for novel in active_novels:
        slug = novel['slug']
        print(f"\n📖 ONARIM KONTROLÜ: {novel['title']}")

        chapters = get_chapter_list(token, novel)
        if not chapters:
            print("   ⚠️ Bölüm listesi alınamadı, roman atlanıyor.")
            continue

        mevcut_numaralar = {float(ch["chapter_number"]) for ch in chapters}
        max_ch = int(max(mevcut_numaralar))
        cp_novel = checkpoint.setdefault(slug, {})
        kalan = sum(1 for n in range(1, max_ch + 1) if str(n) not in cp_novel)
        print(f"   📊 Veritabanında {len(mevcut_numaralar)} bölüm var (en yüksek: {max_ch}). Kontrol edilecek: {kalan}")

        consecutive_errors = 0

        for num in range(1, max_ch + 1):
            key = str(num)
            if key in cp_novel:
                continue  # Bu bölüm daha önce doğrulandı/işlendi

            # ── 1. İngilizce kaynağı çek ─────────────────────────
            target_url = novel['source_url'].format(num)
            eng_title, eng_text = scrape_chapter(target_url, num)
            time.sleep(2)  # Kaynak siteyi yormamak için bekleme

            if eng_title in ("SERIES_END", "GHOST") or not eng_text:
                print(f"   ⏭️  Bölüm {num}: kaynak alınamadı (hayalet/yönlendirme), atlanıyor.")
                cp_novel[key] = "kaynak_yok"
                save_onarim_checkpoint(checkpoint, checkpoint_file)
                stats["kaynak_yok"] += 1
                continue

            # ── 2. Bölüm veritabanında hiç yoksa → çevir ve EKLE ──
            if float(num) not in mevcut_numaralar:
                print(f"   ➕ Bölüm {num} veritabanında YOK → çevrilip ekleniyor...")
                status = translate_and_upload(token, novel, num, eng_title, eng_text)
                if status in ("SUCCESS", "SKIP"):
                    cp_novel[key] = "ok"
                    save_onarim_checkpoint(checkpoint, checkpoint_file)
                    stats["eklendi"] += 1
                    consecutive_errors = 0
                    time.sleep(5)
                else:
                    stats["hata"] += 1
                    consecutive_errors += 1
                    if consecutive_errors >= 3:
                        print("   🛑 Art arda 3 hata — bu roman atlanıyor (checkpoint sayesinde sonraki çalıştırmada devam eder).")
                        break
                continue

            # ── 3. Bölüm varsa → Türkçe içeriğin uzunluğunu kontrol et ──
            tr_content = get_chapter_content(slug, num)
            if tr_content is None:
                print(f"   ⚠️ Bölüm {num}: Türkçe içerik okunamadı, atlanıyor.")
                stats["hata"] += 1
                continue

            # İngilizce kaynak 8000 karakterden kısaysa kırpma hatası bu bölümü ETKİLEMEMİŞTİR
            if len(eng_text) <= ONARIM_EN_MIN:
                print(f"   ✅ Bölüm {num} sağlam (EN {len(eng_text)} ≤ {ONARIM_EN_MIN} karakter, kırpma bu bölümü etkilememiş).")
                cp_novel[key] = "ok"
                save_onarim_checkpoint(checkpoint, checkpoint_file)
                stats["saglam"] += 1
                continue

            # KIRPILMA İMZASI KONTROLÜ:
            # Eski hata EN'in ilk 8000 karakterini çeviriyordu → kırpık TR her zaman
            # ~9200 karakterin ALTINDA kalır (8000 × ~1.15 tavan).
            # TR bundan uzunsa bölüm kesin tamdır.
            oran = len(tr_content) / len(eng_text)
            if len(tr_content) >= ONARIM_TR_SUPHE_MAX:
                print(f"   ✅ Bölüm {num} sağlam (TR {len(tr_content)} ≥ {ONARIM_TR_SUPHE_MAX} karakter — kırpık çeviri bu uzunluğa ulaşamaz).")
                cp_novel[key] = "ok"
                save_onarim_checkpoint(checkpoint, checkpoint_file)
                stats["saglam"] += 1
                continue

            # Normal mod: orana bakılır (tam çeviri EN'le orantılı büyür, ~%85-110).
            # Kesin mod: oran tahminine güvenilmez, şüpheli her bölüm yeniden çevrilir.
            if not kesin and oran >= ONARIM_ORAN_ESIK:
                print(f"   ✅ Bölüm {num} sağlam (EN {len(eng_text)} / TR {len(tr_content)} karakter, oran %{oran*100:.0f}).")
                cp_novel[key] = "ok"
                save_onarim_checkpoint(checkpoint, checkpoint_file)
                stats["saglam"] += 1
                continue

            # ── 4. EKSİK/ŞÜPHELİ bölüm → tamamını yeniden çevir, üzerine yaz ──
            sebep = "şüpheli (kesin mod)" if (kesin and oran >= ONARIM_ORAN_ESIK) else "EKSİK"
            print(f"   🔧 Bölüm {num} {sebep}! (EN {len(eng_text)} / TR {len(tr_content)} karakter, oran %{oran*100:.0f}) → yeniden çevriliyor...")
            status = translate_and_upload(token, novel, num, eng_title, eng_text, guncelle=True)
            if status == "SUCCESS":
                cp_novel[key] = "ok"
                save_onarim_checkpoint(checkpoint, checkpoint_file)
                stats["onarildi"] += 1
                consecutive_errors = 0
                time.sleep(5)
            else:
                stats["hata"] += 1
                consecutive_errors += 1
                if consecutive_errors >= 3:
                    print("   🛑 Art arda 3 hata — bu roman atlanıyor (checkpoint sayesinde sonraki çalıştırmada devam eder).")
                    break

    print("\n" + "=" * 50)
    print("🏁 ONARIM TAMAMLANDI — ÖZET:")
    print(f"   ✅ Sağlam (dokunulmadı) : {stats['saglam']}")
    print(f"   🔧 Onarıldı (güncellendi): {stats['onarildi']}")
    print(f"   ➕ Yeni eklendi          : {stats['eklendi']}")
    print(f"   ⏭️  Kaynak yok/hayalet    : {stats['kaynak_yok']}")
    print(f"   ❌ Hata                  : {stats['hata']}")
    print("=" * 50)

# ==========================================
# 🏭 ANA DÖNGÜ
# ==========================================
if __name__ == "__main__":
    if "--onar" in sys.argv:
        repair_mode(kesin=("--kesin" in sys.argv))
        sys.exit(0)

    print("🚀 KAOS BOT YEREL TEST MODU BAŞLATILDI")

    while True:
        token = get_auth_token()
        if token:
            novels = get_all_novels(token)
            print(f"📚 Veritabanından toplam {len(novels)} roman okundu.")

            KAOS_DOMAINS = ["freewebnovel.com"]
            active_novels = [
                n for n in novels
                if n.get('source_url') and any(d in n['source_url'] for d in KAOS_DOMAINS)
            ]
            print(f"🎯 Freewebnovel şartına uyan roman sayısı: {len(active_novels)}")

            if len(active_novels) == 0:
                print("⚠️ İşlem yapılacak uygun roman bulunamadı. Belki veritabanında 'source_url' kısmı boştur veya freewebnovel içermiyordur.")

            for novel in active_novels:
                print(f"\n🔹 KONTROL: {novel['title']}")
                last_ch = get_last_chapter_number(token, novel['id'], novel['slug'])
                current_ch = int(last_ch) + 1

                # Art arda kaç hayalet/başarısız bölüm gördük?
                # MAX_CONSECUTIVE_FAILS'e ulaşırsak seriyi bitmiş sayarız.
                MAX_CONSECUTIVE_FAILS = 3
                consecutive_fails = 0

                while True:
                    target_url = novel['source_url'].format(current_ch)
                    eng_title, eng_text = scrape_chapter(target_url, current_ch)

                    # ── Kesin Seri Sonu (redirect) ──────────────────────────
                    if eng_title == "SERIES_END":
                        print(f"   🏁 Seri gerçekten bitti (redirect). Döngü durduruluyor.")
                        break

                    # ── Hayalet Bölüm → Atla, Devam Et ────────────────────
                    if eng_title == "GHOST":
                        consecutive_fails += 1
                        print(f"   ⏭️  Hayalet bölüm atlandı ({consecutive_fails}/{MAX_CONSECUTIVE_FAILS}). Sonraki bölüme geçiliyor...")
                        if consecutive_fails >= MAX_CONSECUTIVE_FAILS:
                            print(f"   🛑 {MAX_CONSECUTIVE_FAILS} art arda hayalet bölüm — seri muhtemelen bitti.")
                            break
                        current_ch += 1
                        time.sleep(3)
                        continue

                    # ── Scraping tamamen başarısız (ağ hatası vb.) ──────────
                    if not eng_text:
                        consecutive_fails += 1
                        print(f"   ⚠️ {current_ch}. bölüm çekilemedi ({consecutive_fails}/{MAX_CONSECUTIVE_FAILS}).")
                        if consecutive_fails >= MAX_CONSECUTIVE_FAILS:
                            print(f"   🛑 {MAX_CONSECUTIVE_FAILS} art arda hata — seri atlanıyor.")
                            break
                        current_ch += 1
                        time.sleep(5)
                        continue

                    # ── Başarılı bölüm → sayacı sıfırla ───────────────────
                    consecutive_fails = 0

                    status = translate_and_upload(token, novel, current_ch, eng_title, eng_text)
                    if status in ["SUCCESS", "SKIP"]:
                        current_ch += 1
                        time.sleep(5)
                    else:
                        break

        print(f"\n💤 Bekleme modu ({BEKLEME_SURESI}sn)...")
        time.sleep(BEKLEME_SURESI)