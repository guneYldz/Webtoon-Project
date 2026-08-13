import Link from "next/link";

export const metadata = {
  title: "Sayfa Bulunamadı",
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#121212] flex flex-col items-center justify-center px-4 text-center">
      <div className="text-7xl font-black text-transparent bg-clip-text bg-gradient-to-b from-blue-500 to-purple-600 mb-4">
        404
      </div>
      <h1 className="text-2xl font-bold text-white mb-3">Sayfa Bulunamadı</h1>
      <p className="text-gray-400 text-sm max-w-md mb-8">
        Aradığın sayfa taşınmış, silinmiş veya hiç var olmamış olabilir. Ana
        sayfaya dönerek en yeni webtoon ve novel bölümlerini keşfedebilirsin.
      </p>
      <div className="flex flex-wrap gap-3 justify-center">
        <Link
          href="/"
          className="px-6 py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-sm font-bold transition"
        >
          Ana Sayfa
        </Link>
        <Link
          href="/seriler"
          className="px-6 py-3 rounded-xl bg-[#1a1a1a] border border-gray-700 hover:border-gray-500 text-gray-300 text-sm font-bold transition"
        >
          Tüm Seriler
        </Link>
        <Link
          href="/kesfet"
          className="px-6 py-3 rounded-xl bg-[#1a1a1a] border border-gray-700 hover:border-gray-500 text-gray-300 text-sm font-bold transition"
        >
          Keşfet
        </Link>
      </div>
    </div>
  );
}
