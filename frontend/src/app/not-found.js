import Link from "next/link";
import { Home, Compass, Layers } from "lucide-react";
import { buttonClasses } from "@/components/ui";

export const metadata = {
  title: "Sayfa Bulunamadı",
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <div className="site-canvas min-h-screen flex flex-col items-center justify-center px-4 text-center">
      <div className="max-w-md w-full rounded-3xl border border-subtle bg-surface/90 p-8 sm:p-10 shadow-2xl">
        <div className="font-display text-7xl font-black text-transparent bg-clip-text bg-gradient-to-b from-purple-400 to-indigo-600 mb-3">
          404
        </div>
        <h1 className="text-2xl font-bold text-ink-primary mb-2 tracking-tight">
          Sayfa Bulunamadı
        </h1>
        <p className="text-ink-secondary text-sm leading-relaxed mb-8">
          Aradığın sayfa taşınmış, silinmiş veya hiç var olmamış olabilir. Ana
          sayfaya dönerek en yeni webtoon, manga ve novel bölümlerini keşfedebilirsin.
        </p>
        <div className="flex flex-wrap gap-2.5 justify-center">
          <Link
            href="/"
            className={buttonClasses({ variant: "primary", size: "md" })}
          >
            <Home className="h-4 w-4" />
            <span>Ana Sayfa</span>
          </Link>
          <Link
            href="/kesfet"
            className={buttonClasses({ variant: "secondary", size: "md" })}
          >
            <Compass className="h-4 w-4" />
            <span>Keşfet</span>
          </Link>
          <Link
            href="/seriler"
            className={buttonClasses({ variant: "outline", size: "md" })}
          >
            <Layers className="h-4 w-4" />
            <span>Tüm Seriler</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
