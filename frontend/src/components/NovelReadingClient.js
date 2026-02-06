"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation"; // useParams'ı props olarak alacağız
import CommentSection from "@/components/CommentSection";
import Link from "next/link";
import Image from "next/image";
import { Crimson_Pro, Cinzel, Lato } from "next/font/google";
import { API } from "@/api";
import Breadcrumbs from "@/components/Breadcrumbs";
import RecommendedSeries from "@/components/RecommendedSeries";

const crimson = Crimson_Pro({ subsets: ["latin"], weight: ["400", "600"], display: "swap" });
const cinzel = Cinzel({ subsets: ["latin"], weight: ["700", "900"], display: "swap" });
const lato = Lato({ subsets: ["latin"], weight: ["400", "700"], display: "swap" });

// Props olarak slug ve chapterNumber'ı yukarıdan alıyoruz
export default function NovelReadingClient({ slug, chapterNumber }) {
    const router = useRouter();

    const [chapter, setChapter] = useState(null);
    const [allChapters, setAllChapters] = useState([]); // Tüm bölümleri tutacak state
    const [loading, setLoading] = useState(true);
    const [showNavbar, setShowNavbar] = useState(true);
    const lastScrollY = useRef(0);

    useEffect(() => {
        loadChapter();
    }, [slug, chapterNumber]);

    useEffect(() => {
        const handleScroll = () => {
            const currentScrollY = window.scrollY;
            if (currentScrollY > lastScrollY.current && currentScrollY > 50) {
                setShowNavbar(false);
            } else {
                setShowNavbar(true);
            }
            lastScrollY.current = currentScrollY;
        };
        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    const loadChapter = async () => {
        try {
            setLoading(true);
            // Client tarafında fetch (Cookie ve Sayaç için önemli)
            const res = await fetch(`${API}/novels/${slug}/chapters/${chapterNumber}`, {
                cache: "no-store",
                credentials: "include"
            });

            if (!res.ok) throw new Error("Bölüm yüklenemedi");

            const data = await res.json();
            setChapter(data);

            // --- EK: TÜM BÖLÜMLERİ ÇEK (Dropdown İçin) ---
            // Novel ID veya Slug üzerinden ana veriyi çekip bölümleri alıyoruz.
            if (slug) {
                try {
                    // Novel detay endpoint'inden tüm bölümleri alabiliriz
                    const novelRes = await fetch(`${API}/novels/${slug}`);
                    if (novelRes.ok) {
                        const novelData = await novelRes.json();
                        if (novelData.chapters) {
                            // Bölümleri numarasına göre sırala (Büyükten küçüğe veya Küçükten büyüğe - Genelde okuma sırası küçükten büyüğe ama listede bulmak için)
                            // Dropdown için genelde Küçükten Büyüğe (1, 2, 3...) daha mantıklıdır ama en yeniyi görmek için tersi de olabilir. 
                            // Kullanıcı "ilk 10 tane görünsün" dedi, standart sıralama yapalım.
                            const sortedChapters = [...novelData.chapters].sort((a, b) => a.chapter_number - b.chapter_number);
                            setAllChapters(sortedChapters);
                        }
                    }
                } catch (novelErr) {
                    console.error("Novel detay hatası:", novelErr);
                }
            }

            window.scrollTo(0, 0);
        } catch (err) {
            console.error("Hata:", err);
        } finally {
            setLoading(false);
        }
    };

    const formatContent = (text) => {
        if (!text) return null;
        return text.split('\n').map((para, index) => {
            if (!para.trim()) return <br key={index} className="mb-4" />;
            return (
                <p key={index} className="mb-8 indent-8 text-justify leading-loose">
                    {para}
                </p>
            );
        });
    };

    const formatDate = (dateString) => {
        if (!dateString) return "Tarih Yok";
        try {
            return new Date(dateString).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
        } catch (e) { return "Tarih Hatalı"; }
    };

    if (loading) return <div className="min-h-screen bg-[#121212] flex items-center justify-center text-purple-500 font-bold animate-pulse text-xl tracking-widest">YÜKLENİYOR...</div>;
    if (!chapter) return <div className="min-h-screen bg-[#121212] text-white flex justify-center items-center">Bölüm Bulunamadı</div>;

    return (
        <div className={`min-h-screen bg-[#121212] font-sans text-gray-200 pb-40 overflow-x-hidden`}>
            {/* 1. ÜST KAPAK ALANI */}
            <div className="relative bg-[#1a1a1a] text-white shadow-2xl border-b border-gray-800 mb-12">
                <div className="absolute inset-0 bg-cover bg-center opacity-30 blur-[50px] scale-110" style={{ backgroundImage: chapter.novel_cover ? `url(${API}/${chapter.novel_cover})` : 'none', backgroundColor: '#2d1b4e' }}></div>
                <div className="absolute inset-0 bg-gradient-to-t from-[#121212] via-[#121212]/60 to-transparent"></div>
                <div className="relative container mx-auto max-w-6xl px-6 py-16 flex flex-col items-center gap-8 z-10 text-center">

                    {/* Breadcrumbs En Üstte */}
                    <div className="absolute top-4 left-4 sm:left-8 z-20">
                        <Breadcrumbs items={[
                            { label: "Anasayfa", href: "/" },
                            { label: "Romanlar", href: "/seriler" },
                            { label: chapter.novel_title, href: `/novel/${slug}` },
                            { label: `Bölüm ${chapter.chapter_number}`, href: null }
                        ]} />
                    </div>

                    {chapter.novel_cover && (
                        <div className="w-40 md:w-48 flex-shrink-0 rounded-lg overflow-hidden border border-gray-600/50 shadow-2xl transform hover:scale-105 transition-transform duration-500 relative aspect-[2/3]">
                            <Image
                                src={`${API}/${chapter.novel_cover}`}
                                alt={chapter.novel_title}
                                fill
                                unoptimized={true}
                                sizes="(max-width: 768px) 160px, 192px"
                                className="object-cover"
                                priority
                            />
                        </div>
                    )}
                    <div className="flex-1 pb-2">
                        <Link href={`/novel/${slug}`} className="inline-block mb-4 px-4 py-1.5 rounded-full bg-purple-600/20 border border-purple-500/30 text-purple-300 text-xs font-bold tracking-widest uppercase hover:bg-purple-600 hover:text-white transition">
                            {chapter.novel_title || "Roman Serisi"}
                        </Link>
                        <h1 className={`${cinzel.className} text-3xl md:text-5xl lg:text-6xl font-black text-white drop-shadow-2xl leading-tight mb-4`}>
                            {chapter.title}
                        </h1>
                        <div className="flex flex-wrap items-center justify-center gap-4 text-gray-400 text-sm font-medium">
                            <span className="bg-[#121212]/80 px-3 py-1 rounded border border-gray-700">Bölüm #{chapter.chapter_number}</span>
                            <span className="flex items-center gap-1">📅 {formatDate(chapter.created_at)}</span>
                            <span className="flex items-center gap-1 text-purple-400 bg-purple-900/20 px-2 py-1 rounded">👁️ {chapter.view_count || 0}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* 2. OKUMA ALANI */}
            <main className="container mx-auto max-w-4xl px-4 md:px-8 relative z-10">

                {/* --- YENİ: ÜST BÖLÜM SEÇİCİ --- */}
                <div className="flex justify-center mb-8">
                    <div className="relative w-full max-w-xs">
                        <select
                            className="w-full bg-[#1a1a1a] text-gray-300 border border-gray-700 rounded-lg px-4 py-3 appearance-none outline-none focus:border-purple-500 transition cursor-pointer font-sans"
                            onChange={(e) => router.push(`/novel/${slug}/bolum/${e.target.value}`)}
                            value={chapter.chapter_number} // Value chapter_number olarak ayarlandı
                        >
                            <option value="" disabled>Bölüm Seçin</option>
                            {allChapters.map((chap) => (
                                <option key={chap.id} value={chap.chapter_number}>
                                    Bölüm {chap.chapter_number}
                                </option>
                            ))}
                        </select>
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">
                            ▼
                        </div>
                    </div>
                </div>

                <div className="flex justify-center mb-10 opacity-40 text-purple-500 text-2xl">❖</div>
                <article className={`${crimson.className} text-[#e5e5e5] text-xl md:text-2xl`}>
                    {formatContent(chapter.content)}
                </article>
                <div className="flex justify-center mt-12 opacity-40 text-purple-500 text-2xl">❖</div>

                {/* --- YENİ: ALT NAVİGASYON --- */}
                <div className="flex items-center justify-between text-gray-400 font-medium text-sm md:text-base border-t border-b border-gray-800 py-6 mt-12 font-sans">

                    <button
                        onClick={() => chapter.prev_chapter && router.push(`/novel/${slug}/bolum/${chapter.prev_chapter}`)}
                        disabled={!chapter.prev_chapter}
                        className={`flex items-center gap-2 hover:text-white transition ${!chapter.prev_chapter ? 'opacity-30 cursor-not-allowed' : ''}`}
                    >
                        <span>‹</span>
                        <span>Önceki</span>
                    </button>

                    <Link href={`/novel/${slug}`} className="hover:text-white transition border-l border-r border-gray-800 px-6 md:px-12 text-center">
                        Seri Sayfasına Dön
                    </Link>

                    <button
                        onClick={() => chapter.next_chapter && router.push(`/novel/${slug}/bolum/${chapter.next_chapter}`)}
                        disabled={!chapter.next_chapter}
                        className={`flex items-center gap-2 hover:text-white transition ${!chapter.next_chapter ? 'opacity-30 cursor-not-allowed' : ''}`}
                    >
                        <span>Sonraki</span>
                        <span>›</span>
                    </button>
                </div>

            </main>

            {/* 3. YORUM VE ÖNERİ ALANI */}
            <div className={`mt-16 max-w-4xl mx-auto ${lato.className} px-4`}>
                <RecommendedSeries type="novel" />

                <div className="border-t border-gray-800 pt-12">
                    <CommentSection type="novel" itemId={chapter.novel_id} chapterId={chapter.id} />
                </div>
            </div>

            {/* 4. SABİT ALT BAR */}
            <div className={`fixed bottom-0 left-0 w-full z-[999] transition-transform duration-300 ease-in-out ${showNavbar ? "translate-y-0" : "translate-y-full"}`}>
                <div className="flex justify-center w-full">
                    <div className="w-full max-w-4xl bg-[#121212]/95 backdrop-blur-xl border-t border-purple-500/20 shadow-[0_-10px_40px_-10px_rgba(0,0,0,0.8)] flex justify-between items-center text-white h-16 px-6">
                        <Link href={`/novel/${slug}`} className="text-gray-400 hover:text-purple-400 font-medium flex items-center gap-2 transition group">
                            <span className="text-xl group-hover:-translate-x-1 transition">←</span>
                            <span className={`hidden sm:inline ${lato.className} text-xs font-bold tracking-widest uppercase`}>Seri</span>
                        </Link>
                        <div className="flex flex-col items-center justify-center px-4">
                            <h2 className={`text-xs font-bold text-gray-200 max-w-[120px] sm:max-w-xs truncate text-center ${lato.className} tracking-wide`}>{chapter.title}</h2>
                            <span className="text-[10px] text-purple-500 font-black tracking-widest">#{chapter.chapter_number}</span>
                        </div>
                        <div className={`flex gap-3 ${lato.className}`}>
                            <button onClick={() => chapter.prev_chapter && router.push(`/novel/${slug}/bolum/${chapter.prev_chapter}`)} disabled={!chapter.prev_chapter} className="px-3 py-1.5 rounded-lg bg-[#1a1a1a] border border-white/10 text-xs font-bold disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-800 hover:text-purple-400 transition">Önceki</button>
                            <button onClick={() => chapter.next_chapter && router.push(`/novel/${slug}/bolum/${chapter.next_chapter}`)} disabled={!chapter.next_chapter} className="px-3 py-1.5 rounded-lg bg-purple-600 border border-purple-500 text-xs font-bold text-white disabled:opacity-30 disabled:cursor-not-allowed hover:bg-purple-500 transition shadow-lg">Sonraki</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
