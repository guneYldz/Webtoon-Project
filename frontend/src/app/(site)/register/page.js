"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  User,
  Mail,
  Lock,
  Eye,
  EyeOff,
  UserPlus,
  AlertCircle,
} from "lucide-react";
import { apiFetch } from "@/lib/apiClient";
import GoogleSignInButton from "@/components/GoogleSignInButton";
import { Button } from "@/components/ui";

export default function RegisterPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await apiFetch("/auth/kayit-ol", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        json: {
          kullanici_adi: formData.username.trim(),
          eposta: formData.email.trim(),
          sifre: formData.password,
        },
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.detail || "Kayıt işlemi başarısız.");
      }

      toast.success("Hesabınız oluşturuldu! Şimdi giriş yapabilirsiniz.");
      router.push("/login");
    } catch (err) {
      console.error("Kayıt Hatası:", err);
      const msg = err.message || "Kayıt olurken bir hata oluştu!";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-5rem)] items-center justify-center px-4 py-12">
      <div className="w-full max-w-md bg-surface/95 p-8 sm:p-10 rounded-3xl shadow-2xl border border-subtle relative overflow-hidden">
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-brand to-transparent opacity-80" />

        <div className="text-center mb-7">
          <div className="flex justify-center mb-5">
            <div className="relative h-20 w-20 overflow-hidden rounded-full bg-black ring-2 ring-brand/45 shadow-[0_0_24px_rgba(168,85,247,0.3)]">
              <Image
                src="/logo.png"
                alt="Kaos Manga Logo"
                fill
                sizes="80px"
                className="object-cover"
              />
            </div>
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-black text-ink-primary tracking-tight">
            Aramıza Katıl
          </h1>
          <p className="text-ink-secondary text-sm mt-1.5">
            Ücretsiz hesap oluştur, favori serilerini ve okuma geçmişini takip et.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-3.5 bg-rose-500/10 border border-rose-500/25 text-rose-300 rounded-xl text-xs sm:text-sm flex items-center gap-2.5">
            <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <GoogleSignInButton
          dividerPosition="bottom"
          dividerText="veya e-posta ile kayıt ol"
        />

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-ink-secondary text-xs font-bold uppercase tracking-wider mb-1.5 ml-1">
              Kullanıcı Adı
            </label>
            <div className="relative">
              <User className="h-4 w-4 text-ink-muted absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                name="username"
                value={formData.username}
                className="w-full pl-10 pr-4 py-3 bg-canvas border border-subtle text-ink-primary text-sm rounded-xl focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/30 transition placeholder:text-ink-muted"
                placeholder="kullaniciadi"
                onChange={handleChange}
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-ink-secondary text-xs font-bold uppercase tracking-wider mb-1.5 ml-1">
              E-posta Adresi
            </label>
            <div className="relative">
              <Mail className="h-4 w-4 text-ink-muted absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="email"
                name="email"
                value={formData.email}
                className="w-full pl-10 pr-4 py-3 bg-canvas border border-subtle text-ink-primary text-sm rounded-xl focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/30 transition placeholder:text-ink-muted"
                placeholder="ornek@email.com"
                onChange={handleChange}
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-ink-secondary text-xs font-bold uppercase tracking-wider mb-1.5 ml-1">
              Şifre
            </label>
            <div className="relative">
              <Lock className="h-4 w-4 text-ink-muted absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                value={formData.password}
                className="w-full pl-10 pr-10 py-3 bg-canvas border border-subtle text-ink-primary text-sm rounded-xl focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/30 transition placeholder:text-ink-muted"
                placeholder="••••••••"
                onChange={handleChange}
                required
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

          <div className="pt-2">
            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={loading}
              className="w-full font-bold"
            >
              <UserPlus className="h-4 w-4" />
              <span>{loading ? "Kaydediliyor..." : "Kayıt Ol"}</span>
            </Button>
          </div>
        </form>

        <div className="mt-7 pt-6 border-t border-subtle text-center">
          <p className="text-ink-secondary text-sm">
            Zaten hesabın var mı?{" "}
            <Link
              href="/login"
              className="text-brand hover:text-purple-300 font-bold transition-colors"
            >
              Giriş Yap
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
