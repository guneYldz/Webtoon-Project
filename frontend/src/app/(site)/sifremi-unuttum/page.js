"use client";

import { useState } from "react";
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
} from "lucide-react";
import { apiFetch } from "@/lib/apiClient";
import { Button } from "@/components/ui";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleRequestCode = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await apiFetch("/auth/forgot-password", {
        method: "POST",
        json: { email },
      });

      if (res.ok) {
        toast.success(
          "Şifre sıfırlama kodu oluşturuldu. Lütfen doğrulama kodunu girin."
        );
        setStep(2);
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.detail || "Sıfırlama kodu gönderilemedi.");
      }
    } catch (error) {
      console.error(error);
      toast.error("İşlem sırasında bir hata oluştu.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await apiFetch("/auth/reset-password", {
        method: "POST",
        json: { token: code, new_password: newPassword },
      });

      if (res.ok) {
        toast.success("Şifreniz başarıyla sıfırlandı! Giriş yapabilirsiniz.");
        router.push("/login");
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.detail || "Doğrulama kodu geçersiz veya süresi dolmuş.");
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
            ? "Kayıtlı e-posta adresini girerek şifre sıfırlama kodu talep et."
            : "Gönderilen doğrulama kodunu ve yeni şifreni belirle."}
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
                {loading ? "Gönderiliyor..." : "Sıfırlama Kodu Gönder"}
              </span>
            </Button>
          </form>
        ) : (
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div>
              <label className="block text-xs text-ink-secondary font-bold uppercase tracking-wider mb-1.5 ml-1">
                Doğrulama Kodu
              </label>
              <div className="relative">
                <ShieldCheck className="h-4 w-4 text-ink-muted absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="w-full py-3 pl-10 pr-4 bg-canvas rounded-xl border border-subtle text-sm text-ink-primary focus:border-brand focus:ring-2 focus:ring-brand/30 outline-none placeholder:text-ink-muted"
                  placeholder="6 haneli doğrulama kodu"
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
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full py-3 pl-10 pr-10 bg-canvas rounded-xl border border-subtle text-sm text-ink-primary focus:border-brand focus:ring-2 focus:ring-brand/30 outline-none placeholder:text-ink-muted"
                  placeholder="••••••••"
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
              <span>{loading ? "Sıfırlanıyor..." : "Şifreyi Sıfırla"}</span>
            </Button>
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
