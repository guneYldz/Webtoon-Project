"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";



export default function LoginPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const dataToSend = new URLSearchParams();
    dataToSend.append('username', formData.email);
    dataToSend.append('password', formData.password);

    try {
      const response = await fetch(`${API}/auth/giris-yap`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: dataToSend,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.detail || 'Giriş başarısız!');
      }

      // ✅ BAŞARILI GİRİŞ
      console.log("Giriş Başarılı!", result);

      // 1. Bilgileri Hafızaya At
      localStorage.setItem('token', result.access_token);
      localStorage.setItem('role', result.role);
      localStorage.setItem('username', result.username);

      // 2. Navbar'a "Hey, biri giriş yaptı!" diye bağır
      window.dispatchEvent(new Event("auth-change"));

      // 3. Anasayfaya gönder
      router.push('/');

    } catch (err) {
      console.error("Giriş Hatası:", err);
      setError("Giriş yapılamadı: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#121212] px-4">
      {/* Kart Kapsayıcısı */}
      <div className="w-full max-w-md bg-[#1e1e1e] p-8 sm:p-10 rounded-2xl shadow-2xl border border-gray-800 relative overflow-hidden">

        {/* Dekoratif Işık */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-1 bg-gradient-to-r from-transparent via-blue-500 to-transparent opacity-50"></div>

        {/* LOGO & BAŞLIK */}
        <div className="text-center mb-8">
          {/* Logo */}
          <div className="flex justify-center mb-6">
            <img
              src="/logo.png"
              alt="Logo"
              width={150}
              height={150}
              className="object-contain"
            />
          </div>
          <h2 className="text-3xl font-bold text-white tracking-tight" style={{ fontFamily: 'var(--font-cinzel), serif' }}>Tekrar Hoşgeldin! 👋</h2>
          <p className="text-gray-400 text-sm mt-2">Kaos Manga dünyasına giriş yap.</p>
        </div>

        {/* HATA MESAJI */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-sm flex items-center gap-3">
            ⚠️ {error}
          </div>
        )}

        {/* FORM */}
        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Email */}
          <div>
            <label className="block text-gray-300 text-xs font-bold uppercase tracking-wider mb-2 ml-1">E-posta Adresi</label>
            <div className="relative">
              <input
                type="email"
                name="email"
                className="w-full pl-4 pr-4 py-3 bg-[#121212] border border-gray-700 text-white rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition placeholder-gray-600"
                placeholder="ornek@email.com"
                onChange={handleChange}
                required
              />
            </div>
          </div>

          {/* Şifre */}
          <div>
            <div className="flex justify-between items-center mb-2 ml-1">
              <label className="block text-gray-300 text-xs font-bold uppercase tracking-wider">Şifre</label>
              {/* 👇 BURASI GÜNCELLENDİ: Sifremi Unuttum Linki */}
              <Link href="/sifremi-unuttum" className="text-xs text-blue-400 hover:text-blue-300 transition">
                Şifremi unuttum?
              </Link>
            </div>
            <div className="relative">
              <input
                type="password"
                name="password"
                className="w-full pl-4 pr-4 py-3 bg-[#121212] border border-gray-700 text-white rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition placeholder-gray-600"
                placeholder="••••••••"
                onChange={handleChange}
                required
              />
            </div>
          </div>


          {/* Buton */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold py-3 px-4 rounded-lg shadow-lg shadow-blue-900/20 transform hover:-translate-y-0.5 transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Giriş Yapılıyor..." : "Giriş Yap"}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-gray-800 text-center">
          <p className="text-gray-500 text-sm">
            Hesabın yok mu? {' '}
            <Link href="/register" className="text-blue-400 hover:text-white font-bold transition">
              Hemen Kayıt Ol
            </Link>
          </p>
        </div>

      </div>
    </div>
  );
}