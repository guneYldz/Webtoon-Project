"use client";

import { useState } from "react";
import { useRouter } from "next/navigation"; // Yönlendirme için gerekli (Next.js 13+)
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter(); // Sayfa yönlendirme aracını çalıştır
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [error, setError] = useState(""); // Hata mesajlarını göstermek için

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(""); // Önceki hataları temizle

    // Backend "OAuth2PasswordRequestForm" kullandığı için veriyi
    // JSON değil, "application/x-www-form-urlencoded" formatında hazırlıyoruz.
    const dataToSend = new URLSearchParams();
    dataToSend.append('username', formData.email); // DİKKAT: Backend 'username' bekler, biz 'email' yolluyoruz.
    dataToSend.append('password', formData.password);

    try {
      // Backend'e istek atıyoruz
      const response = await fetch('http://127.0.0.1:8000/auth/giris-yap', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: dataToSend,
      });

      const result = await response.json();

      if (!response.ok) {
        // Eğer backend hata döndürdüyse (örn: şifre yanlış)
        throw new Error(result.detail || 'Giriş başarısız!');
      }

      // BAŞARILI OLDUYSA:
      console.log("Giriş Başarılı! Token:", result.access_token);
      
      // 1. Token'ı tarayıcı hafızasına (localStorage) kaydet
      localStorage.setItem('token', result.access_token);

      // 2. Anasayfaya yönlendir
      router.push('/');
      
    } catch (err) {
      console.error("Giriş Hatası:", err);
      setError("Giriş yapılamadı: " + err.message);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100">
      
      <div className="w-full max-w-md bg-white p-8 rounded-lg shadow-lg">
        
        <h2 className="text-2xl font-bold text-center text-gray-800 mb-6">
          Tekrar Hoşgeldin! 👋
        </h2>

        {/* Hata Mesajı Kutusu */}
        {error && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 rounded text-sm text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          
          <div>
            <label className="block text-gray-700 text-sm font-bold mb-2">
              E-posta Adresi
            </label>
            <input
              type="email"
              name="email"
              placeholder="ornek@mail.com"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:border-blue-500"
              onChange={handleChange}
              required
            />
          </div>

          <div>
            <label className="block text-gray-700 text-sm font-bold mb-2">
              Şifre
            </label>
            <input
              type="password"
              name="password"
              placeholder="******"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:border-blue-500"
              onChange={handleChange}
              required
            />
          </div>

          <button
            type="submit"
            className="w-full bg-blue-600 text-white font-bold py-2 px-4 rounded hover:bg-blue-700 transition duration-200"
          >
            Giriş Yap
          </button>
        
        </form>

        <p className="mt-4 text-center text-gray-600 text-sm">
          Hesabın yok mu?{" "}
          <Link href="/register" className="text-blue-500 hover:underline">
            Kayıt Ol
          </Link>
        </p>

      </div>
    </div>
  );
}