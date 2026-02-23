import Link from "next/link";
import Image from "next/image";
import FavoriteButton from "@/components/FavoriteButton";

// --- 1. SEO AYARLARI (DİNAMİK METADATA) ---
export async function generateMetadata({ params }) {
  const { slug } = params;

  try {
    const clientApiUrl = process.env.NEXT_PUBLIC_API_URL || "https://api.kaosmanga.net";
    const apiUrl = typeof window === 'undefined' ? 'http://backend:8000' : clientApiUrl;
    const res = await fetch(`${apiUrl}/novels/${slug}`);
    const novel = await res.json();

    if (!novel || novel.detail) {
      return { title: "Roman Bulunamadı" };
    }

    return {
      title: `${novel.title} Oku - Türkçe Novel`,
      description: novel.summary ? novel.summary.slice(0, 160) + "..." : "Türkçe Novel Oku",
      openGraph: {
        title: novel.title,
        description: novel.summary,
        images: [novel.cover_image ? `${process.env.NEXT_PUBLIC_API_URL || "https://api.kaosmanga.net"}/${novel.cover_image}` : ''],
      },
    };
  } catch (error) {
    return { title: "Hata" };
  }
}

// --- 2. SAYFA TASARIMI (SERVER COMPONENT) ---
export default async function NovelDetail({ params }) {
  const { slug } = params;

  let novel = null;

  try {
    // 🔥 DOCKER FIX: Server Component Docker network'te çalışıyor
    // Client-side: localhost:8000 ✅
    // Server-side (SSR): backend:8000 ✅
    const clientApiUrl = process.env.NEXT_PUBLIC_API_URL || "https://api.kaosmanga.net";
    const apiUrl = typeof window === 'undefined'
      ? 'http://backend:8000'  // Server-side (Docker network)
      : clientApiUrl;                  // Client-side (browser)

    const res = await fetch(`${apiUrl}/novels/${slug}`, {
      cache: 'no-store',
      credentials: typeof window === 'undefined' ? 'omit' : 'include'
    });
    if (res.ok) {
      novel = await res.json();
    }
  } catch (err) {
    console.error("Bağlantı hatası:", err);
  }

  // Eğer roman bulunamadıysa:
  if (!novel) return <div className="min-h-screen bg-[#121212] flex items-center justify-center text-red-500">Roman Bulunamadı 😔</div>;

  // 👇 İLK BÖLÜMÜ BULMA MANTIĞI
  const firstChapter = novel.chapters && novel.chapters.length > 0
    ? [...novel.chapters].sort((a, b) => a.chapter_number - b.chapter_number)[0]
    : null;

  return (
    <div className="min-h-screen bg-[#121212] pb-20 font-sans">

      {/* ÜST KISIM (KAPAK & BİLGİLER) */}
      <div className="relative bg-[#1a1a1a] text-white overflow-hidden shadow-2xl border-b border-gray-800">
        {/* Arka plan resmi (bulanık) */}
        <div
          className="absolute inset-0 bg-cover bg-center opacity-20 blur-3xl transform scale-110"
          style={{ backgroundImage: `url(${process.env.NEXT_PUBLIC_API_URL || "https://api.kaosmanga.net"}/${novel.cover_image})` }}
        ></div>
        <div className="absolute inset-0 bg-gradient-to-t from-[#121212] via-transparent to-transparent"></div>

        <div className="relative container mx-auto max-w-7xl px-4 py-16 flex flex-col md:flex-row gap-10 items-center md:items-start z-10">

          {/* Kapak Resmi */}
          <div className="w-52 md:w-72 flex-shrink-0 rounded-2xl overflow-hidden border border-purple-500/30 shadow-[0_0_50px_rgba(147,51,234,0.2)]">
            <img
              src={`${process.env.NEXT_PUBLIC_API_URL || "https://api.kaosmanga.net"}/${novel.cover_image}`}
              alt={novel.title}
              className="w-full h-auto object-cover"
            />
          </div>

          {/* Yazılar ve Butonlar */}
          <div className="flex-1 text-center md:text-left">
            <h1 className="text-4xl md:text-6xl font-black mb-4 drop-shadow-lg tracking-tight text-white italic">
              {novel.title}
            </h1>

            <div className="flex flex-wrap justify-center md:justify-start gap-3 mb-6">
              <span className="bg-purple-600/20 text-purple-400 border border-purple-600/50 px-4 py-1.5 rounded-full text-sm font-bold tracking-widest uppercase">Novel</span>
              <span className={`px-4 py-1.5 rounded-full text-sm font-bold border ${novel.status === 'ongoing' ? 'bg-green-500/10 text-green-400 border-green-500/50' : 'bg-red-500/10 text-red-400 border-red-500/50'}`}>
                {novel.status === 'ongoing' ? 'Devam Ediyor' : 'Tamamlandı'}
              </span>
              <span className="bg-gray-800/50 text-gray-300 border border-gray-700 px-4 py-1.5 rounded-full text-sm">
                ✍️ {novel.author || "Bilinmeyen Yazar"}
              </span>
            </div>

            {/* --- BUTONLAR ALANI --- */}
            <div className="flex flex-wrap justify-center md:justify-start gap-4 mb-8">
              {/* 1. OKU BUTONU (Mor) */}
              {firstChapter && (
                <Link
                  href={`/novel/${slug}/bolum/${firstChapter.chapter_number}`}
                  className="px-8 py-3 rounded-full bg-purple-600 text-white font-bold hover:bg-purple-500 shadow-[0_0_20px_rgba(147,51,234,0.3)] transition-all flex items-center gap-2"
                >
                  📖 Hemen Oku
                </Link>
              )}

              {/* 2. FAVORİ BUTONU (DİREKT KIRMIZI ❤️) */}
              <FavoriteButton
                type="novel"
                id={novel.id}
                // 👇 BURASI DEĞİŞTİ: bg-red-600 (Kırmızı) ve text-white (Beyaz) varsayılan oldu.
                className="px-8 py-3 rounded-full bg-red-600 text-white border border-red-600 font-bold hover:bg-red-700 hover:border-red-700 shadow-[0_0_15px_rgba(220,38,38,0.4)] transition-all flex items-center gap-2 group"
              />
            </div>

            {/* Özet Kutusu */}
            <div className="bg-white/5 backdrop-blur-sm p-6 rounded-2xl border border-white/10">
              <p className="text-gray-300 text-lg leading-relaxed italic">{novel.summary}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ALT KISIM (BÖLÜM LİSTESİ) */}
      <div className="container mx-auto max-w-7xl px-4 py-12">
        <h3 className="text-2xl font-bold text-white mb-8 border-b border-gray-800 pb-4 flex justify-between items-center">
          <span className="flex items-center gap-2">
            <span className="w-1.5 h-6 bg-purple-600 rounded-full"></span>
            Bölüm Listesi
          </span>
          <span className="text-sm text-gray-400 bg-[#1e1e1e] px-3 py-1 rounded-full border border-gray-800">
            {novel.chapters?.length || 0} Bölüm
          </span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {novel.chapters && novel.chapters.length > 0 ? (
            // Bölümleri numaraya göre tersten sırala (En yeni en üstte)
            [...novel.chapters].sort((a, b) => b.chapter_number - a.chapter_number).map((ch) => (
              <Link
                key={ch.id}
                href={`/novel/${slug}/bolum/${ch.chapter_number}`}
                className="bg-[#1e1e1e] p-5 rounded-2xl border border-gray-800 hover:border-purple-500/50 hover:bg-[#252525] transition-all flex items-center justify-between group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-purple-900/20 rounded-xl flex items-center justify-center text-purple-400 font-bold group-hover:bg-purple-600 group-hover:text-white transition-all">
                    {ch.chapter_number}
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-200 group-hover:text-white transition">{ch.title}</h4>
                    <span className="text-[10px] text-gray-500 uppercase tracking-widest group-hover:text-purple-400">Okumak için tıkla</span>
                  </div>
                </div>
                <div className="text-gray-600 group-hover:text-purple-500 transition">➜</div>
              </Link>
            ))
          ) : (
            <div className="col-span-full text-center py-10 bg-[#1e1e1e] rounded-xl border border-dashed border-gray-800 text-gray-500">
              Henüz bölüm yüklenmemiş. Bot çalışıyor mu? 🤖
            </div>
          )}
        </div>
      </div>
    </div>
  );
}