import Link from "next/link";

const FeaturedSlider = ({ webtoon }) => {
  // Eğer veri henüz gelmediyse boş dön (Hata almamak için)
  if (!webtoon) return null;

  // --- RESİM MANTIĞI ---
  const BASE_URL = "http://127.0.0.1:8000"; // Backend adresin
  
  // Banner var mı kontrol et
  const hasBanner = Boolean(webtoon.banner_image);
  
  // Arka plan için doğru resmi seç
  const bgImage = hasBanner 
    ? `${BASE_URL}/${webtoon.banner_image}` 
    : `${BASE_URL}/${webtoon.cover_image}`;

  return (
    <div className="relative w-full h-[450px] md:h-[550px] rounded-2xl overflow-hidden group shadow-2xl border border-gray-800">
      
      {/* 1. ARKA PLAN KATMANI */}
      <div className="absolute inset-0 w-full h-full">
        {/* Resim */}
        <div 
          className={`w-full h-full bg-cover bg-center transition-transform duration-700 group-hover:scale-105 ${!hasBanner ? "blur-md scale-110 opacity-50" : ""}`}
          style={{ backgroundImage: `url('${bgImage}')` }}
        />
        {/* Eğer banner yoksa arkaya siyah perde çek ki çok parlak olmasın */}
        {!hasBanner && <div className="absolute inset-0 bg-black/60"></div>}
      </div>

      {/* 2. GÖLGE KATMANI (Gradient) - Yazıların okunması için */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#121212] via-[#121212]/40 to-transparent"></div>
      <div className="absolute inset-0 bg-gradient-to-r from-[#121212] via-transparent to-transparent"></div>

      {/* 3. İÇERİK KATMANI */}
      <div className="absolute bottom-0 left-0 w-full p-6 md:p-12 flex items-end gap-8 z-10">
        
        {/* SOL: Eğer Banner YOKSA, dikey kapağı burada poster gibi göster */}
        {!hasBanner && (
            <div className="hidden md:block flex-shrink-0 shadow-2xl shadow-black/50 rounded-lg overflow-hidden border border-gray-700 transform group-hover:-translate-y-2 transition duration-500">
                <img 
                    src={`${BASE_URL}/${webtoon.cover_image}`} 
                    alt={webtoon.title} 
                    className="w-40 h-60 object-cover"
                />
            </div>
        )}

        {/* SAĞ: Yazılar ve Butonlar */}
        <div className="flex flex-col gap-4 max-w-3xl">
            {/* Kategori Etiketi */}
            <span className="bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded w-fit uppercase tracking-wider shadow-lg shadow-blue-900/50">
                {webtoon.status === 'ongoing' ? 'Yeni Bölüm' : 'Tamamlandı'}
            </span>

            {/* Başlık */}
            <h2 className="text-4xl md:text-6xl font-black text-white leading-tight drop-shadow-lg tracking-tight">
                {webtoon.title}
            </h2>
            
            {/* Açıklama (Mobil için kısa, masaüstü için uzun) */}
            <p className="text-gray-300 line-clamp-3 md:text-lg text-sm drop-shadow-md font-medium max-w-xl">
                {webtoon.summary || "Bu serinin açıklaması henüz girilmemiş. Yine de okumaya değer bir macera seni bekliyor!"}
            </p>

            {/* İstatistikler */}
            <div className="flex items-center gap-4 text-gray-400 text-sm font-medium">
                <span className="flex items-center gap-1">👁️ {webtoon.view_count || 0} Okunma</span>
                <span className="w-1 h-1 bg-gray-500 rounded-full"></span>
                <span>🔥 Popüler</span>
            </div>

            {/* Butonlar */}
            <div className="flex flex-wrap gap-4 mt-2">
                <Link 
                    href={`/webtoon/${webtoon.id}`} 
                    className="bg-white text-black hover:bg-gray-200 px-8 py-3.5 rounded-full font-bold transition flex items-center gap-2"
                >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" /></svg>
                    Hemen Oku
                </Link>
                
                <button className="bg-white/10 hover:bg-white/20 backdrop-blur text-white border border-white/30 px-6 py-3.5 rounded-full font-bold transition flex items-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
                    Listeme Ekle
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};

export default FeaturedSlider;