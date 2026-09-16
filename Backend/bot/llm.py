"""DeepSeek API (OpenAI uyumlu). Roman çevirisi + manga overlay vision."""

import base64
import os
import time

import requests
from dotenv import load_dotenv

_BOT_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(_BOT_DIR, "..", "..", ".env"))
load_dotenv(os.path.join(_BOT_DIR, "..", ".env"))
load_dotenv()

DEEPSEEK_URL = os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com").rstrip("/")
# Geçerli id'ler: deepseek-flash, deepseek-v4-pro. deepseek-chat artık yok.
MODELS = [
    m.strip()
    for m in (os.getenv("DEEPSEEK_MODEL") or "deepseek-flash,deepseek-v4-pro").split(",")
    if m.strip()
]
DEFAULT_MAX_TOKENS = int(os.getenv("DEEPSEEK_MAX_TOKENS") or "32768")

_keys = [
    k for k in (
        os.getenv("DEEPSEEK_API_KEY"),
        os.getenv("DEEPSEEK_API_KEY_2"),
        os.getenv("DEEPSEEK_API_KEY_3"),
        os.getenv("DEEPSEEK_API_KEY_4"),
    ) if k
]
_key_index = 0
_model_index = 0
_dead = set()


def has_keys():
    return bool(_keys)


def keys():
    return list(_keys)


def active_key_hint():
    if not _keys:
        return "yok"
    return _keys[_key_index][:5]


def _rotate():
    global _key_index
    if not _keys:
        return
    _key_index = (_key_index + 1) % len(_keys)
    print(f"🔄 DeepSeek key rotasyonu: Key #{_key_index + 1} aktif")


def rotate_key():
    _rotate()


class _RateLimit(Exception):
    pass


class _AuthFail(Exception):
    pass


def _extract_text(data):
    choices = data.get("choices") or []
    if not choices:
        return ""
    msg = choices[0].get("message") or {}
    content = msg.get("content")
    text = ""
    if isinstance(content, str):
        text = content.strip()
    elif isinstance(content, list):
        parts = []
        for block in content:
            if isinstance(block, dict) and block.get("type") in ("text", "output_text"):
                parts.append(block.get("text") or "")
            elif isinstance(block, str):
                parts.append(block)
        text = "".join(parts).strip()
    elif content:
        text = str(content).strip()
    if text:
        return text
    reasoning = msg.get("reasoning_content")
    if isinstance(reasoning, str):
        return reasoning.strip()
    return ""


def _model_missing(err):
    low = err.lower()
    if "404" in err or "not found" in low:
        return True
    return "model" in low and any(
        tok in low for tok in ("does not exist", "unknown", "invalid", "not supported")
    )


def _post(payload, key):
    resp = requests.post(
        f"{DEEPSEEK_URL}/chat/completions",
        headers={
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
        },
        json=payload,
        timeout=180,
    )
    body = ""
    try:
        data = resp.json()
        body = str(data)[:300]
    except Exception:
        data = {}
        body = (resp.text or "")[:300]
    if resp.status_code == 429:
        raise _RateLimit(body)
    if resp.status_code in (401, 403):
        raise _AuthFail(body)
    if resp.status_code >= 400:
        err = data.get("error") if isinstance(data, dict) else None
        msg = err.get("message") if isinstance(err, dict) else body
        raise RuntimeError(f"HTTP {resp.status_code}: {msg}")
    text = _extract_text(data)
    if not text:
        raise RuntimeError("DeepSeek boş yanıt döndü")
    return text


def _complete(messages, label="", json_mode=False, max_tokens=None):
    global _model_index
    if not _keys:
        print("❌ DEEPSEEK_API_KEY yok. .env dosyasına ekle (repo'ya yazma).")
        return None
    payload_base = {
        "messages": messages,
        "stream": False,
        "thinking": {"type": "disabled"},
        "max_tokens": int(max_tokens or DEFAULT_MAX_TOKENS),
    }
    if json_mode:
        payload_base["response_format"] = {"type": "json_object"}
    max_cycles = 3
    for cycle in range(max_cycles):
        for _ in range(len(_keys)):
            if _key_index in _dead:
                if len(_dead) >= len(_keys):
                    print("❌ Tüm DeepSeek key'leri geçersiz.")
                    return None
                _rotate()
                continue
            model = MODELS[min(_model_index, len(MODELS) - 1)]
            payload = dict(payload_base)
            payload["model"] = model
            try:
                return _post(payload, _keys[_key_index])
            except _RateLimit:
                print(f"⚠️ Rate limit ({label}) — Key #{_key_index + 1}, sonrakine geçiliyor...")
                _rotate()
            except _AuthFail:
                print(f"💀 Key #{_key_index + 1} geçersiz (401/403). Atlanacak.")
                _dead.add(_key_index)
                _rotate()
            except Exception as e:
                err = str(e)
                low = err.lower()
                if "thinking" in low or "unknown" in low:
                    payload.pop("thinking", None)
                    try:
                        return _post(payload, _keys[_key_index])
                    except Exception as e2:
                        err = str(e2)
                        low = err.lower()
                if json_mode and (
                    "response_format" in low or "json_object" in low or "json" in low
                ):
                    payload.pop("response_format", None)
                    try:
                        return _post(payload, _keys[_key_index])
                    except Exception as e3:
                        err = str(e3)
                        low = err.lower()
                if _model_missing(err):
                    if _model_index + 1 < len(MODELS):
                        _model_index += 1
                        print(f"🔁 Model '{model}' yok → '{MODELS[_model_index]}'")
                        continue
                if "503" in err or "500" in err or "timeout" in low:
                    print(f"⚠️ Geçici DeepSeek hatası ({label}). 20sn bekleniyor...")
                    time.sleep(20)
                    _rotate()
                    continue
                print(f"   ❌ DeepSeek ({label}): {err[:220]}")
                return None
        if len(_dead) >= len(_keys):
            print("❌ Tüm DeepSeek key'leri geçersiz.")
            return None
        print(f"⏳ DeepSeek key'leri doldu. 65sn ({cycle + 1}/{max_cycles})")
        time.sleep(65)
    print("❌ DeepSeek denemeleri bitti.")
    return None


def call_text(prompt_text, label="", system=None, max_tokens=None):
    messages = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt_text})
    return _complete(messages, label=label, max_tokens=max_tokens)


def call_vision(image_bytes, prompt_text, mime="image/jpeg", label="overlay"):
    b64 = base64.b64encode(image_bytes).decode("ascii")
    data_url = f"data:{mime};base64,{b64}"
    messages = [
        {
            "role": "user",
            "content": [
                {"type": "text", "text": prompt_text},
                {
                    "type": "image_url",
                    "image_url": {"url": data_url, "detail": "original"},
                },
            ],
        }
    ]
    return _complete(messages, label=label, json_mode=True)
