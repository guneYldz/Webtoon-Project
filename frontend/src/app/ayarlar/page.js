"use client";

import Link from "next/link";

export default function SettingsPage() {
  return (
    <div className="min-h-screen bg-[#121212] flex flex-col items-center justify-center text-center px-4 font-sans">
      
      {/* İkon / Görsel */}
      <div className="mb-6 p-6 bg-[#1a1a1a] rounded-full border border-gray-800 shadow-[0_0_30px_rgba(255,165,0,0.1)] animate-pulse">
        <span className="text-6xl">🚧</span>
      </div>

      {/* Başlık */}
      <h1 className="text-3xl md:text-5xl font-black text-white mb-4 tracking-tight">
        Bu Sayfa Henüz Hazırlanmadı
      </h1>

      {/* Açıklama */}
      <p className="text-gray-400 text-lg max-w-lg mb-10 leading-relaxed">
        Ayarlar bölümü şu anda geliştirme aşamasındadır. Hesap işlemleriniz için 
        <Link href="/profile" className="text-blue-500 hover:text-blue-400 font-bold mx-2 underline decoration-blue-500/30">
          Profil
        </Link>
        sayfasını kullanabilirsiniz.
      </p>

      {/* Geri Dön Butonu */}
      <Link 
        href="/" 
        className="px-8 py-3 rounded-full bg-white text-black font-bold hover:bg-gray-200 transition-all transform hover:scale-105 shadow-lg flex items-center gap-2"
      >
        <span>🏠</span> Ana Sayfaya Dön
      </Link>

    </div>
  );
}