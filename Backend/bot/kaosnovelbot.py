import requests
from bs4 import BeautifulSoup
from google import genai
import time
import os
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
            print(f"   🚨 HAYALET BÖLÜM TESPİT EDİLDİ! (Yönlendirme)")
            print(f"      İstenen : {requested_url}")
            print(f"      Gidilen  : {final_url}")
            print(f"   🛑 Bölüm {current_ch_num} yok. Seri tamamlandı kabul ediliyor.")
            return None, None

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
                print(f"   🚨 HAYALET BÖLÜM TESPİT EDİLDİ! (Çok Kısa İçerik)")
                print(f"      İçerik uzunluğu: {len(raw_text)} karakter (minimum: {MIN_CHAPTER_LENGTH})")
                print(f"      İçerik önizleme: '{raw_text[:200]}'")
                print(f"   🛑 Bölüm {current_ch_num} yok. Seri tamamlandı kabul ediliyor.")
                return None, None

            # 🛡️ KORUMA 3: Sahte İçerik Anahtar Kelime Filtresi
            raw_text_lower = raw_text.lower()
            for keyword in GHOST_CHAPTER_KEYWORDS:
                if keyword in raw_text_lower:
                    print(f"   🚨 HAYALET BÖLÜM TESPİT EDİLDİ! (Sahte İçerik Kelimesi: '{keyword}')")
                    print(f"   🛑 Bölüm {current_ch_num} yok. Seri tamamlandı kabul ediliyor.")
                    return None, None

            return clean_title, raw_text
        return None, None
    except Exception as e:
        print(f"   ❌ Parse Hatası: {e}")
        return None, None
# ==========================================
# 🤖 ÇEVİRİ VE YÜKLEME
# ==========================================

def call_gemini(prompt_text, label=""):
    """
    Gemini'yi çağır. 429/rate limit üzerinde key rotasyonu uygular.
    Başarılıysa metin döndürür, tüm denemeler biterse None döndürür.
    """
    global client
    max_cycles = 3
    for cycle in range(max_cycles):
        for _ in range(len(GOOGLE_API_KEYS)):
            try:
                client = get_gemini_client()
                response = client.models.generate_content(
                    model='gemini-2.5-flash',
                    contents=prompt_text
                )
                return response.text.strip()
            except Exception as e:
                if "429" in str(e) or "RESOURCE_EXHAUSTED" in str(e):
                    print(f"⚠️ Rate limit ({label}) - Key #{_current_key_index + 1} doldu, sonraki key'e geçiliyor...")
                    rotate_key()
                else:
                    print(f"   ❌ API Hatası ({label}): {e}")
                    return None
        print(f"⏳ Tüm key'ler rate limit'e çarptı. 65sn bekleniyor... (Döngü {cycle+1}/{max_cycles})")
        time.sleep(65)
    print("❌ Tüm API denemeleri başarısız.")
    return None


def translate_and_upload(token, novel, chapter_num, eng_title, eng_text):
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

    print(f"   🤖 AI ({novel_key}) Tek Seferde Çeviriyor... (Key: {GOOGLE_API_KEYS[_current_key_index][:5]}...)")

    # ==================================================
    # TEK PAŞ: BAŞLIK + METİN BİR ARADA (Mega Prompt)
    # Marker tabanlı çıktı formatı: parse güvenilirliği için
    # ==================================================
    if eng_isim:
        baslik_talimati = f"""
BÖLÜM İSMİ ÇEVİRİSİ:
- Şu İngilizce bölüm ismini Türkçeye çevir: "{eng_isim}"
- Çeviriyi şu formatta yaz (tırnak veya noktalama eklemeden):
  BAŞLIK: <Türkçe isim>
"""
    else:
        baslik_talimati = "BÖLÜM İSMİ: Bu bölümün özel bir ismi yok, BAŞLIK satırı yazma."

    translation_prompt = f"""
Sen usta bir roman çevirmenisin. Tek seferde hem bölüm ismini hem de metni Türkçeye çevir.

{baslik_talimati}

ROMAN METNİ ÇEVİRİSİ KURALLARI (ZORUNLU):
1. ASLA "Elbette", "İşte çeviri", "Tabii ki" gibi AI giriş cümleleri YAZMA.
2. SADECE çevrilmiş roman metnini döndür — açıklama, not veya yorum EKLEME.
3. Paragraf düzenini KORU: Orijinaldeki her paragraf ayrı paragraf olarak kalmalı.
4. Kopuk, anlamsız veya yarım kalan cümle BIRAKMA — gerekirse önceki/sonraki cümleyle birleştir.
5. "Ve...", "Ama..." ile başlayan tek başına duran kısa cümleleri önceki cümleye ekle.
6. Bire bir sözcük çevirisi YAPMA; anlamı, duyguyu ve romanın akışını Türkçeye taşı.
7. Her cümle akışkan, doğal, kitap okur gibi hissettirmeli.

ROMANIN TÜRÜNE ÖZEL TALİMATLAR:
{config}

ÇEVİRİLECEK METİN:
{eng_text[:8000]}
"""

    ceviri_ham = call_gemini(translation_prompt, label="Mega Çeviri")
    if ceviri_ham is None:
        print("❌ Çeviri başarısız. Bot 1 saat uyuyor...")
        time.sleep(3600)
        return "ERROR"

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
    print(f"   ✨ Edebiyat editörü devrede (2. paş)...")
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
- Yorum veya açıklama EKLEME.

ÇEVİRİ METNİ:
{ceviri_metin[:8000]}
"""
    ceviri_polish = call_gemini(polish_prompt, label="Editör")
    if ceviri_polish:
        # Giriş cümlesi varsa temizle
        for giris in ["İşte", "Elbette", "Düzeltilmiş", "Aşağıda", "Tabii"]:
            if ceviri_polish.lstrip().startswith(giris):
                ceviri_polish = "\n".join(ceviri_polish.split("\n")[1:]).strip()
                break
        ceviri_metin = ceviri_polish
        print(f"   ✅ Editör tamamladı.")
    else:
        print("   ⚠️ Editör pası başarısız, ham çeviri kullanılıyor.")

    # ==================================================
    # KAYDET  (tr_title Pass 1'den kilitli, asla değişmedi)
    # ==================================================
    payload = {"novel_id": novel['id'], "chapter_number": chapter_num, "title": tr_title, "content": ceviri_metin}
    headers = {"Authorization": f"Bearer {token}"}
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
# 🏭 ANA DÖNGÜ
# ==========================================
if __name__ == "__main__":
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

                while True:
                    target_url = novel['source_url'].format(current_ch)
                    eng_title, eng_text = scrape_chapter(target_url, current_ch)

                    if not eng_text:
                        print(f"   ⚠️ {current_ch}. Bölüm bulunamadı veya çekilemedi, seriyi atlıyorum.")
                        break

                    status = translate_and_upload(token, novel, current_ch, eng_title, eng_text)
                    if status in ["SUCCESS", "SKIP"]:
                        current_ch += 1
                        time.sleep(5)
                    else: break

        print(f"\n💤 Bekleme modu ({BEKLEME_SURESI}sn)...")
        time.sleep(BEKLEME_SURESI)