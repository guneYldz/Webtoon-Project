"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import api from "../../api"; // 1. Az önce oluşturduğumuz api dosyasını çağırdık

export default function RegisterPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
  });
  
  // Hata mesajını ekranda göstermek için yeni bir state
  const [error, setError] = useState(null);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null); // Her denemede önceki hatayı temizle

    try {
      // 2. BACKEND'E İSTEK GÖNDERME ANI 🚀
      // Python'daki "/auth/kayit-ol" adresine verileri gönderiyoruz.
      // Not: FastAPI parametreleri query olarak bekliyorsa params, body olarak bekliyorsa direkt obje gönderilir.
      // Senin backend yapına göre query parametresi olarak gönderiyoruz:
      
      const response = await api.post(`/auth/kayit-ol`, null, {
        params: {
          kullanici_adi: formData.username,
          eposta: formData.email,
          sifre: formData.password
        }
      });

      console.log("Başarılı:", response.data);
      alert("Kayıt Başarılı! Giriş sayfasına yönlendiriliyorsunuz...");
      
      // 3. Başarılıysa Giriş Sayfasına Işınla
      router.push("/login");

    } catch (err) {
      console.error("Kayıt Hatası:", err);
      // Backend'den gelen hata mesajını yakala (Varsa)
      const mesaj = err.response?.data?.detail || "Kayıt olurken bir hata oluştu!";
      setError(mesaj);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100">
      <div className="w-full max-w-md bg-white p-8 rounded-lg shadow-lg">
        
        <h2 className="text-2xl font-bold text-center text-gray-800 mb-6">
          Aramıza Katıl! 🚀
        </h2>

        {/* Hata Mesajı Kutusu (Varsa görünür) */}
        {error && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 rounded text-sm text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          
          <div>
            <label className="block text-gray-700 text-sm font-bold mb-2">
              Kullanıcı Adı
            </label>
            <input
              type="text"
              name="username"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:border-blue-500"
              onChange={handleChange}
              required
            />
          </div>

          <div>
            <label className="block text-gray-700 text-sm font-bold mb-2">
              E-posta Adresi
            </label>
            <input
              type="email"
              name="email"
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
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:border-blue-500"
              onChange={handleChange}
              required
            />
          </div>

          <button
            type="submit"
            className="w-full bg-green-600 text-white font-bold py-2 px-4 rounded hover:bg-green-700 transition duration-200"
          >
            Kayıt Ol
          </button>
        
        </form>

        <p className="mt-4 text-center text-gray-600 text-sm">
          Zaten hesabın var mı?{" "}
          <Link href="/login" className="text-blue-500 hover:underline">
            Giriş Yap
          </Link>
        </p>

      </div>
    </div>
  );
}