import Link from "next/link";
import { API } from "@/api";
import FavoriteButton from "./FavoriteButton";
import Image from "next/image"; // Image import

const FeaturedSlider = ({ webtoon }) => {
  if (!webtoon) return null;

  // --- 1. TÜR VE ROTA BELİRLEME ---
  // Backend'den gelen veriye göre Roman mı Webtoon mu karar verelim.
  // Hem 'type' parametresine hem de 'typeLabel'a bakıyoruz, garanti olsun.
  const isNovel = webtoon.type === 'novel' || (webtoon.typeLabel && webtoon.typeLabel.toUpperCase() === 'NOVEL');

  const routeType = isNovel ? 'novel' : 'webtoon';
  const labelText = isNovel ? 'NOVEL' : 'WEBTOON';

  // --- 2. RENK AYARLARI ---
  // Roman için Mor, Webtoon için Mavi tema
  const badgeClass = isNovel
    ? "bg-purple-600 shadow-purple-900/50"
    : "bg-blue-600 shadow-blue-900/50";

  // --- 3. RESİM MANTIĞI (GÜÇLENDİRİLMİŞ) ---
  // Banner null ise, boş string ise veya uzantısı yoksa Cover kullan
  const validBanner = webtoon.banner_image && webtoon.banner_image.length > 5 && webtoon.banner_image.includes(".");

  const bgImage = validBanner
    ? `${API}/${webtoon.banner_image}`
    : `${API}/${webtoon.cover_image}`;

  return (
    <div className="relative w-full h-[450px] md:h-[550px] rounded-2xl overflow-hidden group shadow-2xl border border-gray-800 bg-[#121212]">

      {/* 1. ARKA PLAN */}
      <div className="absolute inset-0 w-full h-full overflow-hidden">
        <div
          className={`relative w-full h-full transition-transform duration-700 group-hover:scale-105 
            ${!validBanner ? "blur-xl scale-110 opacity-40" : "opacity-80"}
          `}
        >
          <Image
            src={bgImage}
            alt={webtoon.title + " Banner"}
            fill
            className="object-cover object-center"
            priority={true} // Slider'ın ilk resmi olduğu için öncelikli yükle
            unoptimized={true} // Docker/Localhost sorunları yaşamamak için (Gerekirse kaldırılabilir)
          />
        </div>
        {/* Arka planı biraz karart ki yazılar okunsun */}
        <div className="absolute inset-0 bg-black/40 z-0"></div>
      </div>

      {/* 2. GÖLGELER (Okunabilirlik İçin) */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#121212] via-[#121212]/60 to-transparent z-0"></div>
      <div className="absolute inset-0 bg-gradient-to-r from-[#121212] via-[#121212]/30 to-transparent z-0"></div>

      {/* 3. İÇERİK */}
      <div className="absolute bottom-0 left-0 w-full p-6 md:p-12 flex items-end gap-8 z-10">

        {/* SOL POSTER (Sadece Banner YOKSA gösterelim, boşluk dolusu) */}
        {!validBanner && (
          <div className="hidden md:block flex-shrink-0 shadow-2xl shadow-black/50 rounded-lg overflow-hidden border border-gray-700 transform group-hover:-translate-y-2 transition duration-500 relative w-40 h-60">
            <Image
              src={`${API}/${webtoon.cover_image}`}
              alt={webtoon.title}
              fill
              className="object-cover"
            />
          </div>
        )}

        <div className="flex flex-col gap-4 max-w-3xl">
          {/* ETİKET (Dinamik Renk) */}
          <span className={`text-white text-xs font-bold px-3 py-1 rounded w-fit uppercase tracking-wider shadow-lg ${badgeClass}`}>
            {labelText}
          </span>

          {/* BAŞLIK */}
          <h2 className="text-4xl md:text-6xl font-black text-white leading-tight drop-shadow-lg tracking-tight line-clamp-2">
            {webtoon.title}
          </h2>

          {/* AÇIKLAMA */}
          <p className="text-gray-300 line-clamp-2 md:line-clamp-3 md:text-lg text-sm drop-shadow-md font-medium max-w-xl">
            {webtoon.summary || "Bu serinin açıklaması henüz girilmemiş."}
          </p>

          {/* İSTATİSTİKLER */}
          <div className="flex items-center gap-4 text-gray-400 text-sm font-medium">
            <span className="flex items-center gap-1">👁️ {webtoon.view_count || 0} Okunma</span>
            <span className="w-1 h-1 bg-gray-500 rounded-full"></span>
            <span className="text-orange-400 flex items-center gap-1">🔥 Popüler</span>
            <span className="w-1 h-1 bg-gray-500 rounded-full"></span>
            <span className="text-gray-300 capitalize">{webtoon.status === 'ongoing' ? 'Güncel' : 'Tamamlandı'}</span>
          </div>

          {/* BUTONLAR ALANI */}
          <div className="flex flex-wrap gap-4 mt-2 items-center">
            {/* OKUMA BUTONU (Dinamik Link) */}
            <Link
              href={`/${routeType}/${webtoon.slug || webtoon.id}`}
              className="bg-white text-black hover:bg-gray-200 px-8 py-3.5 rounded-full font-bold transition flex items-center gap-2 shadow-lg z-20 hover:scale-105 active:scale-95 duration-200"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" /></svg>
              Hemen Oku
            </Link>

            {/* FAVORİ BUTONU */}
            <FavoriteButton
              type={routeType} // 'novel' veya 'webtoon' gönderiyoruz
              id={webtoon.id}
              className="bg-white/10 hover:bg-white/20 text-white border border-white/30 hover:border-white backdrop-blur-md px-4 py-3.5 rounded-full transition z-20"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default FeaturedSlider;