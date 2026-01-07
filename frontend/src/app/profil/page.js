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
      <div className="min-h-screen flex items-center justify-center bg-[#121212]">
        <div className="text-xl font-semibold text-blue-500 animate-pulse">
          Yükleniyor...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#121212] py-20 px-4">
      {/* DÜZELTME: max-w-4xl ile ortaladık ve koyu tema uyguladık */}
      <div className="max-w-4xl mx-auto bg-[#1e1e1e] rounded-2xl shadow-2xl border border-gray-800 overflow-hidden">
        
        {/* Üst Başlık Kısmı (Banner) */}
        <div className="relative bg-gradient-to-r from-blue-900 via-blue-800 to-indigo-900 p-8 sm:p-12 text-white flex flex-col sm:flex-row items-center sm:items-end gap-6">
          {/* Dekoratif Arkaplan Deseni */}
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
          
          <div className="relative z-10 w-28 h-28 bg-[#121212] p-1 rounded-full shadow-xl -mb-16 sm:mb-0">
             <div className="w-full h-full bg-gradient-to-tr from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-5xl font-bold text-white shadow-inner">
                {user.username.charAt(0).toUpperCase()}
             </div>
          </div>
          
          <div className="relative z-10 text-center sm:text-left mt-10 sm:mt-0 flex-1">
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight">{user.username}</h1>
            <p className="opacity-80 text-blue-200 font-medium">{user.email}</p>
          </div>

           {/* Rol Rozeti */}
           <div className="relative z-10 mb-2 sm:mb-4">
                <span className="bg-white/10 backdrop-blur-sm border border-white/20 px-4 py-1.5 rounded-full text-sm font-bold tracking-wide uppercase shadow-sm">
                  {user.role === 'admin' ? '🛡️ Yönetici' : '👤 Kullanıcı'}
                </span>
           </div>
        </div>

        {/* Detaylar Kısmı */}
        <div className="p-8 sm:p-12 pt-16 sm:pt-12">
          <div className="flex justify-between items-center mb-6">
             <h2 className="text-xl font-bold text-white flex items-center gap-2">
               <span className="w-1.5 h-6 bg-blue-500 rounded-full"></span> Hesap Bilgileri
             </h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            <div className="p-5 bg-[#121212] rounded-xl border border-gray-800 hover:border-gray-700 transition group">
              <span className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Kullanıcı Rolü</span>
              <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${user.role === 'admin' ? 'bg-red-500' : 'bg-blue-500'}`}></div>
                  <span className="text-lg font-medium text-gray-200 capitalize group-hover:text-white transition">
                    {user.role}
                  </span>
              </div>
            </div>

            <div className="p-5 bg-[#121212] rounded-xl border border-gray-800 hover:border-gray-700 transition group">
              <span className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Kullanıcı ID</span>
              <span className="text-lg font-mono font-medium text-gray-200 group-hover:text-white transition">#{user.id}</span>
            </div>

            <div className="p-5 bg-[#121212] rounded-xl border border-gray-800 hover:border-gray-700 transition group">
              <span className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Hesap Durumu</span>
              <span className="text-lg font-medium text-green-400 flex items-center gap-2">
                 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                 Aktif
              </span>
            </div>

            <div className="p-5 bg-[#121212] rounded-xl border border-gray-800 hover:border-gray-700 transition group">
              <span className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Kayıt Tarihi</span>
              <span className="text-lg font-medium text-gray-200 group-hover:text-white transition">20 Ocak 2024</span>
            </div>

          </div>

          {/* Aksiyon Butonları */}
          <div className="mt-10 flex flex-col sm:flex-row gap-4 pt-8 border-t border-gray-800">
            <button className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold px-6 py-3 rounded-xl transition shadow-lg shadow-blue-900/20">
              Şifre Değiştir
            </button>
            <button className="flex-1 bg-[#252525] hover:bg-[#333] text-gray-200 font-bold px-6 py-3 rounded-xl border border-gray-700 hover:border-gray-500 transition">
              Profili Düzenle
            </button>
            <button 
                onClick={() => {
                    localStorage.removeItem("token");
                    router.push("/login");
                }}
                className="bg-red-900/20 hover:bg-red-900/40 text-red-400 font-bold px-6 py-3 rounded-xl border border-red-900/50 hover:border-red-500/50 transition"
            >
              Çıkış Yap
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}