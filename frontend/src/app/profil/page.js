"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function ProfilPage() {
  const [user, setUser] = useState(null); // Kullanıcı verisi
  const [loading, setLoading] = useState(true); // Yükleniyor mu?
  const router = useRouter();

  useEffect(() => {
    // 1. Token var mı diye bak
    const token = localStorage.getItem("token");

    if (!token) {
      router.push("/login"); // Token yoksa direkt Login'e at
      return;
    }

    // 2. Token varsa Backend'e sor: "Bu token kimin?"
    fetch("http://127.0.0.1:8000/auth/me", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`, // Anahtarı (Token) gösteriyoruz
      },
    })
      .then((res) => {
        if (!res.ok) {
           throw new Error("Oturum geçersiz");
        }
        return res.json();
      })
      .then((data) => {
        setUser(data); // Gelen veriyi kaydet
        setLoading(false); // Yüklemeyi bitir
      })
      .catch(() => {
        // Token bozuksa veya süre dolmuşsa çıkış yap
        localStorage.removeItem("token");
        router.push("/login");
      });
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-xl font-semibold text-blue-600 animate-pulse">
          Yükleniyor...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-3xl mx-auto bg-white rounded-xl shadow-lg overflow-hidden">
        
        {/* Üst Başlık Kısmı */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-400 p-6 text-white flex items-center gap-4">
          <div className="w-20 h-20 bg-white text-blue-600 rounded-full flex items-center justify-center text-4xl font-bold border-4 border-blue-200">
            {user.username.charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="text-3xl font-bold">{user.username}</h1>
            <p className="opacity-90">{user.email}</p>
          </div>
        </div>

        {/* Detaylar Kısmı */}
        <div className="p-8">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Hesap Bilgileri</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
              <span className="block text-sm text-gray-500 mb-1">Kullanıcı Rolü</span>
              <span className="text-lg font-medium text-gray-800 capitalize bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm">
                {user.role}
              </span>
            </div>

            <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
              <span className="block text-sm text-gray-500 mb-1">Kullanıcı ID</span>
              <span className="text-lg font-medium text-gray-800">#{user.id}</span>
            </div>

            <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
              <span className="block text-sm text-gray-500 mb-1">Hesap Durumu</span>
              <span className="text-lg font-medium text-green-600">Aktif ✅</span>
            </div>

          </div>

          {/* Aksiyon Butonları */}
          <div className="mt-8 flex gap-4">
            <button className="bg-gray-800 hover:bg-gray-900 text-white px-6 py-2 rounded-lg transition">
              Şifre Değiştir
            </button>
            <button className="border border-gray-300 hover:bg-gray-50 text-gray-700 px-6 py-2 rounded-lg transition">
              Profili Düzenle
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}