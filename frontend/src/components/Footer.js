import Link from "next/link";
import Image from "next/image";
import { Compass, Layers, Sparkles, Megaphone, BookOpen, ShieldCheck, Heart } from "lucide-react";

const DISCOVERY_LINKS = [
  { href: "/kesfet", label: "Keşfet", icon: Compass },
  { href: "/seriler", label: "Tüm Seriler", icon: Layers },
  { href: "/yeniler", label: "Yeni Eklenenler", icon: Sparkles },
  { href: "/duyurular", label: "Duyurular", icon: Megaphone },
];

const FORMAT_LINKS = [
  { href: "/kesfet?tur=WEBTOON", label: "Türkçe Webtoon Oku" },
  { href: "/kesfet?tur=MANGA", label: "Türkçe Manga Oku" },
  { href: "/kesfet?tur=NOVEL", label: "Türkçe Web Novel Oku" },
];

const ACCOUNT_LINKS = [
  { href: "/profil", label: "Profilim" },
  { href: "/favoriler", label: "Favori Serilerim" },
  { href: "/profil?tab=ayarlar", label: "Hesap Ayarları" },
  { href: "/login", label: "Giriş Yap / Kayıt Ol" },
];

export default function Footer() {
  const year = new Date(Date.now() + 3 * 60 * 60 * 1000).getUTCFullYear();

  return (
    <footer className="mt-20 border-t border-subtle bg-surface/70 backdrop-blur-md">
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 py-12">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-2 lg:grid-cols-12 pb-10 border-b border-subtle">
          {/* Brand & Condensed SEO Bio */}
          <div className="lg:col-span-5 space-y-4">
            <Link href="/" className="inline-flex items-center gap-3 group">
              <div className="relative h-10 w-10 overflow-hidden rounded-full bg-black ring-1 ring-purple-500/35 shadow-[0_0_14px_rgba(168,85,247,0.25)] group-hover:ring-brand transition">
                <Image
                  src="/logo.png"
                  alt="Kaos Manga Logo"
                  fill
                  sizes="40px"
                  className="object-cover"
                />
              </div>
              <span className="font-display text-lg font-black tracking-widest text-ink-primary group-hover:text-brand transition">
                KAOS MANGA
              </span>
            </Link>

            <p className="text-sm text-ink-secondary leading-relaxed max-w-md">
              Kaos Manga; en popüler <strong className="text-ink-primary font-medium">webtoon</strong>,{" "}
              <strong className="text-ink-primary font-medium">manga</strong>,{" "}
              <strong className="text-ink-primary font-medium">manhwa</strong> ve{" "}
              <strong className="text-ink-primary font-medium">web novel</strong> serilerini Türkçe,
              reklamsız okuma ergonomisi ve düzenli bölüm güncellemeleriyle ücretsiz sunan dijital
              okuma platformudur.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-1 text-xs text-ink-muted">
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-subtle bg-elevated/60 px-2.5 py-1">
                <BookOpen className="h-3.5 w-3.5 text-brand" />
                Kişiselleştirilebilir Okuyucu
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-subtle bg-elevated/60 px-2.5 py-1">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                Ücretsiz & Güncel Arşiv
              </span>
            </div>
          </div>

          {/* Discovery Navigation */}
          <div className="lg:col-span-2 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-ink-primary">
              Platform
            </h3>
            <ul className="space-y-2.5 text-sm">
              {DISCOVERY_LINKS.map((item) => {
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="inline-flex items-center gap-2 text-ink-secondary hover:text-ink-primary transition-colors"
                    >
                      <Icon className="h-3.5 w-3.5 text-ink-muted" />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Format Archive Links */}
          <div className="lg:col-span-3 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-ink-primary">
              Kütüphane & Formatlar
            </h3>
            <ul className="space-y-2.5 text-sm">
              {FORMAT_LINKS.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="text-ink-secondary hover:text-ink-primary transition-colors"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Account Links */}
          <div className="lg:col-span-2 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-ink-primary">
              Hesap
            </h3>
            <ul className="space-y-2.5 text-sm">
              {ACCOUNT_LINKS.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="text-ink-secondary hover:text-ink-primary transition-colors"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom Legal Bar */}
        <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-ink-muted">
          <p suppressHydrationWarning>© {year} Kaos Manga. Tüm hakları saklıdır.</p>
          <p className="inline-flex items-center gap-1.5">
            Türkçe Webtoon, Manga ve Novel Okuma Platformu
            <Heart className="h-3.5 w-3.5 text-brand fill-brand/30" />
          </p>
        </div>
      </div>
    </footer>
  );
}
