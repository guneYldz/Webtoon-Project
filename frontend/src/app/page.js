import Link from "next/link";
import Image from "next/image";
import HomeSlider from "@/components/HomeSlider";

// Force dynamic rendering to avoid build-time fetch errors
export const dynamic = 'force-dynamic';
import { API } from "@/api";

// Server-side fetching için URL (Docker içinden backend'e erişim)
const SERVER_API = "http://backend:8000";

async function getData() {
  try {
    // Docker ortamında backend servisine istek atıyoruz
    // Eğer localde çalışıyorsanız ve başarısız olursa localhost deneriz (fallback)
    let webtoonRes, novelRes;

    try {
      [webtoonRes, novelRes] = await Promise.all([
        fetch(`${SERVER_API}/webtoons/`, { cache: 'no-store' }), // Güncel veri için no-store
        fetch(`${SERVER_API}/novels/`, { cache: 'no-store' })
      ]);
    } catch (error) {
      console.log("Docker backend erişimi başarısız, localhost deneniyor...");
      // Fallback to localhost if backend service is not found (e.g. running locally without docker-compose)
      [webtoonRes, novelRes] = await Promise.all([
        fetch(`https://kaosmanga.net/api/webtoons/`, { cache: 'no-store' }),
        fetch(`https://kaosmanga.net/api/novels/`, { cache: 'no-store' })
      ]);
    }

    if (!webtoonRes.ok || !novelRes.ok) {
      throw new Error("API hatasi");
    }

    const webtoonData = await webtoonRes.json();
    const novelData = await novelRes.json();

    // Verileri işle
    const formattedWebtoons = webtoonData.map(item => ({
      ...item,
      typeLabel: "WEBTOON",
      linkPath: "webtoon",
      latestChapters: item.episodes ? [...item.episodes].sort((a, b) => b.episode_number - a.episode_number).slice(0, 2) : []
    }));

    const formattedNovels = novelData.map(item => ({
      ...item,
      typeLabel: "NOVEL",
      linkPath: "novel",
      latestChapters: item.chapters ? [...item.chapters].sort((a, b) => b.chapter_number - a.chapter_number).slice(0, 2) : []
    }));

    const combinedData = [...formattedWebtoons, ...formattedNovels];

    // Sıralama (Güncellenme tarihine göre)
    combinedData.sort((a, b) => {
      const dateA = new Date(a.updated_at || a.created_at);
      const dateB = new Date(b.updated_at || b.created_at);
      return dateB - dateA;
    });

    // Vitrin (Slider) verisi (HomeSlider artık prop alıyor, ama biz yine de tüm veriyi gönderelim, o filtrelesin veya direk vitrin endpointinden çekelim)
    // HomeSlider.js mantığı değişti, Vitrin endpointini burada çekip ona yollamalıyız.
    // Ancak optimize olsun diye direk vitrin endpointini de çekelim.
    let vitrinData = [];
    try {
      const vitrinRes = await fetch(`${SERVER_API}/vitrin`, { cache: 'no-store' }).catch(() => fetch(`https://kaosmanga.net/api/vitrin`, { cache: 'no-store' }));
      if (vitrinRes.ok) {
        vitrinData = await vitrinRes.json();
      }
    } catch (e) { console.error("Vitrin fetch error", e); }


    // Trend Listesi (Görüntülenmeye göre)
    const popularList = [...combinedData].sort((a, b) => (b.view_count || 0) - (a.view_count || 0)).slice(0, 10);

    return { allSeries: combinedData, popularList, vitrinData };

  } catch (err) {
    console.error("Veri çekme hatası:", err);
    return { allSeries: [], popularList: [], vitrinData: [] };
  }
}

export const metadata = {
  title: "Kaos Manga | Ana Sayfa",
  description:
    "Kaos Manga'ya hoş geldin! En yeni Webtoon ve Novelleri Türkçe ve ücretsiz oku. Trend seriler, popüler romanlar ve sürekli güncellenen bölümlerle dolu platformumuzu keşfet.",
  alternates: {
    canonical: "https://kaosmanga.net",
  },
  openGraph: {
    title: "Kaos Manga | Ana Sayfa",
    description:
      "Kaos Manga'ya hoş geldin! En yeni Webtoon ve Novelleri Türkçe ve ücretsiz oku. Trend seriler, popüler romanlar ve sürekli güncellenen bölümlerle dolu platformumuzu keşfet.",
    url: "https://kaosmanga.net",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Kaos Manga - Webtoon ve Novel Platformu",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Kaos Manga | Ana Sayfa",
    description:
      "Kaos Manga'ya hoş geldin! En yeni Webtoon ve Novelleri Türkçe ve ücretsiz oku. Trend seriler ve popüler romanlar seni bekliyor.",
    images: ["/og-image.png"],
  },
};

export default async function Home() {
  const { allSeries, popularList, vitrinData } = await getData();

  return (
    <div className="min-h-screen font-sans bg-[#121212] pb-20">
      {/* SEO H1 - Hidden from view but accessible to search engines */}
      <h1 className="sr-only">Kaos Manga - En İyi Webtoon ve Novelleri Türkçe Oku</h1>

      <div className="container mx-auto max-w-7xl px-4 py-8">

        {/* HERO VİTRİN - Slider Bileşeni */}
        <div className="mb-12">
          <HomeSlider slides={vitrinData} />
        </div>

        <div className="flex flex-col lg:flex-row gap-10 items-start">

          {/* SOL: ANA İÇERİK AKIŞI */}
          <div className="flex-1 w-full">
            <section>
              <div className="flex justify-between items-end mb-8 border-b border-gray-800 pb-3">
                <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                  <span className="w-2 h-8 bg-gradient-to-b from-blue-600 to-purple-600 rounded-full inline-block"></span>
                  Son Güncellenenler
                </h2>
                <Link href="/seriler" title="Tüm Webtoon ve Novel Serilerini Gör" className="text-sm font-medium text-gray-500 hover:text-white transition">Tümünü Gör →</Link>
              </div>

              {/* KART GRİD YAPISI */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-5 gap-y-10">
                {allSeries.map((item) => (
                  <div key={`${item.typeLabel}-${item.id}`} className="group flex flex-col gap-3">

                    {/* Kapak Görseli */}
                    <div className="relative aspect-[2/3] rounded-xl overflow-hidden border border-gray-800 shadow-lg group-hover:border-gray-600 transition-all duration-300">
                      <Link href={`/${item.linkPath}/${item.slug || item.id}`} title={item.title || 'Seri'} className="relative block w-full h-full">
                        <Image
                          src={item.cover_image ? `${API}/${item.cover_image}` : '/placeholder.jpg'}
                          alt={item.title || 'İsimsiz'}
                          fill
                          className="object-cover transition duration-500 group-hover:scale-110"
                          sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 25vw"
                          unoptimized={true} // Docker network safe
                        />
                      </Link>

                      {/* Tür Etiketi */}
                      <div className="absolute top-2 left-2 z-10">
                        <span className={`text-sm font-black px-2 py-0.5 rounded shadow-lg text-white border border-white/10 ${item.typeLabel === 'WEBTOON' ? 'bg-blue-600' : 'bg-purple-600'
                          }`}>
                          {item.typeLabel}
                        </span>
                      </div>

                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60 group-hover:opacity-40 transition-opacity pointer-events-none z-0"></div>
                    </div>

                    {/* Bilgiler ve Son Bölümler */}
                    <div className="px-1 flex flex-col gap-2">
                      {/* Başlık */}
                      <Link href={`/${item.linkPath}/${item.slug || item.id}`} title={item.title || 'Seri'}>
                        <h3 className="font-bold text-sm text-gray-100 truncate group-hover:text-blue-400 transition duration-200">
                          {item.title}
                        </h3>
                      </Link>

                      {/* SON 2 BÖLÜM */}
                      <div className="flex flex-col gap-1.5 mt-1">
                        {item.latestChapters && item.latestChapters.length > 0 ? (
                          item.latestChapters.map((chap, idx) => (
                            <Link
                              key={idx}
                              href={`/${item.linkPath}/${item.slug || item.id}/bolum/${chap.id}`}
                              title={`${item.title} - ${item.typeLabel === 'NOVEL' ? 'Bölüm' : 'Bölüm'} ${chap.chapter_number || chap.episode_number}`}
                              className="flex items-center justify-between text-sm bg-[#1a1a1a] hover:bg-[#252525] border border-gray-800 rounded px-2 py-1.5 transition text-gray-300 hover:text-white hover:border-gray-600"
                            >
                              <span>
                                {item.typeLabel === 'NOVEL' ? 'Bölüm' : '#'} {chap.chapter_number || chap.episode_number}
                              </span>
                              <span className="text-sm text-gray-500">
                                Yeni
                              </span>
                            </Link>
                          ))
                        ) : (
                          <span className="text-sm text-gray-600 italic">Henüz bölüm yok</span>
                        )}
                      </div>

                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* SAĞ: SIDEBAR (POPÜLER) */}
          <div className="w-full lg:w-80 flex-shrink-0">
            <div className="bg-[#1a1a1a] rounded-2xl border border-gray-800 p-6 sticky top-24 shadow-2xl z-10">
              <h3 className="text-lg font-bold text-white mb-8 flex items-center gap-2">
                <span className="text-yellow-500">🔥</span> Trend Listesi
              </h3>
              <div className="flex flex-col gap-6">
                {popularList.map((w, index) => (
                  <Link key={`${w.typeLabel}-${w.id}`} href={`/${w.linkPath}/${w.slug || w.id}`} title={w.title || 'Seri'} className="flex gap-4 group items-center">
                    <div className={`text-4xl font-black italic w-10 flex-shrink-0 text-center ${index < 3 ? 'text-transparent bg-clip-text bg-gradient-to-b from-blue-400 to-purple-600' : 'text-gray-800'}`}>
                      {index + 1}
                    </div>
                    <div className="w-12 h-16 rounded-lg overflow-hidden flex-shrink-0 border border-gray-800 group-hover:border-blue-500 transition-colors relative">
                      {/* CSS img yerine Next Image */}
                      <Image
                        src={`${API}/${w.cover_image}`}
                        alt={w.title}
                        fill
                        className="object-cover"
                        unoptimized={true}
                      />
                    </div>
                    <div className="flex flex-col justify-center min-w-0">
                      <h4 className="text-sm font-bold text-gray-200 group-hover:text-blue-400 transition truncate leading-tight">
                        {w.title}
                      </h4>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-sm uppercase font-bold tracking-tighter ${w.typeLabel === 'WEBTOON' ? 'text-blue-500' : 'text-purple-500'}`}>
                          {w.typeLabel}
                        </span>
                        <span className="text-sm text-gray-600">👁️ {w.view_count || 0}</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>

        </div>
      </div >
    </div >
  );
}