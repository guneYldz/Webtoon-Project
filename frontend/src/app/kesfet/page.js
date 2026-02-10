"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

// Metadata removed to fix "use client" error. See layout.js.

export default function KesfetPage() {
  const [allSeries, setAllSeries] = useState([]); // Webtoon + Novel birleşik liste
  const [filteredSeries, setFilteredSeries] = useState([]); // Filtrelenmiş sonuçlar
  const [loading, setLoading] = useState(true);

  // Filtre State'leri
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGenre, setSelectedGenre] = useState("Tümü");
  const [selectedType, setSelectedType] = useState("Hepsi"); // Webtoon mu Novel mi?

  const genres = ["Tümü", "Aksiyon", "Macera", "Fantastik", "Dram", "Romantizm", "Isekai", "Komedi"];

  // 1. Verileri Çek (Webtoon + Novel)
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [webtoonRes, novelRes] = await Promise.all([
          fetch("http://127.0.0.1:8000/webtoons/"),
          fetch("http://127.0.0.1:8000/novels/")
        ]);

        const webtoons = await webtoonRes.json();
        const novels = await novelRes.json();

        // Verileri normalize edip birleştiriyoruz
        const combined = [
          ...webtoons.map(w => ({ ...w, type: "WEBTOON", link: `/webtoon/${w.id}` })),
          ...novels.map(n => ({ ...n, type: "NOVEL", link: `/novel/${n.slug}` }))
        ];

        setAllSeries(combined);
        setFilteredSeries(combined);
        setLoading(false);
      } catch (err) {
        console.error("Keşfet verileri çekilemedi:", err);
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // 2. Filtreleme Mantığı
  useEffect(() => {
    let result = allSeries;

    // Arama Filtresi
    if (searchQuery.trim() !== "") {
      result = result.filter((item) =>
        item.title.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Tür Filtresi (Webtoon mu Novel mi?)
    if (selectedType !== "Hepsi") {
      result = result.filter(item => item.type === selectedType);
    }

    // Kategori Filtresi (Örn: Fantastik)
    if (selectedGenre !== "Tümü") {
      // Backend'de genre listesi varsa burası aktif olur. 
      // Şimdilik başlıkta aratabiliriz veya dummy bırakabiliriz.
      // result = result.filter(item => item.genres?.includes(selectedGenre));
    }

    setFilteredSeries(result);
  }, [searchQuery, selectedGenre, selectedType, allSeries]);

  if (loading) return <div className="min-h-screen bg-[#121212] flex items-center justify-center text-white text-lg animate-pulse">Kütüphane taranıyor...</div>;

  return (
    <div className="min-h-screen bg-[#121212] pb-20 font-sans">

      {/* HEADER BÖLÜMÜ */}
      <div className="bg-[#1a1a1a] border-b border-gray-800 pt-10 pb-8 px-4">
        <div className="container mx-auto max-w-7xl">
          <h1 className="text-3xl font-black text-white mb-6 flex items-center gap-3">
            <span className="bg-gradient-to-r from-blue-600 to-purple-600 w-10 h-10 rounded-lg flex items-center justify-center shadow-lg text-xl">🧭</span>
            Keşfet
          </h1>

          <div className="flex flex-col gap-6">
            {/* Üst Sıra: Arama ve Tip Seçimi */}
            <div className="flex flex-col md:flex-row gap-4">
              {/* Arama Kutusu */}
              <div className="relative flex-1">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <input
                  type="text"
                  className="w-full bg-[#121212] border border-gray-700 text-white rounded-xl py-3 pl-10 pr-4 focus:ring-2 focus:ring-blue-500 transition outline-none"
                  placeholder="Seri veya roman ara..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              {/* Tip Seçici (Webtoon/Novel) */}
              <div className="flex bg-[#121212] border border-gray-700 p-1 rounded-xl">
                {["Hepsi", "WEBTOON", "NOVEL"].map((t) => (
                  <button
                    key={t}
                    onClick={() => setSelectedType(t)}
                    className={`px-6 py-2 rounded-lg text-xs font-bold transition ${selectedType === t ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-white'}`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Alt Sıra: Türler */}
            <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2">
              {genres.map((genre) => (
                <button
                  key={genre}
                  onClick={() => setSelectedGenre(genre)}
                  className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition border ${selectedGenre === genre
                    ? "bg-white text-black border-white"
                    : "bg-[#252525] text-gray-400 border-gray-700 hover:border-gray-500"
                    }`}
                >
                  {genre}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* LİSTELEME ALANI */}
      <div className="container mx-auto max-w-7xl px-4 py-8">

        <div className="mb-6 flex justify-between items-center text-gray-400 text-sm">
          <span>Toplam <span className="text-white font-bold">{filteredSeries.length}</span> sonuç</span>
          <span className="text-xs uppercase tracking-widest">{selectedType} Görünümü</span>
        </div>

        {filteredSeries.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-x-5 gap-y-10">
            {filteredSeries.map((s) => (
              <div key={`${s.type}-${s.id}`} className="group flex flex-col gap-3">
                {/* Kart Resmi */}
                <div className="relative aspect-[2/3] rounded-2xl overflow-hidden border border-gray-800 shadow-lg group-hover:border-gray-500 transition-all duration-300">
                  <Link href={s.link}>
                    <img
                      src={`http://127.0.0.1:8000/${s.cover_image}`}
                      alt={s.title}
                      className="w-full h-full object-cover transition duration-500 group-hover:scale-110"
                    />
                  </Link>

                  {/* Tür Etiketi */}
                  <div className="absolute top-3 left-3">
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded shadow-lg text-white border border-white/10 ${s.type === 'WEBTOON' ? 'bg-blue-600' : 'bg-purple-600'}`}>
                      {s.type}
                    </span>
                  </div>
                </div>

                {/* Bilgiler */}
                <div>
                  <Link href={s.link}>
                    <h3 className="font-bold text-sm text-gray-100 truncate group-hover:text-blue-400 transition">
                      {s.title}
                    </h3>
                  </Link>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-[10px] text-gray-500">{s.author || (s.type === 'WEBTOON' ? 'Stüdyo' : 'Yazar')}</span>
                    <span className="text-[10px] text-gray-600">👁️ {s.view_count || 0}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-24 text-center border border-dashed border-gray-800 rounded-3xl bg-[#1a1a1a]">
            <div className="text-5xl mb-4">🛸</div>
            <h3 className="text-xl font-bold text-white mb-2">Buralarda kimse yok...</h3>
            <p className="text-gray-500 text-sm">Aradığın seri henüz kütüphanemize eklenmemiş olabilir.</p>
            <button
              onClick={() => { setSearchQuery(""); setSelectedType("Hepsi"); setSelectedGenre("Tümü"); }}
              className="mt-6 px-6 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-500 transition"
            >
              Aramayı Sıfırla
            </button>
          </div>
        )}
      </div>
    </div>
  );
}