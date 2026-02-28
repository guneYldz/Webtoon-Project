"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        username: "",
        password: "",
    });
    const [error, setError] = useState("");

    // RATE LIMITING: 5 deneme, 30 saniye kilitleme
    const [attempts, setAttempts] = useState(0);
    const [locked, setLocked] = useState(false);
    const [lockTime, setLockTime] = useState(0);

    const API = process.env.NEXT_PUBLIC_API_URL || "https://kaosmanga.net/api";

    // Sayfa yüklendiğinde kilit durumunu kontrol et
    useEffect(() => {
        const storedAttempts = parseInt(localStorage.getItem("login_attempts") || "0");
        const storedLockTime = parseInt(localStorage.getItem("lock_time") || "0");

        if (storedLockTime > Date.now()) {
            setLocked(true);
            setLockTime(storedLockTime);
        } else {
            setAttempts(storedAttempts);
            localStorage.removeItem("lock_time");
        }
    }, []);

    // Geri sayım için interval
    useEffect(() => {
        if (locked && lockTime > Date.now()) {
            const interval = setInterval(() => {
                const remaining = lockTime - Date.now();
                if (remaining <= 0) {
                    setLocked(false);
                    setAttempts(0);
                    localStorage.removeItem("login_attempts");
                    localStorage.removeItem("lock_time");
                    setError("");
                }
            }, 1000);
            return () => clearInterval(interval);
        }
    }, [locked, lockTime]);

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Kilitli mi kontrol et
        if (locked) {
            const remaining = Math.ceil((lockTime - Date.now()) / 1000);
            setError(`⏳ Çok fazla hatalı deneme yaptın! ${remaining} saniye sonra tekrar dene.`);
            return;
        }

        setLoading(true);
        setError("");

        try {
            const form = new URLSearchParams();
            form.append("username", formData.username);
            form.append("password", formData.password);

            const res = await fetch(`${API}/auth/giris-yap`, {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: form,
            });

            const data = await res.json();

            if (!res.ok) {
                // BAŞARISIZ GİRİŞ - Deneme sayısını artır
                const newAttempts = attempts + 1;
                setAttempts(newAttempts);
                localStorage.setItem("login_attempts", newAttempts.toString());

                if (newAttempts >= 5) {
                    // 5 DENEME AŞILDI - 30 SANİYE KİLİTLE
                    const lockUntil = Date.now() + 30000;
                    setLocked(true);
                    setLockTime(lockUntil);
                    localStorage.setItem("lock_time", lockUntil.toString());
                    setError("🚫 5 hatalı deneme! 30 saniye beklemelisin.");
                } else {
                    setError(`❌ ${data.detail || "Giriş başarısız"} (${5 - newAttempts} deneme hakkın kaldı)`);
                }
                setLoading(false);
                return;
            }

            // ADMIN ROLÜ KONTROLÜ
            if (data.role !== "admin") {
                const newAttempts = attempts + 1;
                setAttempts(newAttempts);
                localStorage.setItem("login_attempts", newAttempts.toString());

                if (newAttempts >= 5) {
                    const lockUntil = Date.now() + 30000;
                    setLocked(true);
                    setLockTime(lockUntil);
                    localStorage.setItem("lock_time", lockUntil.toString());
                    setError("🚫 5 hatalı deneme! 30 saniye beklemelisin.");
                } else {
                    setError(`⛔ Bu panel sadece ADMIN kullanıcılar içindir! (${5 - newAttempts} deneme hakkın kaldı)`);
                }
                setLoading(false);
                return;
            }

            // BAŞARILI GİRİŞ - Tüm denemeleri sıfırla
            localStorage.removeItem("login_attempts");
            localStorage.removeItem("lock_time");

            // Token'ı kaydet (Tarayıcı kapanınca silinecek - SessionStorage)
            sessionStorage.setItem("admin_token", data.access_token);
            sessionStorage.setItem("access_token", data.access_token);
            sessionStorage.setItem("token", data.access_token);

            sessionStorage.setItem("admin_user", data.username);
            sessionStorage.setItem("admin_role", data.role);

            // Admin paneline yönlendir
            router.push("/admin");
        } catch (err) {
            setError(err.message);
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center px-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
                {/* Logo ve Başlık */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full mb-4">
                        <span className="text-3xl">🔐</span>
                    </div>
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">Admin Panel</h1>
                    <p className="text-gray-500">Sadece admin kullanıcılar girebilir</p>
                </div>

                {/* Hata Mesajı */}
                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
                        {error}
                    </div>
                )}

                {/* Kilit Uyarısı */}
                {locked && (
                    <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded-lg mb-4">
                        ⏳ Hesap kilitli! {Math.ceil((lockTime - Date.now()) / 1000)} saniye bekle.
                    </div>
                )}

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Kullanıcı Adı veya Email
                        </label>
                        <input
                            type="text"
                            required
                            disabled={locked}
                            value={formData.username}
                            onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
                            placeholder="admin"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Şifre
                        </label>
                        <input
                            type="password"
                            required
                            disabled={locked}
                            value={formData.password}
                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
                            placeholder="••••••••"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading || locked}
                        className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? "Giriş yapılıyor..." : locked ? "Kilitli" : "Giriş Yap"}
                    </button>
                </form>

                {/* Footer */}
                <div className="mt-6 text-center">
                    <a href="/" className="text-sm text-gray-500 hover:text-gray-700">
                        ← Ana Sayfaya Dön
                    </a>
                </div>

                {/* Deneme Sayısı Göstergesi */}
                {!locked && attempts > 0 && (
                    <div className="mt-4 text-center text-sm text-gray-500">
                        {attempts}/5 deneme yapıldı
                    </div>
                )}
            </div>
        </div>
    );
}
