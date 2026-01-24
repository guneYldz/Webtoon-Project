"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Lato } from "next/font/google"; 
import CommentSection from "@/components/CommentSection"; 
import ReadingHero from "@/components/ReadingHero"; 
import { API } from "@/api"; 

const lato = Lato({ subsets: ["latin"], weight: ["400", "700"], display: "swap" });

export default function WebtoonReadingPage() {
  const params = useParams();
  const router = useRouter();
  
  const [episode, setEpisode] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [showNavbar, setShowNavbar] = useState(true); 
  const lastScrollY = useRef(0);

  useEffect(() => {
    if (!params.episodeId) return;

    const fetchEpisode = async () => {
      try {
        setLoading(true);
        const res = await fetch(`${API}/episodes/${params.episodeId}`);
        if (!res.ok) throw new Error("Bölüm yüklenemedi.");
        const data = await res.json();
        setEpisode(data);
      } catch (err) {
        console.error(err);
        setError("Bölüm bulunamadı.");
      } finally {
        setLoading(false);
      }
    };

    fetchEpisode();
  }, [params.episodeId]);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      if (currentScrollY > lastScrollY.current && currentScrollY > 100) {
        setShowNavbar(false);
      } else {
        setShowNavbar(true);
      }
      lastScrollY.current = currentScrollY;
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  if (loading) return (
    <div className="min-h-screen bg-[#121212] flex items-center justify-center text-blue-500 animate-pulse font-bold tracking-widest">
        YÜKLENİYOR...
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-[#121212] flex flex-col items-center justify-center text-gray-400 gap-4">
        <p>{error}</p>
        <button onClick={() => router.back()} className="text-white bg-gray-800 px-4 py-2 rounded hover:bg-gray-700">
            Geri Dön
        </button>
    </div>
  );

  if (!episode) return null;

  return (
    <div className={`min-h-screen bg-[#121212] text-gray-200 pb-40 ${lato.className}`}>
      
      <ReadingHero 
        title={`Bölüm ${episode.episode_number}`}
        seriesTitle={episode.webtoon_title}
        coverImage={episode.webtoon_cover}
        viewCount={episode.view_count}
        date={episode.created_at}
        slug={episode.webtoon_slug || params.id}
        type="webtoon"
      />

      {/* --- RESİM ALANI (GÜNCELLENDİ) --- */}
      <div className="max-w-4xl mx-auto bg-[#121212] shadow-2xl flex flex-col">
        {episode.images && episode.images.length > 0 ? (
            episode.images.map((imgUrl, index) => (
                <img 
                    key={index} // Liste olduğu için index kullanıyoruz
                    src={imgUrl} // Backend tam URL gönderdiği için direkt kullanıyoruz
                    alt={`Sayfa ${index + 1}`}
                    className="w-full h-auto object-contain block" 
                    loading="lazy"
                />
            ))
        ) : (
            <div className="p-20 text-center text-gray-500">
                <p>Bu bölüme henüz görsel yüklenmemiş.</p>
            </div>
        )}
      </div>

      {/* Yorum Alanı */}
      <div className="mt-0 max-w-4xl mx-auto border-t border-gray-800 bg-[#121212] py-12 px-4 md:px-12">
          <CommentSection 
              type="webtoon" 
              itemId={episode.webtoon_id} 
              episodeId={episode.id}      
          />
      </div>

      {/* Alt Sabit Bar */}
      <div 
        className={`fixed bottom-0 left-0 w-full z-[999] transition-transform duration-300 ease-in-out ${
          showNavbar ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <div className="flex justify-center w-full">
            <div className="w-full max-w-4xl bg-[#121212]/95 backdrop-blur-xl border-t border-blue-500/20 shadow-[0_-10px_40px_-10px_rgba(0,0,0,0.8)] flex justify-between items-center text-white h-16 px-6">
                
                <Link href={`/webtoon/${episode.webtoon_slug || params.id}`} className="text-gray-400 hover:text-blue-400 font-medium flex items-center gap-2 transition group">
                  <span className="text-xl group-hover:-translate-x-1 transition">←</span> 
                  <span className="hidden sm:inline text-xs font-bold tracking-widest uppercase">Seri</span>
                </Link>
                
                <div className="flex flex-col items-center justify-center px-4">
                    <h2 className="text-xs font-bold text-gray-200 max-w-[120px] sm:max-w-xs truncate text-center tracking-wide">
                      {episode.webtoon_title}
                    </h2>
                    <span className="text-[10px] text-blue-500 font-black tracking-widest">BÖLÜM {episode.episode_number}</span>
                </div>

                <div className="flex gap-3">
                    <button 
                      onClick={() => episode.prev_episode_id && router.push(`/webtoon/${params.id}/bolum/${episode.prev_episode_id}`)}
                      disabled={!episode.prev_episode_id}
                      className="px-3 py-1.5 rounded-lg bg-[#1a1a1a] border border-white/10 text-xs font-bold disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-800 hover:text-blue-400 transition"
                    >
                      Önceki
                    </button>
                    <button 
                      onClick={() => episode.next_episode_id && router.push(`/webtoon/${params.id}/bolum/${episode.next_episode_id}`)}
                      disabled={!episode.next_episode_id}
                      className="px-3 py-1.5 rounded-lg bg-blue-600 border border-blue-500 text-xs font-bold text-white disabled:opacity-30 disabled:cursor-not-allowed hover:bg-blue-500 transition shadow-lg"
                    >
                      Sonraki
                    </button>
                </div>
            </div>
        </div>
      </div>

    </div>
  );
}