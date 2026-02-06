"use client";
import Link from "next/link";
import { API } from "@/api";

export default function ReadingHero({
    title,
    seriesTitle,
    coverImage,
    author,
    viewCount,
    commentCount,
    date,
    slug,
    type = "webtoon"
}) {

    const linkPath = type === "webtoon" ? "webtoon" : "novel";

    // 👇 RESİM URL KONTROLÜ (DÜZELTİLEN KISIM)
    // Eğer resim linki 'http' ile başlıyorsa (Backend tam link gönderdiyse) olduğu gibi al.
    // Yoksa başına API adresini ekle.
    const finalImage = coverImage?.startsWith("http")
        ? coverImage
        : `${API}/${coverImage}`;

    return (
        <div className="relative w-full py-12 md:py-20 overflow-hidden bg-[#121212]">

            {/* Arkadaki ışık efekti */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] bg-blue-900/10 blur-[120px] rounded-full pointer-events-none"></div>

            <div className="relative container mx-auto px-4 z-10 flex flex-col items-center text-center gap-6">

                {/* Navigasyon - DARK MODE İÇİN DÜZELTİLDİ */}
                <div className="w-full bg-[#121212] py-2 px-4">
                    <nav className="text-[10px] md:text-xs text-gray-500 font-bold uppercase tracking-widest flex gap-2 items-center justify-center">
                        <Link href="/" className="hover:text-white transition">Anasayfa</Link>
                        <span>/</span>
                        <Link href={`/${linkPath}/${slug}`} className="hover:text-blue-400 transition text-gray-400">
                            {seriesTitle}
                        </Link>
                        <span>/</span>
                        <span className="text-blue-500">{title}</span>
                    </nav>
                </div>

                {/* Kapak Resmi */}
                {coverImage && (
                    <div className="relative group">
                        <div className="absolute -inset-4 bg-blue-600/10 rounded-full blur-xl opacity-0 group-hover:opacity-100 transition duration-700"></div>
                        <div className="relative w-32 md:w-48 aspect-[2/3] rounded-lg overflow-hidden shadow-2xl border border-gray-700 group-hover:border-gray-500 transition-colors">
                            <img
                                src={finalImage}
                                alt={seriesTitle}
                                className="w-full h-full object-cover"
                            />
                        </div>
                    </div>
                )}

                {/* Başlıklar */}
                <div className="flex flex-col gap-2 mt-2">
                    <h2 className="text-lg md:text-xl font-bold text-gray-500 tracking-tight">
                        {seriesTitle}
                    </h2>
                    <h1 className="text-3xl md:text-5xl font-black text-white drop-shadow-2xl tracking-tight">
                        {title} <span className="text-gray-600 font-light">OKU</span>
                    </h1>
                </div>

                {/* İstatistikler */}
                <div className="flex items-center justify-center gap-6 text-[10px] md:text-xs text-gray-400 font-mono bg-[#1a1a1a] px-6 py-2 rounded-full border border-gray-800 shadow-lg mt-2">
                    {date && (
                        <span className="flex items-center gap-2 hover:text-white transition">
                            📅 {new Date(date).toLocaleDateString('tr-TR')}
                        </span>
                    )}
                    <span className="flex items-center gap-2 hover:text-white transition">
                        👁️ {viewCount || 0}
                    </span>
                    <span className="flex items-center gap-2 hover:text-white transition">
                        💬 {commentCount || 0}
                    </span>
                </div>

            </div>
        </div>
    );
}