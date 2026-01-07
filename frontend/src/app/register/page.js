"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
  });
  
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false); // Yükleniyor durumu

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // Backend yapına göre parametreleri URL'ye ekliyoruz (Query Params)
      const url = new URL("http://127.0.0.1:8000/auth/kayit-ol");
      url.searchParams.append("kullanici_adi", formData.username);
      url.searchParams.append("eposta", formData.email);
      url.searchParams.append("sifre", formData.password);
      
      const response = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        }
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.detail || "Kayıt işlemi başarısız.");
      }

      console.log("Başarılı:", result);
      // Başarılı olursa kullanıcıyı login sayfasına yönlendir
      // İstersen burada bir "Kayıt Başarılı" modalı da gösterebilirsin ama direkt yönlendirme daha hızlıdır.
      router.push("/login");

    } catch (err) {
      console.error("Kayıt Hatası:", err);
      setError(err.message || "Kayıt olurken bir hata oluştu!");
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#121212] px-4">
      
      {/* Kart Kapsayıcısı */}
      <div className="w-full max-w-md bg-[#1e1e1e] p-8 sm:p-10 rounded-2xl shadow-2xl border border-gray-800 relative overflow-hidden">
        
        {/* Dekoratif Üst Çizgi */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-1 bg-gradient-to-r from-transparent via-purple-500 to-transparent opacity-50"></div>

        {/* BAŞLIK & LOGO */}
        <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-blue-600 to-purple-600 shadow-lg shadow-purple-900/30 mb-4">
                <span className="text-2xl font-bold text-white">W</span>
            </div>
            <h2 className="text-3xl font-bold text-white tracking-tight">Aramıza Katıl! 🚀</h2>
            <p className="text-gray-400 text-sm mt-2">Webtoon dünyasına hemen adım at.</p>
        </div>

        {/* HATA MESAJI */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-sm flex items-center gap-3 animate-pulse">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 flex-shrink-0">
                <path fillRule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003zM12 8.25a.75.75 0 01.75.75v3.75a.75.75 0 01-1.5 0V9a.75.75 0 01.75-.75zm0 8.25a.75.75 0 100-1.5.75.75 0 000 1.5z" clipRule="evenodd" />
            </svg>
            {error}
          </div>
        )}

        {/* FORM */}
        <form onSubmit={handleSubmit} className="space-y-5">
          
          {/* Kullanıcı Adı Input */}
          <div>
            <label className="block text-gray-300 text-xs font-bold uppercase tracking-wider mb-2 ml-1">Kullanıcı Adı</label>
            <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    {/* User İkonu */}
                    <svg className="h-5 w-5 text-gray-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                    </svg>
                </div>
                <input
                    type="text"
                    name="username"
                    className="w-full pl-10 pr-4 py-3 bg-[#121212] border border-gray-700 text-white rounded-lg focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition placeholder-gray-600"
                    placeholder="kullaniciadi"
                    onChange={handleChange}
                    required
                />
            </div>
          </div>

          {/* Email Input */}
          <div>
            <label className="block text-gray-300 text-xs font-bold uppercase tracking-wider mb-2 ml-1">E-posta Adresi</label>
            <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    {/* Zarf İkonu */}
                    <svg className="h-5 w-5 text-gray-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                        <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                    </svg>
                </div>
                <input
                    type="email"
                    name="email"
                    className="w-full pl-10 pr-4 py-3 bg-[#121212] border border-gray-700 text-white rounded-lg focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition placeholder-gray-600"
                    placeholder="ornek@email.com"
                    onChange={handleChange}
                    required
                />
            </div>
          </div>

          {/* Şifre Input */}
          <div>
            <label className="block text-gray-300 text-xs font-bold uppercase tracking-wider mb-2 ml-1">Şifre</label>
            <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    {/* Kilit İkonu */}
                    <svg className="h-5 w-5 text-gray-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                    </svg>
                </div>
                <input
                    type="password"
                    name="password"
                    className="w-full pl-10 pr-4 py-3 bg-[#121212] border border-gray-700 text-white rounded-lg focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition placeholder-gray-600"
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
            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-bold py-3 px-4 rounded-lg shadow-lg shadow-purple-900/20 transform hover:-translate-y-0.5 transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Kaydediliyor..." : "Kayıt Ol"}
          </button>
        
        </form>

        <div className="mt-8 pt-6 border-t border-gray-800 text-center">
            <p className="text-gray-500 text-sm">
                Zaten hesabın var mı?{" "}
                <Link href="/login" className="text-purple-400 hover:text-white font-bold transition">
                    Giriş Yap
                </Link>
            </p>
        </div>

      </div>
    </div>
  );
}