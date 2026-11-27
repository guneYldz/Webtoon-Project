import HomeSlider from "@/components/HomeSlider";
import ContinueReadingRail from "@/components/ContinueReadingRail";
import LiveChatBox from "@/components/LiveChatBox";
import HomeClientFeed from "@/components/HomeClientFeed";
import { apiFetch } from "@/lib/apiClient";

export const revalidate = 60;

async function getData() {
  try {
    const fetchOpts = { next: { revalidate: 60 } };

    const [webtoonRes, novelRes] = await Promise.all([
      apiFetch("/webtoons/?limit=1000", fetchOpts),
      apiFetch("/novels/?limit=1000", fetchOpts),
    ]);

    if (!webtoonRes.ok || !novelRes.ok) {
      throw new Error("API hatasi");
    }

    const webtoonData = await webtoonRes.json();
    const novelData = await novelRes.json();

    const formattedWebtoons = (Array.isArray(webtoonData) ? webtoonData : []).map(
      (item) => ({
        ...item,
        typeLabel: String(item.type || "")
          .toUpperCase()
          .includes("MANGA")
          ? "MANGA"
          : "WEBTOON",
        linkPath: "webtoon",
        latestChapters: item.episodes
          ? [...item.episodes]
              .sort((a, b) => b.episode_number - a.episode_number)
              .slice(0, 2)
          : [],
      })
    );

    const formattedNovels = (Array.isArray(novelData) ? novelData : []).map(
      (item) => ({
        ...item,
        typeLabel: "NOVEL",
        linkPath: "novel",
        latestChapters: item.chapters
          ? [...item.chapters]
              .sort((a, b) => b.chapter_number - a.chapter_number)
              .slice(0, 2)
          : [],
      })
    );

    const combinedData = [...formattedWebtoons, ...formattedNovels];

    const getLastUpdate = (item) => {
      const chapterDates = (item.latestChapters || [])
        .map((c) => new Date(c.created_at || 0).getTime())
        .filter((t) => t > 0);
      if (chapterDates.length > 0) return Math.max(...chapterDates);
      return new Date(item.updated_at || item.created_at || 0).getTime() || 0;
    };

    combinedData.sort((a, b) => getLastUpdate(b) - getLastUpdate(a));

    let vitrinData = [];
    try {
      const vitrinRes = await apiFetch("/vitrin", fetchOpts);
      if (vitrinRes.ok) {
        vitrinData = await vitrinRes.json();
      }
    } catch (e) {
      console.error("Vitrin fetch error", e);
    }

    const popularList = [...combinedData]
      .sort((a, b) => (b.view_count || 0) - (a.view_count || 0))
      .slice(0, 10);

    return { allSeries: combinedData, popularList, vitrinData };
  } catch (err) {
    console.error("Veri çekme hatası:", err);
    return { allSeries: [], popularList: [], vitrinData: [] };
  }
}

const HOME_TITLE = "Kaos Manga | Türkçe Webtoon, Manga ve Novel Oku";
const HOME_DESCRIPTION =
  "Kaos Manga'da en yeni webtoon, manga ve novelleri Türkçe ve ücretsiz oku. Manhwa ve web novel arşivi her gün güncellenir. Hemen okumaya başla!";

export const metadata = {
  title: { absolute: HOME_TITLE },
  description: HOME_DESCRIPTION,
  alternates: {
    canonical: "https://kaosmanga.net",
  },
  openGraph: {
    title: HOME_TITLE,
    description: HOME_DESCRIPTION,
    url: "https://kaosmanga.net",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Kaos Manga - Webtoon, Manga ve Novel Platformu",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: HOME_TITLE,
    description: HOME_DESCRIPTION,
    images: ["/og-image.png"],
  },
};

export default async function Home() {
  const { allSeries, popularList, vitrinData } = await getData();

  return (
    <div className="pb-12 font-sans">
      <h1 className="sr-only">
        Kaos Manga - En İyi Webtoon, Manga ve Novelleri Türkçe Oku
      </h1>

      <div className="container mx-auto max-w-7xl px-4 sm:px-6 py-6 sm:py-8">
        {/* HERO SPOTLIGHT */}
        <div className="mb-10">
          <HomeSlider slides={vitrinData} />
        </div>

        {/* CONTINUE READING RAIL (Hydrated from localStorage) */}
        <ContinueReadingRail />

        {/* LIVE COMMUNITY CHAT */}
        <section aria-label="Canlı Sohbet" className="mb-10">
          <LiveChatBox />
        </section>

        {/* INTERACTIVE UPDATES & TRENDING FEED */}
        <HomeClientFeed allSeries={allSeries} popularList={popularList} />
      </div>
    </div>
  );
}
