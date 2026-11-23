"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShieldCheck, Lock, User, Eye, EyeOff, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { apiFetch, setAdminToken } from "@/lib/apiClient";
import { Button as RawButton } from "@/components/ui";

const Button = RawButton as React.ComponentType<any>;

export default function AdminLoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({ username: "", password: "" });
  const [error, setError] = useState("");
  const [attempts, setAttempts] = useState(0);
  const [locked, setLocked] = useState(false);
  const [lockTime, setLockTime] = useState(0);

  useEffect(() => {
    const storedAttempts = parseInt(localStorage.getItem("login_attempts") || "0", 10);
    const storedLockTime = parseInt(localStorage.getItem("lock_time") || "0", 10);

    if (storedLockTime > Date.now()) {
      setLocked(true);
      setLockTime(storedLockTime);
    } else {
      setAttempts(storedAttempts);
      localStorage.removeItem("lock_time");
    }
  }, []);

  useEffect(() => {
    if (!locked || lockTime <= Date.now()) return;
    const interval = setInterval(() => {
      if (lockTime - Date.now() <= 0) {
        setLocked(false);
        setAttempts(0);
        localStorage.removeItem("login_attempts");
        localStorage.removeItem("lock_time");
        setError("");
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [locked, lockTime]);

  const registerFailedAttempt = (baseMsg: string) => {
    const next = attempts + 1;
    setAttempts(next);
    localStorage.setItem("login_attempts", String(next));

    if (next >= 5) {
      const lockUntil = Date.now() + 30000;
      setLocked(true);
      setLockTime(lockUntil);
      localStorage.setItem("lock_time", String(lockUntil));
      setError("5 hatalı deneme yapıldı. Lütfen 30 saniye bekleyin.");
    } else {
      setError(`${baseMsg} (${5 - next} deneme hakkı kaldı)`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (locked) {
      const remaining = Math.ceil((lockTime - Date.now()) / 1000);
      setError(`Çok fazla hatalı deneme! ${remaining} saniye sonra tekrar dene.`);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const form = new URLSearchParams();
      form.append("username", formData.username);
      form.append("password", formData.password);

      const res = await apiFetch("/auth/giris-yap", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: form,
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        registerFailedAttempt(data.detail || "Giriş başarısız");
        setLoading(false);
        return;
      }

      if (data.role !== "admin") {
        registerFailedAttempt("Bu panel sadece admin kullanıcılar içindir");
        setLoading(false);
        return;
      }

      localStorage.removeItem("login_attempts");
      localStorage.removeItem("lock_time");

      setAdminToken(data.access_token, {
        role: data.role,
        username: data.username,
      });

      toast.success("Admin paneline giriş yapıldı.");
      router.push("/admin");
    } catch (err: any) {
      setError(err?.message || "Sunucuyla bağlantı kurulamadı.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-surface border border-subtle rounded-2xl p-8 shadow-2xl">
        <div className="text-center mb-7">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-brand-soft border border-brand-border text-brand mb-4">
            <ShieldCheck className="h-7 w-7" aria-hidden="true" />
          </div>
          <h1 className="text-2xl font-bold text-ink-primary tracking-tight">
            Admin Girişi
          </h1>
          <p className="text-sm text-ink-secondary mt-1">
            Yönetim paneline erişmek için admin hesabıyla oturum açın.
          </p>
        </div>

        {error && (
          <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 px-4 py-3 rounded-xl text-sm mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-ink-secondary mb-1.5">
              Kullanıcı Adı veya E-posta
            </label>
            <div className="relative">
              <User className="h-4 w-4 text-ink-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                disabled={locked}
                value={formData.username}
                onChange={(e) =>
                  setFormData({ ...formData, username: e.target.value })
                }
                placeholder="admin"
                className="w-full h-11 pl-10 pr-4 rounded-xl bg-canvas border border-subtle text-sm text-ink-primary placeholder:text-ink-muted outline-none focus:border-brand/60 disabled:opacity-50"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-ink-secondary mb-1.5">
              Şifre
            </label>
            <div className="relative">
              <Lock className="h-4 w-4 text-ink-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type={showPassword ? "text" : "password"}
                required
                disabled={locked}
                value={formData.password}
                onChange={(e) =>
                  setFormData({ ...formData, password: e.target.value })
                }
                placeholder="••••••••"
                className="w-full h-11 pl-10 pr-10 rounded-xl bg-canvas border border-subtle text-sm text-ink-primary placeholder:text-ink-muted outline-none focus:border-brand/60 disabled:opacity-50"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Şifreyi gizle" : "Şifreyi göster"}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink-primary"
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
            disabled={locked}
            className="w-full mt-2"
          >
            {locked ? "Geçici Olarak Kilitli" : "Giriş Yap"}
          </Button>
        </form>

        {!locked && attempts > 0 && (
          <p className="mt-4 text-center text-xs text-ink-muted">
            {attempts}/5 hatalı deneme
          </p>
        )}

        <div className="mt-6 pt-5 border-t border-subtle text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-secondary hover:text-ink-primary transition"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Ana Sayfaya Dön
          </Link>
        </div>
      </div>
    </div>
  );
}
