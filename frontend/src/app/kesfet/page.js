"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

export default function KesfetPage() {
  const [webtoons, setWebtoons] = useState([]); // Tüm veriler
  const [filteredWebtoons, setFilteredWebtoons] = useState([]); // Filtrelenmiş veriler
  const [loading, setLoading] = useState(true);
  
  // Filtre State'leri
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGenre, setSelectedGenre] = useState("Tümü");

  // Kategoriler (Sabit liste veya backend'den çekilebilir)
  const genres = ["Tümü", "Aksiyon", "Macera", "Fantastik", "Dram", "Romantizm", "Isekai", "Komedi"];

  // 1. Verileri Çek
  useEffect(() => {
    fetch("http://127.0.0.1:8000/webtoons/")
      .then((res) => res.json())
      .then((data) => {
        setWebtoons(data);
        setFilteredWebtoons(data); // İlk başta hepsi görünsün
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  // 2. Arama veya Kategori Değişince Filtrele
  useEffect(() => {
    let result = webtoons;

    // Arama Filtresi (Başlığa göre)
    if (searchQuery.trim() !== "") {
      result = result.filter((w) =>
        w.title.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Kategori Filtresi (Not: Backend'de 'genre' alanı yoksa şimdilik sadece dummy filtreleme yapar. 
    // Eğer backend'de genre varsa: w.genre === selectedGenre şeklinde açabilirsin.)
    if (selectedGenre !== "Tümü") {
      // Örnek mantık: Eğer veride genre yoksa rastgele filtreliyormuş gibi yapmayalım,
      // Gerçek projede burası: result = result.filter(w => w.genre.includes(selectedGenre))
      // Şimdilik boş bırakıyorum veya title içinde aratabiliriz.
    }

    setFilteredWebtoons(result);
  }, [searchQuery, selectedGenre, webtoons]);

  if (loading) return <div className="min-h-screen bg-[#121212] flex items-center justify-center text-white text-lg animate-pulse">Yükleniyor...</div>;

  return (
    <div className="min-h-screen bg-[#121212] pb-20 font-sans">
      
      {/* HEADER BÖLÜMÜ (Başlık & Arama) */}
      <div className="bg-[#1a1a1a] border-b border-gray-800 pt-10 pb-8 px-4">
        <div className="container mx-auto max-w-7xl">
            <h1 className="text-3xl font-black text-white mb-6 flex items-center gap-3">
              <span className="bg-gradient-to-r from-blue-600 to-purple-600 w-10 h-10 rounded-lg flex items-center justify-center shadow-lg text-xl">🧭</span>
              Keşfet
            </h1>

            {/* Arama ve Filtre Alanı */}
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                
                {/* Arama Kutusu */}
                <div className="relative w-full md:w-96">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <svg className="h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </div>
                    <input 
                        type="text" 
                        className="w-full bg-[#121212] border border-gray-700 text-white rounded-xl py-3 pl-10 pr-4 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition placeholder-gray-600"
                        placeholder="Webtoon ara..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                {/* Kategori Butonları (Kaydırılabilir) */}
                <div className="w-full md:w-auto overflow-x-auto pb-2 md:pb-0 scrollbar-hide">
                    <div className="flex gap-2">
                        {genres.map((genre) => (
                            <button
                                key={genre}
                                onClick={() => setSelectedGenre(genre)}
                                className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition border ${
                                    selectedGenre === genre 
                                    ? "bg-white text-black border-white" 
                                    : "bg-[#252525] text-gray-400 border-gray-700 hover:border-gray-500 hover:text-white"
                                }`}
                            >
                                {genre}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
      </div>

      {/* LİSTELEME ALANI */}
      <div className="container mx-auto max-w-7xl px-4 py-8">
        
        {/* Sonuç Sayısı */}
        <div className="mb-6 text-gray-400 text-sm font-medium">
            Toplam <span className="text-white">{filteredWebtoons.length}</span> sonuç bulundu.
        </div>

        {filteredWebtoons.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-x-4 gap-y-8">
            {filteredWebtoons.map((w) => (
                <div key={w.id} className="group flex flex-col gap-2">
                
                {/* Kart Resmi */}
                <div className="relative aspect-[2/3] rounded-xl overflow-hidden border border-gray-800 shadow-lg group-hover:shadow-blue-900/20 group-hover:border-blue-500/50 transition duration-300">
                    <Link href={`/webtoon/${w.id}`}>
                        <img 
                            src={`http://127.0.0.1:8000/${w.cover_image}`} 
                            alt={w.title} 
                            className="w-full h-full object-cover transition duration-500 group-hover:scale-110"
                            loading="lazy"
                        />
                    </Link>
                    
                    {/* Sol Üst Etiket */}
                    <div className="absolute top-2 left-2">
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded text-white shadow-sm border border-black/10 ${w.status === 'ongoing' ? 'bg-blue-600' : 'bg-red-600'}`}>
                        {w.status === 'ongoing' ? 'ONGOING' : 'TAMAMLANDI'}
                        </span>
                    </div>

                    {/* Hover Overlay (İsteğe bağlı) */}
                    <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
                </div>
                
                {/* Bilgiler */}
                <div>
                    <Link href={`/webtoon/${w.id}`}>
                        <h3 className="font-bold text-sm text-gray-100 truncate group-hover:text-blue-400 transition">
                            {w.title}
                        </h3>
                    </Link>
                    <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-gray-500 bg-[#1e1e1e] border border-gray-800 px-1.5 py-0.5 rounded">
                            {(w.episodes?.length || 0)} Bölüm
                        </span>
                        <span className="text-[10px] text-gray-500 flex items-center gap-1">
                            👁️ {(w.view_count || 0).toLocaleString()}
                        </span>
                    </div>
                </div>
                </div>
            ))}
            </div>
        ) : (
            // Sonuç Bulunamadı Ekranı
            <div className="flex flex-col items-center justify-center py-20 text-center border-2 border-dashed border-gray-800 rounded-2xl bg-[#1a1a1a]">
                <div className="text-4xl mb-4">🔍</div>
                <h3 className="text-xl font-bold text-white mb-2">Sonuç Bulunamadı</h3>
                <p className="text-gray-500 text-sm">Aradığınız kriterlere uygun bir webtoon yok.</p>
                <button 
                    onClick={() => {setSearchQuery(""); setSelectedGenre("Tümü");}}
                    className="mt-4 text-blue-400 hover:text-blue-300 text-sm font-bold hover:underline"
                >
                    Filtreleri Temizle
                </button>
            </div>
        )}

      </div>
    </div>
  );
}