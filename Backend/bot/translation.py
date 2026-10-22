"""
translation.py — DeepSeek API Çeviri Modülü (Manga/Webtoon)
=============================================================
İngilizce manga balon metinlerini Türkçe sokak ağzına çevirir.
Birincil: DeepSeek API
Yedek:    OpenRouter üzerinden Qwen2.5-72B

.env gereksinimleri:
  DEEPSEEK_API_KEY=sk-...
  OPENROUTER_API_KEY=sk-or-...  (opsiyonel — yedek için)
"""

import os
import re
import time
import logging

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.dirname(CURRENT_DIR)
REPO_ROOT   = os.path.dirname(BACKEND_DIR)

from dotenv import load_dotenv
load_dotenv(os.path.join(REPO_ROOT,   ".env"))
load_dotenv(os.path.join(BACKEND_DIR, ".env"))

logger = logging.getLogger(__name__)

# ──────────────────────────────────────────────────────────────
# Yapılandırma
# ──────────────────────────────────────────────────────────────
DEEPSEEK_API_KEY   = os.getenv("DEEPSEEK_API_KEY", "")
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")

DEEPSEEK_BASE_URL   = "https://api.deepseek.com"
OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"

DEEPSEEK_MODEL   = "deepseek-chat"
OPENROUTER_MODEL = "qwen/qwen-2.5-72b-instruct"

MAX_RETRIES = 3
RETRY_DELAY = 2.0   # saniye
BATCH_SIZE  = 15    # tek API çağrısında max metin sayısı

# ──────────────────────────────────────────────────────────────
# Sistem Prompt — Manga Çeviri Talimatı
# ──────────────────────────────────────────────────────────────
SYSTEM_PROMPT = """Sen profesyonel bir manga ve webtoon çevirmen botusun. Görevin:

1. İngilizce manga/webtoon balon metinlerini Türkçe'ye çevirmek
2. Karakterlerin tonunu ve kişiliğini korumak:
   - Kaba/sert karakterler → argo ve kaba dil kullan
   - Nazik karakterler → kibar ve samimi ton
   - Komik anlar → Türkçe slengle uygun espri korunsun
3. OCR hatalarını düzelt (O→0, l→1, rn→m gibi)
4. Mümkün olduğunca KISA ve ÖZ tut — balon boyutu sınırlı
5. Türkçe webtoon okuyucusuna hitap eden akıcı, doğal dil kullan
6. Ses efektleri (SFX) varsa Türkçe karşılığı kullan (BANG→PANG, POW→PAT)
7. Asla açıklama ekleme, sadece çeviriyi yaz

ÇIKTI FORMATI: Her satıra tam olarak bir çeviri yaz. Sıra numarası EKLEME.
Gelen sırayla aynı sayıda satır döndür."""


# ──────────────────────────────────────────────────────────────
# Dahili: OpenAI uyumlu istemci oluştur
# ──────────────────────────────────────────────────────────────
def _make_client(use_openrouter: bool = False):
    try:
        from openai import OpenAI
    except ImportError:
        raise ImportError("'openai' kütüphanesi yüklü değil. `pip install openai` çalıştır.")

    if use_openrouter:
        if not OPENROUTER_API_KEY:
            raise ValueError("OPENROUTER_API_KEY .env'de bulunamadı!")
        return OpenAI(api_key=OPENROUTER_API_KEY, base_url=OPENROUTER_BASE_URL)
    else:
        if not DEEPSEEK_API_KEY:
            raise ValueError("DEEPSEEK_API_KEY .env'de bulunamadı!")
        return OpenAI(api_key=DEEPSEEK_API_KEY, base_url=DEEPSEEK_BASE_URL)


# ──────────────────────────────────────────────────────────────
# Dahili: Tek API çağrısı (batch)
# ──────────────────────────────────────────────────────────────
def _call_api(texts: list[str], use_openrouter: bool = False) -> list[str]:
    model    = OPENROUTER_MODEL if use_openrouter else DEEPSEEK_MODEL
    provider = "OpenRouter/Qwen" if use_openrouter else "DeepSeek"

    numbered = "\n".join(f"{i+1}. {t}" for i, t in enumerate(texts))
    user_msg = (
        f"Aşağıdaki {len(texts)} manga metnini Türkçe'ye çevir. "
        f"Her satıra tam olarak bir çeviri yaz, numara EKLEME:\n\n{numbered}"
    )

    client = _make_client(use_openrouter)
    resp   = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user",   "content": user_msg},
        ],
        temperature=0.3,
        max_tokens=2048,
    )

    raw   = resp.choices[0].message.content.strip()
    lines = [re.sub(r"^\d+[\.\)]\s*", "", l).strip()
             for l in raw.splitlines() if l.strip()]

    # Sayı uyuşmazlığı — eksikleri orijinalle doldur
    if len(lines) != len(texts):
        logger.warning(f"[{provider}] Beklenen {len(texts)}, dönen {len(lines)}")
        while len(lines) < len(texts):
            lines.append(texts[len(lines)])

    return lines[:len(texts)]


# ──────────────────────────────────────────────────────────────
# Ana Fonksiyon: Metinleri Türkçe'ye çevir
# ──────────────────────────────────────────────────────────────
def translate_texts(texts: list[str]) -> list[str]:
    """
    Bir listedeki İngilizce metinleri Türkçe'ye çevir.
    Önce DeepSeek, başarısız olursa OpenRouter/Qwen fallback.

    Args:
        texts: ["Hello", "BOOM!", ...]
    Returns:
        ["Merhaba", "PANG!", ...]  — aynı uzunlukta liste
    """
    if not texts:
        return []

    def _worth_translating(t: str) -> bool:
        return len(re.sub(r"[^a-zA-Z]", "", t)) >= 2

    to_translate_idx  = [i for i, t in enumerate(texts) if _worth_translating(t)]
    to_translate_txts = [texts[i] for i in to_translate_idx]

    if not to_translate_txts:
        return list(texts)

    results_map: dict[int, str] = {}

    for batch_start in range(0, len(to_translate_txts), BATCH_SIZE):
        batch   = to_translate_txts[batch_start : batch_start + BATCH_SIZE]
        indices = to_translate_idx [batch_start : batch_start + BATCH_SIZE]
        translated = None

        # --- DeepSeek ---
        if DEEPSEEK_API_KEY:
            for attempt in range(MAX_RETRIES):
                try:
                    print(f"    🌐 DeepSeek ({len(batch)} metin, deneme {attempt+1})...")
                    translated = _call_api(batch, use_openrouter=False)
                    print(f"    ✅ DeepSeek çeviri tamam.")
                    break
                except Exception as e:
                    logger.warning(f"DeepSeek hata (deneme {attempt+1}): {e}")
                    if attempt < MAX_RETRIES - 1:
                        time.sleep(RETRY_DELAY * (attempt + 1))

        # --- OpenRouter Yedek ---
        if translated is None and OPENROUTER_API_KEY:
            for attempt in range(MAX_RETRIES):
                try:
                    print(f"    🔄 OpenRouter/Qwen yedek ({len(batch)} metin)...")
                    translated = _call_api(batch, use_openrouter=True)
                    print(f"    ✅ OpenRouter çeviri tamam.")
                    break
                except Exception as e:
                    logger.warning(f"OpenRouter hata (deneme {attempt+1}): {e}")
                    if attempt < MAX_RETRIES - 1:
                        time.sleep(RETRY_DELAY * (attempt + 1))

        # --- Son çare: orijinali koru ---
        if translated is None:
            logger.error("Tüm API'ler başarısız — orijinal metin korunuyor.")
            translated = batch

        for orig_idx, tr_text in zip(indices, translated):
            results_map[orig_idx] = tr_text

        # Rate limit için kısa bekleme
        if batch_start + BATCH_SIZE < len(to_translate_txts):
            time.sleep(0.5)

    final = list(texts)
    for i, tr in results_map.items():
        final[i] = tr
    return final


def translate_single(text: str) -> str:
    """Tek bir metni çevir — kısa kullanım için."""
    r = translate_texts([text])
    return r[0] if r else text


# ──────────────────────────────────────────────────────────────
# Test
# ──────────────────────────────────────────────────────────────
if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)

    samples = [
        "What the hell are you doing here?!",
        "I'm sorry, I didn't mean to...",
        "BOOM! That was incredible!",
        "You're the strongest warrior I've ever seen.",
        "Heh, you think that's enough to stop me?",
    ]

    print("🔤 Çevriliyor...")
    results = translate_texts(samples)
    for en, tr in zip(samples, results):
        print(f"  EN: {en}")
        print(f"  TR: {tr}")
        print()
