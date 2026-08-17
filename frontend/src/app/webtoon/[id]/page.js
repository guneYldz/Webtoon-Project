"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import FavoriteButton from "@/components/FavoriteButton"; // ✅ Button import edildi
import ChapterListPaginated from "@/components/ChapterListPaginated";
import SeriesSummary from "@/components/SeriesSummary";

export default function WebtoonDetail() {
  const params = useParams();
  const { id } = params;

  const [webtoon, setWebtoon] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Backend'den Webtoon detaylarını ve bölümleri çek
    fetch(`https://kaosmanga.net/api/webtoons/${id}`, {
      credentials: 'include' // 🔥 Cookie gönder/al
    })
      .then((res) => {
        if (!res.ok) throw new Error("Webtoon bulunamadı");
        return res.json();
      })
      .then((data) => {
        setWebtoon(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, [id]);

  if (loading) return <div className="min-h-screen flex items-center justify-center text-white text-lg">Yükleniyor...</div>;
  if (!webtoon) return <div className="min-h-screen flex items-center justify-center text-red-500">Webtoon Bulunamadı 😔</div>;

  // 👇 İLK BÖLÜMÜ BULMA MANTIĞI
  // Bölümleri küçükten büyüğe sırala ve ilkini al (Bölüm 1, Bölüm 0 vs.)
  const firstEpisode = webtoon.episodes && webtoon.episodes.length > 0
    ? [...webtoon.episodes].sort((a, b) => a.episode_number - b.episode_number)[0]
    : null;

  return (
    <div className="min-h-screen pb-20 font-sans">

      {/* 1. ÜST KISIM (KAPAK & BİLGİ) */}
      <div className="relative bg-[#1a1a1a] text-white overflow-hidden shadow-2xl border-b border-gray-800">
        {/* Arkaplan Blur Efekti */}
        <div
          className="absolute inset-0 bg-cover bg-center opacity-30 blur-3xl transform scale-110"
          style={{ backgroundImage: `url(https://kaosmanga.net/api/${webtoon.cover_image})` }}
        ></div>

        {/* İçeriği merkeze almak için gradient ekledik */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#161221] via-transparent to-transparent"></div>

        <div className="relative container mx-auto max-w-7xl px-4 py-16 flex flex-col md:flex-row gap-10 items-center md:items-start z-10">
          {/* Kapak Resmi */}
          <div className="w-52 md:w-72 flex-shrink-0 rounded-xl overflow-hidden border border-gray-700 shadow-[0_0_30px_rgba(0,0,0,0.5)]">
            <img
              src={`https://kaosmanga.net/api/${webtoon.cover_image}`}
              alt={webtoon.title}
              className="w-full h-auto object-cover"
            />
          </div>

          {/* Yazılar */}
          <div className="flex-1 text-center md:text-left">
            <h1 className="text-4xl md:text-6xl font-black mb-4 drop-shadow-lg tracking-tight text-white">{webtoon.title}</h1>

            <div className="flex flex-wrap justify-center md:justify-start gap-3 mb-6">
              <span className="bg-blue-600/20 text-blue-400 border border-blue-600/50 px-3 py-1 rounded-full text-sm font-bold">Webtoon</span>
              <span className={`px-3 py-1 rounded-full text-sm font-bold border ${webtoon.status === 'ongoing' ? 'bg-green-500/10 text-green-400 border-green-500/50' : 'bg-red-500/10 text-red-400 border-red-500/50'}`}>
                {webtoon.status === 'ongoing' ? 'Devam Ediyor' : 'Tamamlandı'}
              </span>
              <span className="bg-gray-800/50 text-gray-300 border border-gray-700 px-3 py-1 rounded-full text-sm flex items-center gap-2">
                👁️ {(webtoon.view_count || 0).toLocaleString()}
              </span>
              {(webtoon.categories || []).map((cat) => (
                <span
                  key={cat.id || cat.name}
                  className="bg-orange-500/10 text-orange-300 border border-orange-500/40 px-3 py-1 rounded-full text-sm font-bold"
                >
                  {cat.name}
                </span>
              ))}
            </div>

            {/* 👇 BUTONLAR ALANI (EKLENDİ) */}
            <div className="flex flex-wrap justify-center md:justify-start gap-4 mb-8">
              {/* 1. OKU BUTONU (Mavi) */}
              {firstEpisode && (
                <Link
                  href={`/webtoon/${id}/bolum/${firstEpisode.id}`}
                  className="px-8 py-3 rounded-full bg-blue-600 text-white font-bold hover:bg-blue-500 shadow-[0_0_20px_rgba(37,99,235,0.3)] transition-all flex items-center gap-2"
                  title={`${webtoon.title} Türkçe Oku`}
                >
                  📖 Türkçe Oku
                </Link>
              )}

              {/* 2. FAVORİ BUTONU (Kırmızı) */}
              <FavoriteButton
                type="webtoon"
                id={webtoon.id}
                className="px-8 py-3 rounded-full bg-red-600 text-white border border-red-600 font-bold hover:bg-red-700 hover:border-red-700 shadow-[0_0_15px_rgba(220,38,38,0.4)] transition-all flex items-center gap-2 group"
              />
            </div>

            <SeriesSummary text={webtoon.summary} boxed />
          </div>
        </div>
      </div>

      {/* 2. BÖLÜMLER LİSTESİ */}
      <div className="container mx-auto max-w-7xl px-4 py-12">
        <h3 className="text-2xl font-bold text-white mb-6 border-b border-gray-800 pb-4 flex justify-between items-center">
          <span className="flex items-center gap-2">
            <span className="w-1.5 h-6 bg-blue-600 rounded-full"></span>
            Bölümler
          </span>
          <span className="text-sm font-medium text-gray-400 bg-[#1e1e1e] px-3 py-1 rounded border border-gray-800">
            {webtoon.episodes?.length || 0} Bölüm
          </span>
        </h3>

        <ChapterListPaginated
          items={webtoon.episodes || []}
          type="webtoon"
          basePath={`/webtoon/${id}`}
          accent="blue"
          perPage={30}
        />
      </div>
    </div>
  );
}