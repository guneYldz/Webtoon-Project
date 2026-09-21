"use client";
import Link from "next/link";
import { API } from "@/api";

export default function ReadingHero({
    title,
    seriesTitle,
    coverImage,
    viewCount,
    commentCount,
    date,
    slug,
    type = "webtoon"
}) {
    const linkPath = type === "webtoon" ? "webtoon" : "novel";
    const listLabel = type === "webtoon" ? "Webtoonlar" : "Romanlar";

    const finalImage = !coverImage
        ? null
        : coverImage.startsWith("http")
            ? coverImage
            : `${API}/${coverImage}`;

    return (
        <div className="relative w-full overflow-hidden bg-[#121212] mb-6">
            {finalImage && (
                <div
                    className="absolute inset-0 bg-cover bg-center opacity-40 blur-[50px] scale-110"
                    style={{ backgroundImage: `url(${finalImage})` }}
                />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-[#121212] via-[#121212]/70 to-[#121212]/20" />

            <div className="relative container mx-auto px-4 z-10 flex flex-col items-center text-center gap-6 py-10 md:py-14">
                <nav className="text-sm text-gray-400 font-bold uppercase tracking-widest flex gap-2 items-center justify-center flex-wrap">
                    <Link href="/" className="hover:text-white transition">Anasayfa</Link>
                    <span className="text-gray-600">/</span>
                    <Link href="/seriler" className="hover:text-white transition">{listLabel}</Link>
                    <span className="text-gray-600">/</span>
                    <Link href={`/${linkPath}/${slug}`} className="hover:text-blue-400 transition">
                        {seriesTitle}
                    </Link>
                    <span className="text-gray-600">/</span>
                    <span className="text-blue-500">{title}</span>
                </nav>

                {finalImage && (
                    <div className="relative w-32 md:w-48 aspect-[2/3] rounded-lg overflow-hidden shadow-2xl border border-white/10 bg-gray-800">
                        <img
                            src={finalImage}
                            alt={seriesTitle}
                            width="192"
                            height="288"
                            loading="eager"
                            className="w-full h-full object-cover"
                        />
                    </div>
                )}

                <div className="flex flex-col gap-2">
                    <h2 className="text-lg md:text-xl font-bold text-gray-400 tracking-tight">
                        {seriesTitle}
                    </h2>
                    <h1 className="text-3xl md:text-5xl font-black text-white drop-shadow-2xl tracking-tight">
                        {title} <span className="text-gray-500 font-light">OKU</span>
                    </h1>
                </div>

                <div className="flex items-center justify-center gap-6 text-sm text-gray-400 font-mono bg-[#1a1a1a]/80 px-6 py-2 rounded-full border border-gray-800 shadow-lg">
                    {date && (
                        <span className="flex items-center gap-2">
                            📅 {new Date(date).toLocaleDateString("tr-TR")}
                        </span>
                    )}
                    <span className="flex items-center gap-2">
                        👁️ {viewCount || 0}
                    </span>
                    {commentCount != null && (
                        <span className="flex items-center gap-2">
                            💬 {commentCount}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}
