"""
Kaos Manga - E-posta Gönderim Servisi (Email Service)
Resend HTTP API ve SMTP (STARTTLS / SSL) destekli hibrit gönderim modülü.
Standart kütüphane (stdlib) kullanır; harici pip bağımlılığı gerektirmez.
"""

import json
import logging
import os
import smtplib
import ssl
import urllib.error
import urllib.request
from email.header import Header
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Optional

logger = logging.getLogger("kaos.mailer")


def _build_reset_password_html(code: str, username: str = "") -> str:
    """Modern, karanlık tema uyumlu HTML e-posta şablonu."""
    greeting = f"Merhaba <strong>{username}</strong>," if username else "Merhaba,"
    return f"""<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Kaos Manga - Şifre Sıfırlama Kodu</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0c0a09; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f2f2f2;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #0c0a09; padding: 40px 10px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 520px; background-color: #1c1917; border: 1px solid #292524; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
          <!-- Başlık / Banner -->
          <tr>
            <td style="padding: 32px 32px 20px 32px; text-align: center; border-bottom: 1px solid #292524; background: linear-gradient(180deg, #26211e 0%, #1c1917 100%);">
              <h1 style="margin: 0; font-size: 24px; font-weight: 800; letter-spacing: 2px; color: #ef4444; text-transform: uppercase;">
                KAOS MANGA
              </h1>
              <p style="margin: 6px 0 0 0; font-size: 13px; color: #a8a29e; letter-spacing: 0.5px;">
                Şifre Sıfırlama Doğrulama Kodu
              </p>
            </td>
          </tr>

          <!-- İçerik -->
          <tr>
            <td style="padding: 32px;">
              <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.6; color: #e7e5e4;">
                {greeting}
              </p>
              <p style="margin: 0 0 24px 0; font-size: 14px; line-height: 1.6; color: #d6d3d1;">
                Kaos Manga hesabınız için bir şifre sıfırlama talebinde bulunuldu. Şifrenizi yenilemek için aşağıdaki 6 haneli doğrulama kodunu kullanın:
              </p>

              <!-- Kod Kutusu -->
              <div style="background-color: #0c0a09; border: 1px solid #ef4444; border-radius: 8px; padding: 18px; text-align: center; margin: 24px 0;">
                <span style="font-family: 'Courier New', Courier, monospace; font-size: 34px; font-weight: 800; letter-spacing: 8px; color: #f87171; display: inline-block; padding-left: 8px;">
                  {code}
                </span>
              </div>

              <!-- Süre Bilgisi -->
              <p style="margin: 0 0 24px 0; font-size: 13px; text-align: center; color: #fbbf24;">
                ⏰ Bu kod <strong>15 dakika</strong> boyunca geçerlidir.
              </p>

              <hr style="border: none; border-top: 1px solid #292524; margin: 24px 0;">

              <!-- Güvenlik Uyarısı -->
              <p style="margin: 0; font-size: 12px; line-height: 1.6; color: #78716c;">
                🛡️ <strong>Güvenlik Uyarısı:</strong> Bu isteği siz yapmadıysanız lütfen bu e-postayı görmezden gelin. Mevcut şifreniz değiştirilmemiştir ve hesabınız güvendedir.
              </p>
            </td>
          </tr>

          <!-- Alt Bilgi / Footer -->
          <tr>
            <td style="padding: 20px 32px; background-color: #141210; border-top: 1px solid #292524; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #78716c;">
                © Kaos Manga • Otomatik bilgilendirme mesajıdır.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""


def _build_reset_password_text(code: str, username: str = "") -> str:
    """Düz metin (plain text) e-posta alternatifi."""
    greeting = f"Merhaba {username}," if username else "Merhaba,"
    return f"""{greeting}

Kaos Manga hesabınız için şifre sıfırlama talebinde bulundunuz.
Şifrenizi yenilemek için kullanabileceğiniz 6 haneli doğrulama kodunuz:

    {code}

Bu kod 15 dakika boyunca geçerlidir.

Bu isteği siz yapmadıysanız lütfen bu e-postayı görmezden gelin. Hesabınız güvendedir.

Kaos Manga Ekibi
https://kaosmanga.net
"""


def _send_via_resend(
    api_key: str,
    from_email: str,
    to_email: str,
    subject: str,
    html_content: str,
    text_content: str,
) -> bool:
    """Resend REST API üzerinden e-posta gönderir."""
    endpoint = "https://api.resend.com/emails"
    payload = {
        "from": from_email,
        "to": [to_email],
        "subject": subject,
        "html": html_content,
        "text": text_content,
    }
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        endpoint,
        data=data,
        headers={
            "Authorization": f"Bearer {api_key.strip()}",
            "Content-Type": "application/json",
            "User-Agent": "KaosManga-Mailer/1.0",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=12) as response:
            status_code = response.getcode()
            if 200 <= status_code < 300:
                logger.info(f"Email sent via Resend API to {to_email} (status: {status_code})")
                return True
            logger.error(f"Resend API returned non-2xx status: {status_code}")
            return False
    except urllib.error.HTTPError as e:
        error_body = ""
        try:
            error_body = e.read().decode("utf-8", errors="ignore")
        except Exception:
            pass
        logger.error(f"Resend API HTTPError ({e.code}): {error_body or e.reason}")
        return False
    except Exception as e:
        logger.error(f"Resend API connection error: {e}")
        return False


def _send_via_smtp(
    host: str,
    port: int,
    user: str,
    password: str,
    use_ssl: bool,
    from_email: str,
    to_email: str,
    subject: str,
    html_content: str,
    text_content: str,
) -> bool:
    """SMTP (STARTTLS / SSL) üzerinden e-posta gönderir."""
    msg = MIMEMultipart("alternative")
    msg["Subject"] = Header(subject, "utf-8").encode()
    msg["From"] = from_email
    msg["To"] = to_email

    msg.attach(MIMEText(text_content, "plain", "utf-8"))
    msg.attach(MIMEText(html_content, "html", "utf-8"))

    try:
        if use_ssl or port == 465:
            context = ssl.create_default_context()
            with smtplib.SMTP_SSL(host, port, context=context, timeout=12) as server:
                if user and password:
                    server.login(user, password)
                server.sendmail(from_email, [to_email], msg.as_string())
        else:
            with smtplib.SMTP(host, port, timeout=12) as server:
                server.ehlo()
                context = ssl.create_default_context()
                server.starttls(context=context)
                server.ehlo()
                if user and password:
                    server.login(user, password)
                server.sendmail(from_email, [to_email], msg.as_string())

        logger.info(f"Email sent via SMTP ({host}:{port}) to {to_email}")
        return True
    except Exception as e:
        logger.error(f"SMTP delivery failed to {to_email} via {host}:{port}: {e}")
        return False


def send_password_reset_email(to_email: str, code: str, username: str = "") -> bool:
    """
    Kullanıcıya 6 haneli şifre sıfırlama doğrulama kodunu e-posta ile iletir.
    
    Öncelik Sırası:
      1) RESEND_API_KEY tanımlıysa Resend HTTP API kullanılır.
      2) SMTP_HOST tanımlıysa SMTP (STARTTLS / SSL) kullanılır.
      3) Hiçbiri yapılandırılmamışsa uyarı günlüğe kaydedilir ve False döner
         (MAIL_DEBUG_LOG=true ise geliştirme amaçlı kod konsola yazılır).
    """
    subject = "Kaos Manga - Şifre Sıfırlama Kodu"
    html_content = _build_reset_password_html(code=code, username=username)
    text_content = _build_reset_password_text(code=code, username=username)

    # Gönderen adres (Varsayılan: Kaos Manga <noreply@kaosmanga.net>)
    mail_from = os.getenv("MAIL_FROM", "").strip() or "Kaos Manga <noreply@kaosmanga.net>"

    # 1. Resend HTTP API Taşıyıcısı
    resend_key = os.getenv("RESEND_API_KEY", "").strip()
    if resend_key:
        success = _send_via_resend(
            api_key=resend_key,
            from_email=mail_from,
            to_email=to_email,
            subject=subject,
            html_content=html_content,
            text_content=text_content,
        )
        if success:
            return True
        logger.warning("Resend attempt failed, checking SMTP fallback...")

    # 2. SMTP Taşıyıcısı
    smtp_host = os.getenv("SMTP_HOST", "").strip()
    if smtp_host:
        port_raw = os.getenv("SMTP_PORT", "").strip()
        port = int(port_raw) if port_raw.isdigit() else 587
        smtp_user = os.getenv("SMTP_USER", "").strip()
        smtp_pass = os.getenv("SMTP_PASS", "").strip()
        use_ssl = os.getenv("SMTP_USE_SSL", "").strip().lower() in ("true", "1", "yes")

        return _send_via_smtp(
            host=smtp_host,
            port=port,
            user=smtp_user,
            password=smtp_pass,
            use_ssl=use_ssl,
            from_email=mail_from,
            to_email=to_email,
            subject=subject,
            html_content=html_content,
            text_content=text_content,
        )

    # 3. Her iki servis de yapılandırılmamış
    logger.warning(
        "Email service not configured. Set RESEND_API_KEY or SMTP_HOST to enable email delivery."
    )
    if os.getenv("MAIL_DEBUG_LOG", "").strip().lower() in ("true", "1", "yes"):
        logger.info(f"[MAIL_DEBUG_LOG] Password reset code for '{to_email}': {code}")

    return False
