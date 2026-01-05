"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

export default function WebtoonDetail() {
  const params = useParams();
  const { id } = params;

  const [webtoon, setWebtoon] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Backend'den Webtoon detaylarını ve bölümleri çek
    fetch(`http://127.0.0.1:8000/webtoons/${id}`)
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

  if (loading) return <div className="text-center py-20 text-lg">Yükleniyor...</div>;
  if (!webtoon) return <div className="text-center py-20 text-red-500">Webtoon Bulunamadı 😔</div>;

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      
      {/* 1. ÜST KISIM (KAPAK & BİLGİ) */}
      <div className="relative bg-gray-900 text-white overflow-hidden shadow-lg">
        {/* Arkaplan Blur Efekti */}
        <div 
          className="absolute inset-0 bg-cover bg-center opacity-40 blur-2xl transform scale-110"
          style={{ backgroundImage: `url(http://127.0.0.1:8000/${webtoon.cover_image})` }}
        ></div>

        <div className="relative container mx-auto px-4 py-12 flex flex-col md:flex-row gap-8 items-center md:items-start z-10">
          {/* Kapak Resmi */}
          <div className="w-52 md:w-64 flex-shrink-0 rounded-lg overflow-hidden border-4 border-gray-700 shadow-2xl">
            <img 
              src={`http://127.0.0.1:8000/${webtoon.cover_image}`} 
              alt={webtoon.title} 
              className="w-full h-auto object-cover"
            />
          </div>

          {/* Yazılar */}
          <div className="flex-1 text-center md:text-left">
            <h1 className="text-4xl md:text-5xl font-extrabold mb-3 drop-shadow-lg">{webtoon.title}</h1>
            
            <div className="flex flex-wrap justify-center md:justify-start gap-3 mb-5">
               <span className="bg-blue-600 px-3 py-1 rounded-full text-sm font-semibold">Webtoon</span>
               <span className={`px-3 py-1 rounded-full text-sm font-semibold border ${webtoon.status === 'ongoing' ? 'border-green-400 text-green-400' : 'border-red-400 text-red-400'}`}>
                 {webtoon.status === 'ongoing' ? 'Devam Ediyor' : 'Tamamlandı'}
               </span>
            </div>

            <p className="text-gray-200 text-lg leading-relaxed max-w-3xl mb-6 drop-shadow-md">
              {webtoon.summary}
            </p>
          </div>
        </div>
      </div>

      {/* 2. BÖLÜMLER LİSTESİ */}
      <div className="container mx-auto px-4 py-10 max-w-4xl">
        <h3 className="text-2xl font-bold text-gray-800 mb-6 border-b-2 border-gray-200 pb-2 flex justify-between items-center">
          <span>Bölümler</span>
          <span className="text-sm font-normal text-gray-500">{webtoon.episodes?.length || 0} Bölüm</span>
        </h3>
        
        <div className="flex flex-col gap-3">
          {webtoon.episodes && webtoon.episodes.length > 0 ? (
            // Veritabanındaki bölümleri listele (Yeniden eskiye sıralı gelmesi için reverse yapabilirsin)
            [...webtoon.episodes].reverse().map((ep) => (
              <Link 
                key={ep.id} 
                // BURASI ÖNEMLİ: Okuma sayfasına gidecek link
                href={`/webtoon/${id}/bolum/${ep.id}`} 
                className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 hover:border-blue-500 hover:shadow-md transition flex items-center justify-between group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center text-gray-500 font-bold group-hover:bg-blue-100 group-hover:text-blue-600 transition">
                    #{ep.episode_number}
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-800 text-lg group-hover:text-blue-600 transition">
                      {ep.title}
                    </h4>
                    <span className="text-xs text-gray-400">
                      {new Date(ep.created_at).toLocaleDateString("tr-TR")}
                    </span>
                  </div>
                </div>

                <div className="text-gray-400 group-hover:text-blue-600 font-medium text-sm flex items-center gap-1">
                  Oku <span className="text-xl">→</span>
                </div>
              </Link>
            ))
          ) : (
            <div className="text-center py-10 bg-white rounded-lg border border-dashed border-gray-300 text-gray-500">
              Henüz hiç bölüm yüklenmemiş. 🕸️
            </div>
          )}
        </div>
      </div>
    </div>
  );
}