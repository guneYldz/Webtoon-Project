"use client";
import Link from "next/link";

export default function WebtoonCard({ webtoon }) {
  if (!webtoon) return null;

  return (
    <div className="group flex flex-col gap-2">
      {/* --- KAPAK RESMİ ALANI --- */}
      <div className="relative aspect-[2/3] rounded-xl overflow-hidden border border-gray-800 shadow-lg group-hover:shadow-blue-900/40 group-hover:border-blue-500/50 transition duration-300">
        <Link href={`/webtoon/${webtoon.id}`}>
          <img 
            src={`http://127.0.0.1:8000/${webtoon.cover_image}`} 
            alt={webtoon.title} 
            className="w-full h-full object-cover transition duration-500 group-hover:scale-110"
            loading="lazy"
          />
        </Link>
        
        {/* Sol Üst Etiket (Durum) */}
        <div className="absolute top-2 left-2">
            <span className={`text-[9px] font-bold px-2 py-1 rounded text-white shadow-md backdrop-blur-md ${webtoon.status === 'ongoing' ? 'bg-blue-600/90' : 'bg-red-600/90'}`}>
              {webtoon.status === 'ongoing' ? 'DEVAM EDİYOR' : 'TAMAMLANDI'}
            </span>
        </div>

        {/* Hover Efekti (Karanlık Perde) */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors pointer-events-none"></div>
      </div>
      
      {/* --- ALT BİLGİ ALANI --- */}
      <div className="px-1">
        <Link href={`/webtoon/${webtoon.id}`}>
          <h3 className="font-bold text-sm text-gray-100 truncate group-hover:text-blue-400 transition">
            {webtoon.title}
          </h3>
        </Link>
        
        <div className="flex justify-between items-center mt-1">
            <span className="text-[10px] text-gray-500 uppercase tracking-wide font-medium">
                {webtoon.type || "MANGA"}
            </span>
            <span className="text-[10px] text-gray-500 flex items-center gap-1">
                👁️ {(webtoon.view_count || 0).toLocaleString()}
            </span>
        </div>
      </div>
    </div>
  );
}