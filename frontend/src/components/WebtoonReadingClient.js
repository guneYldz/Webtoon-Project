"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import CommentSection from "@/components/CommentSection";
import Link from "next/link";
import Image from "next/image";
import { Lato } from "next/font/google";
import ReadingHero from "@/components/ReadingHero";
import { API } from "@/api";
import Breadcrumbs from "@/components/Breadcrumbs";
import RecommendedSeries from "@/components/RecommendedSeries";

const lato = Lato({ subsets: ["latin"], weight: ["400", "700"], display: "swap" });

// Props: params.id (seriesId) ve params.episodeId (episodeId)
export default function WebtoonReadingClient({ seriesId, episodeId, initialEpisode }) {
    const router = useRouter();

    const [episode, setEpisode] = useState(initialEpisode || null);
    const [allEpisodes, setAllEpisodes] = useState([]); // Tüm bölümleri tutacak state
    const [loading, setLoading] = useState(!initialEpisode);
    const [error, setError] = useState(null);

    const [showNavbar, setShowNavbar] = useState(true);
    const lastScrollY = useRef(0);

    // --- 1. KLAVYE İLE GEÇİŞ (EKSTRA ÖZELLİK) ---
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (!episode) return;
            if (e.key === 'ArrowLeft' && episode.prev_episode_id) {
                router.push(`/webtoon/${seriesId}/bolum/${episode.prev_episode_id}`);
            } else if (e.key === 'ArrowRight' && episode.next_episode_id) {
                router.push(`/webtoon/${seriesId}/bolum/${episode.next_episode_id}`);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [episode, router, seriesId]);

    // --- 2. VERİ ÇEKME (AKILLI SAYAÇLI) ---
    useEffect(() => {
        const fetchData = async () => {
            // API Adresi - CLIENT tarafında LOCALHOST kullan
            const apiUrl = API || "http://127.0.0.1:8000";

            // Eğer initialEpisode yoksa, client'ta da episode'u çek
            if (!initialEpisode && episodeId) {
                try {
                    setLoading(true);
                    setError(null);

                    const res = await fetch(`${apiUrl}/episodes/${episodeId}`, {
                        cache: "no-store",
                        credentials: "include"
                    });

                    if (!res.ok) throw new Error("Bölüm yüklenemedi.");
                    const data = await res.json();
                    setEpisode(data);
                } catch (err) {
                    console.error("Hata:", err);
                    setError("Bölüm bulunamadı veya yüklenirken hata oluştu.");
                    setLoading(false);
                    return;
                }
            }

            // Dropdown için tüm bölümleri çek (her durumda gerekli)
            if ((episode || initialEpisode) && seriesId) {
                try {
                    const webtoonRes = await fetch(`${apiUrl}/webtoons/${seriesId}`);
                    if (webtoonRes.ok) {
                        const webtoonData = await webtoonRes.json();
                        if (webtoonData.episodes) {
                            const sortedEpisodes = [...webtoonData.episodes].sort((a, b) => b.episode_number - a.episode_number);
                            setAllEpisodes(sortedEpisodes);
                        }
                    }
                } catch (err) {
                    console.error("Bölüm listesi çekilemedi:", err);
                }
            }

            setLoading(false);
        };

        fetchData();
    }, [episodeId, seriesId, initialEpisode]);

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
        <div className="min-h-screen bg-[#121212] flex items-center justify-center text-gray-400">
            <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                <p>Yükleniyor...</p>
            </div>
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

    return (
        <div className={`min-h-screen bg-[#121212] text-gray-200 pb-24 ${lato.className}`} style={{ paddingBottom: '64px' }}>

            {/* BREADCRUMBS (Sayfanın en tepesinde) */}
            <div className="container mx-auto px-4 mt-4" style={{ minHeight: '60px' }}>
                <Breadcrumbs items={[
                    { label: "Anasayfa", href: "/" },
                    { label: "Webtoonlar", href: "/seriler" },
                    { label: episode.webtoon_title, href: `/webtoon/${seriesId}` },
                    { label: `Bölüm ${episode.episode_number}`, href: null }
                ]} />
            </div>



            <ReadingHero
                title={`Bölüm ${episode.episode_number}`}
                seriesTitle={episode.webtoon_title}
                coverImage={episode.webtoon_cover}
                viewCount={episode.view_count}
                date={episode.created_at}
                slug={episode.webtoon_slug || seriesId}
                type="webtoon"
            />

            {/* --- YENİ: ÜST BÖLÜM SEÇİCİ --- */}
            <div className="max-w-4xl mx-auto bg-[#121212] px-4 md:px-0 mt-8 mb-8">
                <div className="flex justify-center">
                    <div className="relative w-full max-w-xs">
                        <select
                            className="w-full bg-[#1a1a1a] text-gray-300 border border-gray-800 rounded-lg px-4 py-3 appearance-none outline-none focus:border-blue-500 transition cursor-pointer"
                            onChange={(e) => router.push(`/webtoon/${seriesId}/bolum/${e.target.value}`)}
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
                        <img
                            key={index}
                            src={imgUrl.startsWith("http") ? imgUrl : `${API}/${imgUrl}`}
                            alt={`Sayfa ${index + 1}`}
                            width="800"
                            height="2000"
                            className="w-full h-auto block"
                            loading={index < 2 ? "eager" : "lazy"}
                        />
                    ))
                ) : (
                    <div className="p-20 text-center text-gray-500" style={{ minHeight: '600px' }}>
                        <p>Bu bölüme henüz görsel yüklenmemiş.</p>
                    </div>
                )}
            </div>

            {/* 2. ÖNCEKİ - SERİ - SONRAKİ BUTONLARI (Alt Bölüm) */}
            <div className="max-w-4xl mx-auto bg-[#121212] px-4 md:px-0 mt-8 mb-8">
                <div className="flex items-center justify-between text-gray-400 font-medium text-sm md:text-base border-t border-b border-gray-800 py-4">

                    {/* Önceki Butonu */}
                    <button
                        onClick={() => episode.prev_episode_id && router.push(`/webtoon/${seriesId}/bolum/${episode.prev_episode_id}`)}
                        disabled={!episode.prev_episode_id}
                        className={`flex items-center gap-2 hover:text-white transition ${!episode.prev_episode_id ? 'opacity-30 cursor-not-allowed' : ''}`}
                    >
                        <span>‹</span>
                        <span>Önceki</span>
                    </button>

                    {/* Seri Sayfasına Dön */}
                    <Link href={`/webtoon/${episode.webtoon_slug || seriesId}`} className="hover:text-white transition border-l border-r border-gray-800 px-6 md:px-12">
                        Seri Sayfasına Dön
                    </Link>

                    {/* Sonraki Butonu */}
                    <button
                        onClick={() => episode.next_episode_id && router.push(`/webtoon/${seriesId}/bolum/${episode.next_episode_id}`)}
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
                <RecommendedSeries type="webtoon" />

                <div className="mt-12">
                    <CommentSection
                        type="webtoon"
                        itemId={episode.webtoon_id}
                        episodeId={episode.id}
                    />
                </div>
            </div>

            {/* Alt Sabit Bar */}
            <div
                className={`fixed bottom-0 left-0 w-full z-[999] transition-transform duration-300 ease-in-out ${showNavbar ? "translate-y-0" : "translate-y-full"
                    }`}
            >
                <div className="flex justify-center w-full">
                    <div className="w-full max-w-4xl bg-[#121212]/95 backdrop-blur-xl border-t border-blue-500/20 shadow-[0_-10px_40px_-10px_rgba(0,0,0,0.8)] flex justify-between items-center text-white h-16 px-6">

                        <Link href={`/webtoon/${episode.webtoon_slug || seriesId}`} className="text-gray-400 hover:text-blue-400 font-medium flex items-center gap-2 transition group">
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
                                onClick={() => episode.prev_episode_id && router.push(`/webtoon/${seriesId}/bolum/${episode.prev_episode_id}`)}
                                disabled={!episode.prev_episode_id}
                                className="px-3 py-1.5 rounded-lg bg-[#1a1a1a] border border-white/10 text-xs font-bold disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-800 hover:text-blue-400 transition"
                            >
                                Önceki
                            </button>
                            <button
                                onClick={() => episode.next_episode_id && router.push(`/webtoon/${seriesId}/bolum/${episode.next_episode_id}`)}
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
