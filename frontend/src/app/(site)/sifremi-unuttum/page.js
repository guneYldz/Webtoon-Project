"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  KeyRound,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowLeft,
  CheckCircle2,
  ShieldCheck,
  RotateCcw,
} from "lucide-react";
import { apiFetch } from "@/lib/apiClient";
import { Button } from "@/components/ui";

const RESEND_COOLDOWN_SECONDS = 60;

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => (prev > 1 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const sendResetCode = async (targetEmail, isResend = false) => {
    const cleanEmail = targetEmail.trim();
    if (!cleanEmail) return false;

    if (isResend) setResending(true);
    else setLoading(true);

    try {
      const res = await apiFetch("/auth/sifremi-unuttum", {
        method: "POST",
        json: { email: cleanEmail },
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        toast.success(
          data.message ||
            "6 haneli doğrulama kodu e-posta adresinize gönderildi."
        );
        setStep(2);
        setCooldown(RESEND_COOLDOWN_SECONDS);
        return true;
      } else {
        toast.error(data.detail || "Sıfırlama kodu gönderilemedi.");
        return false;
      }
    } catch (error) {
      console.error(error);
      toast.error("İşlem sırasında bir hata oluştu.");
      return false;
    } finally {
      if (isResend) setResending(false);
      else setLoading(false);
    }
  };

  const handleRequestCode = async (e) => {
    e.preventDefault();
    await sendResetCode(email, false);
  };

  const handleResendCode = async () => {
    if (cooldown > 0 || resending) return;
    await sendResetCode(email, true);
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    const cleanCode = code.replace(/\D/g, "").slice(0, 6);
    if (cleanCode.length !== 6) {
      toast.error("Lütfen 6 haneli doğrulama kodunu eksiksiz girin.");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("Yeni şifreniz en az 6 karakter olmalıdır.");
      return;
    }

    setLoading(true);
    try {
      const res = await apiFetch("/auth/sifre-yenile", {
        method: "POST",
        json: {
          email: email.trim(),
          code: cleanCode,
          new_password: newPassword,
        },
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        toast.success(
          data.message ||
            "Şifreniz başarıyla yenilendi! Yeni şifrenizle giriş yapabilirsiniz."
        );
        router.push("/login");
      } else {
        toast.error(
          data.detail || "Doğrulama kodu geçersiz veya süresi dolmuş."
        );
      }
    } catch (error) {
      console.error(error);
      toast.error("Şifre sıfırlanamadı.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-5rem)] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-surface/95 p-8 sm:p-10 rounded-3xl border border-subtle shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-brand to-transparent opacity-80" />

        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand/15 border border-brand/30 text-brand">
          <KeyRound className="h-6 w-6" />
        </div>

        <h1 className="text-2xl font-black text-ink-primary text-center mb-1.5 tracking-tight">
          Şifremi Unuttum
        </h1>
        <p className="text-ink-secondary text-center text-sm mb-8">
          {step === 1
            ? "Kayıtlı e-posta adresini girerek 6 haneli şifre sıfırlama kodu talep et."
            : `${email} adresine gönderilen 6 haneli kodu ve yeni şifreni gir.`}
        </p>

        {step === 1 ? (
          <form onSubmit={handleRequestCode} className="space-y-4">
            <div>
              <label className="block text-xs text-ink-secondary font-bold uppercase tracking-wider mb-1.5 ml-1">
                E-posta Adresin
              </label>
              <div className="relative">
                <Mail className="h-4 w-4 text-ink-muted absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full py-3 pl-10 pr-4 bg-canvas rounded-xl border border-subtle text-sm text-ink-primary focus:border-brand focus:ring-2 focus:ring-brand/30 outline-none placeholder:text-ink-muted"
                  placeholder="ornek@email.com"
                />
              </div>
            </div>
            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={loading}
              className="w-full font-bold"
            >
              <span>
                {loading ? "Gönderiliyor..." : "Doğrulama Kodu Gönder"}
              </span>
            </Button>
          </form>
        ) : (
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1.5 ml-1">
                <label className="block text-xs text-ink-secondary font-bold uppercase tracking-wider">
                  6 Haneli Doğrulama Kodu
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setStep(1);
                    setCode("");
                  }}
                  className="text-xs font-semibold text-brand hover:text-purple-300 transition-colors"
                >
                  E-postayı Değiştir
                </button>
              </div>
              <div className="relative">
                <ShieldCheck className="h-4 w-4 text-ink-muted absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  required
                  value={code}
                  onChange={(e) =>
                    setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  className="w-full py-3 pl-10 pr-4 bg-canvas rounded-xl border border-subtle text-center font-mono text-lg font-bold tracking-[0.35em] text-ink-primary focus:border-brand focus:ring-2 focus:ring-brand/30 outline-none placeholder:text-ink-muted placeholder:tracking-normal placeholder:font-sans placeholder:text-sm placeholder:font-normal"
                  placeholder="000000"
                  autoComplete="one-time-code"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-ink-secondary font-bold uppercase tracking-wider mb-1.5 ml-1">
                Yeni Şifre
              </label>
              <div className="relative">
                <Lock className="h-4 w-4 text-ink-muted absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={6}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full py-3 pl-10 pr-10 bg-canvas rounded-xl border border-subtle text-sm text-ink-primary focus:border-brand focus:ring-2 focus:ring-brand/30 outline-none placeholder:text-ink-muted"
                  placeholder="En az 6 karakter"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink-primary transition-colors"
                  aria-label="Şifreyi göster/gizle"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={loading}
              className="w-full font-bold"
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>{loading ? "Sıfırlanıyor..." : "Şifreyi Yenile"}</span>
            </Button>

            <div className="pt-1 text-center">
              <button
                type="button"
                onClick={handleResendCode}
                disabled={cooldown > 0 || resending}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-secondary hover:text-brand disabled:opacity-50 disabled:pointer-events-none transition-colors"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>
                  {cooldown > 0
                    ? `Kodu Tekrar Gönder (${cooldown} sn)`
                    : resending
                    ? "Kod Gönderiliyor..."
                    : "Kodu Tekrar Gönder"}
                </span>
              </button>
            </div>
          </form>
        )}

        <div className="mt-6 pt-5 border-t border-subtle text-center">
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 text-ink-secondary text-sm hover:text-ink-primary transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Giriş Ekranına Dön</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
