"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Lato } from "next/font/google";
import CommentSection from "@/components/CommentSection";
import ReadingHero from "@/components/ReadingHero";
import { API } from "@/api";

const lato = Lato({ subsets: ["latin"], weight: ["400", "700"], display: "swap" });

export default function ClientWebtoonReadingPage() {
    const params = useParams();
    const router = useRouter();

    const [episode, setEpisode] = useState(null);
    const [allEpisodes, setAllEpisodes] = useState([]); // Tüm bölümleri tutacak state
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const [showNavbar, setShowNavbar] = useState(true);
    const lastScrollY = useRef(0);

    // --- 1. KLAVYE İLE GEÇİŞ (EKSTRA ÖZELLİK) ---
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (!episode) return;
            if (e.key === 'ArrowLeft' && episode.prev_episode_id) {
                router.push(`/webtoon/${params.id}/bolum/${episode.prev_episode_id}`);
            } else if (e.key === 'ArrowRight' && episode.next_episode_id) {
                router.push(`/webtoon/${params.id}/bolum/${episode.next_episode_id}`);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [episode, router, params.id]);

    // --- 2. VERİ ÇEKME (AKILLI SAYAÇLI) ---
    useEffect(() => {
        if (!params.episodeId) return;

        const fetchEpisode = async () => {
            try {
                setLoading(true);
                setError(null);

                // API Adresi Güvenliği
                const apiUrl = API || "https://kaosmanga.net/api";

                // 🔥 KRİTİK NOKTA: credentials: "include" eklendi.
                const res = await fetch(`${apiUrl}/episodes/${params.episodeId}`, {
                    cache: "no-store",      // Eski veriyi tutma
                    credentials: "include"  // Backend'e kimlik gönder (F5 koruması için)
                });

                if (!res.ok) throw new Error("Bölüm yüklenemedi.");
                const data = await res.json();
                setEpisode(data);

                // Ek olarak tüm bölümleri çek (Dropdown için)
                // Eğer data içinde webtoon_id varsa oradan, yoksa params.id'den
                const webtoonId = data.webtoon_id || params.id; // slug veya id olabilir, dikkat.

                // Webtoon detayını çekip bölümleri alıyoruz
                // NOT: API yapınıza göre burası değişebilir, ama webtoon detayında bölümler varsa oradan alırız.
                // Webtoon ID'si integer ise direkt endpointi kullanabiliriz.
                // Eğer params.id bir slug ise, backendin bunu çözmesi lazım.
                // Garanti olsun diye webtoons endpointine istek atalım:

                if (webtoonId) {
                    const webtoonRes = await fetch(`${apiUrl}/webtoons/${params.id}`); // URL params.id kullandık çünkü slug da olabilir
                    if (webtoonRes.ok) {
                        const webtoonData = await webtoonRes.json();
                        if (webtoonData.episodes) {
                            // Bölümleri numarasına göre sırala (Büyükten küçüğe: En yeni en üstte)
                            const sortedEpisodes = [...webtoonData.episodes].sort((a, b) => b.episode_number - a.episode_number);
                            setAllEpisodes(sortedEpisodes);
                        }
                    }
                }

            } catch (err) {
                console.error("Hata:", err);
                setError("Bölüm bulunamadı veya yüklenirken hata oluştu.");
            } finally {
                setLoading(false);
            }
        };

        fetchEpisode();
    }, [params.episodeId]);

    // --- 3. SCROLL BAR MANTIĞI ---
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
            <button onClick={() => window.location.reload()} className="text-white bg-gray-800 px-4 py-2 rounded hover:bg-gray-700">
                Tekrar Dene
            </button>
        </div>
    );

    if (!episode) return null;

    // --- GÖRÜNÜM KISMI (ESKİ KODUN AYNISI) ---
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

            {/* --- YENİ: ÜST BÖLÜM SEÇİCİ --- */}
            <div className="max-w-4xl mx-auto bg-[#121212] px-4 md:px-0 mt-8 mb-8">
                <div className="flex justify-center">
                    <div className="relative w-full max-w-xs">
                        <select
                            className="w-full bg-[#1a1a1a] text-gray-300 border border-gray-800 rounded-lg px-4 py-3 appearance-none outline-none focus:border-blue-500 transition cursor-pointer"
                            onChange={(e) => router.push(`/webtoon/${params.id}/bolum/${e.target.value}`)}
                            value={episode.id}
                        >
                            {/* Bölümler buraya yüklenecek */}
                            {allEpisodes.map((ep) => (
                                <option key={ep.id} value={ep.id}>
                                    Bölüm {ep.episode_number}
                                </option>
                            ))}
                        </select>
                        {/* Ok ikonu */}
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">
                            ▼
                        </div>
                    </div>
                </div>
            </div>

            {/* --- RESİM ALANI --- */}
            <div className="max-w-4xl mx-auto bg-[#121212] shadow-2xl flex flex-col">
                {episode.images && episode.images.length > 0 ? (
                    episode.images.map((imgUrl, index) => (
                        <div key={index} className="relative w-full aspect-[2/3]">
                            <Image
                                src={imgUrl}
                                alt={`Sayfa ${index + 1}`}
                                fill
                                className="object-cover"
                                sizes="100vw"
                                priority={index < 2} // İlk 2 resim LCP için öncelikli
                                loading={index < 2 ? undefined : "lazy"}
                            />
                        </div>
                    ))
                ) : (
                    <div className="p-20 text-center text-gray-500">
                        <p>Bu bölüme henüz görsel yüklenmemiş.</p>
                    </div>
                )}
            </div>

            {/* 2. ÖNCEKİ - SERİ - SONRAKİ BUTONLARI (Alt Bölüm) */}
            <div className="max-w-4xl mx-auto bg-[#121212] px-4 md:px-0 mt-8 mb-8">
                <div className="flex items-center justify-between text-gray-400 font-medium text-sm md:text-base border-t border-b border-gray-800 py-4">

                    {/* Önceki Butonu */}
                    <button
                        onClick={() => episode.prev_episode_id && router.push(`/webtoon/${params.id}/bolum/${episode.prev_episode_id}`)}
                        disabled={!episode.prev_episode_id}
                        className={`flex items-center gap-2 hover:text-white transition ${!episode.prev_episode_id ? 'opacity-30 cursor-not-allowed' : ''}`}
                    >
                        <span>‹</span>
                        <span>Önceki</span>
                    </button>

                    {/* Seri Sayfasına Dön */}
                    <Link href={`/webtoon/${episode.webtoon_slug || params.id}`} className="hover:text-white transition border-l border-r border-gray-800 px-6 md:px-12">
                        Seri Sayfasına Dön
                    </Link>

                    {/* Sonraki Butonu */}
                    <button
                        onClick={() => episode.next_episode_id && router.push(`/webtoon/${params.id}/bolum/${episode.next_episode_id}`)}
                        disabled={!episode.next_episode_id}
                        className={`flex items-center gap-2 hover:text-white transition ${!episode.next_episode_id ? 'opacity-30 cursor-not-allowed' : ''}`}
                    >
                        <span>Sonraki</span>
                        <span>›</span>
                    </button>
                </div>
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
                className={`fixed bottom-0 left-0 w-full z-[999] transition-transform duration-300 ease-in-out ${showNavbar ? "translate-y-0" : "translate-y-full"
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
