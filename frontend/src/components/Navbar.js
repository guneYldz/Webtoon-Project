"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Menu,
  Search,
  User,
  Heart,
  Settings,
  LogOut,
  ChevronDown,
  Home,
  Compass,
  Layers,
  Sparkles,
  Megaphone,
  Shield,
  BookPlus,
  FilePlus2,
  BookOpen,
  X,
} from "lucide-react";
import { apiFetch, resolveMediaUrl, logoutUser } from "@/lib/apiClient";
import NotificationBell from "@/components/NotificationBell";
import {
  Button,
  Badge,
  Dialog,
  DialogContent,
  DialogTitle,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui";

const NAV_LINKS = [
  { href: "/", label: "Ana Sayfa", icon: Home },
  { href: "/kesfet", label: "Keşfet", icon: Compass },
  { href: "/seriler", label: "Seriler", icon: Layers },
  { href: "/yeniler", label: "Yeniler", icon: Sparkles },
  { href: "/duyurular", label: "Duyurular", icon: Megaphone },
];

export default function Navbar() {
  const [user, setUser] = useState(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef(null);

  const pathname = usePathname();
  const router = useRouter();

  const checkUser = async () => {
    const token =
      typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!token) {
      setUser(null);
      return;
    }

    try {
      const res = await apiFetch("/auth/me", { auth: "user" });
      if (res.ok) {
        const userData = await res.json();
        setUser(userData);
      } else {
        localStorage.removeItem("token");
        setUser(null);
      }
    } catch (err) {
      console.error("Kullanıcı doğrulanamadı:", err);
      setUser(null);
    }
  };

  useEffect(() => {
    checkUser();
    window.addEventListener("auth-change", checkUser);
    return () => window.removeEventListener("auth-change", checkUser);
  }, [pathname]);

  // Cmd+K / Ctrl+K shortcut for Quick Search
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      } else if (e.key === "Escape" && isSearchOpen) {
        setIsSearchOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isSearchOpen]);

  useEffect(() => {
    if (isSearchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isSearchOpen]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    const trimmed = searchQuery.trim();
    setIsSearchOpen(false);
    setIsMobileMenuOpen(false);
    if (trimmed) {
      router.push(`/kesfet?q=${encodeURIComponent(trimmed)}`);
    } else {
      router.push("/kesfet");
    }
  };

  const handleLogout = async () => {
    await logoutUser();
    setUser(null);
    setIsMobileMenuOpen(false);
    toast.success("Oturum kapatıldı.");
    router.push("/login");
  };

  const isActiveLink = (href) => {
    if (!pathname) return false;
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  if (pathname?.startsWith("/admin") || pathname === "/login-admin") {
    return null;
  }

  const isStaff = user?.role === "admin" || user?.role === "editor";

  return (
    <header className="sticky top-0 z-40 h-16 md:h-[68px] w-full bg-glass backdrop-blur-xl border-b border-subtle transition-colors">
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 h-full flex items-center justify-between gap-3">
        {/* LEFT: Mobile Trigger + Brand */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(true)}
            className="md:hidden inline-flex h-9 w-9 items-center justify-center rounded-xl text-ink-secondary hover:text-ink-primary hover:bg-white/[0.06] transition-colors"
            aria-label="Menüyü Aç"
          >
            <Menu className="h-5 w-5" />
          </button>

          <Link
            href="/"
            title="Kaos Manga - Ana Sayfa"
            className="flex items-center gap-3 group focus-visible:outline-none"
          >
            <div className="relative h-10 w-10 sm:h-11 sm:w-11 overflow-hidden rounded-full bg-black ring-1 ring-purple-500/35 shadow-[0_0_14px_rgba(168,85,247,0.28)] group-hover:ring-brand group-hover:scale-105 transition duration-300">
              <Image
                src="/logo.png"
                alt="Kaos Manga Logo"
                fill
                className="object-cover"
                sizes="44px"
                quality={95}
              />
            </div>

            <span className="font-display text-lg sm:text-xl font-black tracking-widest bg-clip-text text-transparent bg-gradient-to-r from-white via-purple-200 to-purple-400 group-hover:from-purple-300 group-hover:to-indigo-400 transition hidden sm:block">
              KAOS MANGA
            </span>
          </Link>
        </div>

        {/* CENTER: Desktop Navigation */}
        <nav
          aria-label="Ana Navigasyon"
          className="hidden md:flex items-center gap-1"
        >
          {NAV_LINKS.map((link) => {
            const active = isActiveLink(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                title={link.label}
                className={`relative px-3.5 py-2 rounded-xl text-sm font-medium transition-all duration-150 ${
                  active
                    ? "text-ink-primary bg-white/[0.07] font-semibold shadow-sm ring-1 ring-inset ring-white/10"
                    : "text-ink-secondary hover:text-ink-primary hover:bg-white/[0.04]"
                }`}
              >
                {link.label}
                {active && (
                  <span className="absolute inset-x-3 -bottom-[11px] h-0.5 rounded-full bg-brand" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* RIGHT: Quick Search + Notifications + User Dropdown */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Expandable Desktop Quick Search / Trigger */}
          {isSearchOpen ? (
            <form
              onSubmit={handleSearchSubmit}
              className="relative flex items-center animate-fade-in"
            >
              <Search className="h-4 w-4 text-ink-muted absolute left-3 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Seri ara..."
                className="h-9 w-44 sm:w-64 rounded-xl border border-brand/50 bg-surface pl-9 pr-8 text-xs sm:text-sm text-ink-primary placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-brand/40"
              />
              <button
                type="button"
                onClick={() => setIsSearchOpen(false)}
                className="absolute right-2 text-ink-muted hover:text-ink-primary p-0.5"
                aria-label="Aramayı Kapat"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setIsSearchOpen(true)}
              className="inline-flex h-9 items-center gap-2 rounded-xl border border-subtle bg-surface/80 hover:bg-elevated hover:border-hover px-2.5 sm:px-3 text-xs text-ink-secondary hover:text-ink-primary transition-colors"
              aria-label="Hızlı Arama"
              title="Seri Ara (Ctrl+K)"
            >
              <Search className="h-4 w-4 text-ink-secondary" />
              <span className="hidden lg:inline text-ink-muted">Ara...</span>
              <kbd className="hidden lg:inline-flex items-center rounded border border-white/10 bg-canvas/80 px-1.5 py-0.5 text-[10px] font-mono text-ink-muted">
                ⌘K
              </kbd>
            </button>
          )}

          <NotificationBell user={user} />

          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="Hesap Menüsü"
                  className="inline-flex items-center gap-2 rounded-full border border-subtle bg-surface hover:bg-elevated hover:border-hover py-1 pl-1.5 pr-2.5 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
                >
                  {user.profile_image ? (
                    <img
                      src={resolveMediaUrl(user.profile_image)}
                      alt={user.username || "Profil"}
                      className="h-7 w-7 rounded-full object-cover ring-1 ring-white/15"
                    />
                  ) : (
                    <div className="h-7 w-7 rounded-full bg-gradient-to-tr from-brand to-indigo-500 flex items-center justify-center text-white text-xs font-bold">
                      {user.username
                        ? user.username.charAt(0).toUpperCase()
                        : "U"}
                    </div>
                  )}
                  <span className="text-xs font-semibold text-ink-primary hidden sm:block max-w-[120px] truncate">
                    {user.username}
                  </span>
                  <ChevronDown className="h-3.5 w-3.5 text-ink-muted" />
                </button>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end" className="w-60">
                <div className="px-2.5 py-2 border-b border-subtle mb-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-ink-muted">Hesap</span>
                    <Badge
                      variant={
                        user.role === "admin"
                          ? "new"
                          : user.role === "editor"
                          ? "manga"
                          : "webtoon"
                      }
                      size="sm"
                    >
                      {user.role || "user"}
                    </Badge>
                  </div>
                  <p className="text-sm font-bold text-ink-primary truncate mt-1">
                    {user.username}
                  </p>
                </div>

                {isStaff && (
                  <>
                    <DropdownMenuLabel>Yönetim & İçerik</DropdownMenuLabel>
                    {user.role === "admin" && (
                      <DropdownMenuItem asChild>
                        <Link href="/admin">
                          <Shield className="h-4 w-4 text-brand" />
                          <span>Yönetim Paneli</span>
                        </Link>
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem asChild>
                      <Link href="/admin/webtoon-ekle">
                        <BookPlus className="h-4 w-4 text-sky-400" />
                        <span>Webtoon & Manga Ekle</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/admin/bolum-ekle">
                        <FilePlus2 className="h-4 w-4 text-sky-400" />
                        <span>Webtoon Bölümü Yükle</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/admin/novel-ekle">
                        <BookOpen className="h-4 w-4 text-purple-400" />
                        <span>Roman Ekle</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/admin/novel-bolum-ekle">
                        <FilePlus2 className="h-4 w-4 text-purple-400" />
                        <span>Roman Bölümü Yükle</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}

                <DropdownMenuItem asChild>
                  <Link href="/profil">
                    <User className="h-4 w-4 text-ink-secondary" />
                    <span>Profilim</span>
                  </Link>
                </DropdownMenuItem>

                <DropdownMenuItem asChild>
                  <Link href="/favoriler">
                    <Heart className="h-4 w-4 text-rose-400" />
                    <span>Favorilerim</span>
                  </Link>
                </DropdownMenuItem>

                <DropdownMenuItem asChild>
                  <Link href="/profil?tab=ayarlar">
                    <Settings className="h-4 w-4 text-ink-secondary" />
                    <span>Hesap Ayarları</span>
                  </Link>
                </DropdownMenuItem>

                <DropdownMenuSeparator />

                <DropdownMenuItem destructive onSelect={handleLogout}>
                  <LogOut className="h-4 w-4" />
                  <span>Çıkış Yap</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button
              variant="primary"
              size="sm"
              aria-label="Giriş Yap"
              onClick={() => router.push("/login")}
              className="rounded-xl"
            >
              <User className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">Giriş Yap</span>
            </Button>
          )}
        </div>
      </div>

      {/* MOBILE NAVIGATION DRAWER (Radix Dialog side="left") */}
      <Dialog open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
        <DialogContent
          side="left"
          className="flex flex-col justify-between p-5 overflow-y-auto"
        >
          <div className="space-y-6">
            <div className="flex items-center gap-3 pr-8">
              <div className="relative h-9 w-9 overflow-hidden rounded-full bg-black ring-1 ring-purple-500/35 shadow-[0_0_12px_rgba(168,85,247,0.25)]">
                <Image
                  src="/logo.png"
                  alt="Kaos Manga Logo"
                  fill
                  sizes="36px"
                  className="object-cover"
                />
              </div>
              <DialogTitle className="font-display text-base font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-white to-purple-400">
                KAOS MANGA
              </DialogTitle>
            </div>

            {/* Mobile Search Input */}
            <form onSubmit={handleSearchSubmit} className="relative">
              <Search className="h-4 w-4 text-ink-muted absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Webtoon, manga, novel ara..."
                className="w-full rounded-xl border border-subtle bg-canvas py-2.5 pl-10 pr-3 text-sm text-ink-primary placeholder:text-ink-muted focus:border-brand focus:outline-none"
              />
            </form>

            {/* Primary Links */}
            <nav className="flex flex-col gap-1">
              {NAV_LINKS.map((link) => {
                const Icon = link.icon;
                const active = isActiveLink(link.href);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    title={link.label}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors ${
                      active
                        ? "bg-brand/15 text-ink-primary border border-brand/30 font-semibold"
                        : "text-ink-secondary hover:text-ink-primary hover:bg-white/[0.05]"
                    }`}
                  >
                    <Icon
                      className={`h-4 w-4 ${
                        active ? "text-brand" : "text-ink-muted"
                      }`}
                    />
                    <span>{link.label}</span>
                  </Link>
                );
              })}
            </nav>

            {/* User Account Links inside Mobile Drawer */}
            {user && (
              <div className="space-y-1 border-t border-subtle pt-4">
                <p className="px-3 text-[11px] font-bold uppercase tracking-wider text-ink-muted mb-2">
                  Hesabım
                </p>
                <Link
                  href="/profil"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm text-ink-secondary hover:text-ink-primary hover:bg-white/[0.05]"
                >
                  <User className="h-4 w-4 text-ink-muted" />
                  <span>Profilim</span>
                </Link>
                <Link
                  href="/favoriler"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm text-ink-secondary hover:text-ink-primary hover:bg-white/[0.05]"
                >
                  <Heart className="h-4 w-4 text-rose-400" />
                  <span>Favorilerim</span>
                </Link>
                <Link
                  href="/profil?tab=ayarlar"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm text-ink-secondary hover:text-ink-primary hover:bg-white/[0.05]"
                >
                  <Settings className="h-4 w-4 text-ink-muted" />
                  <span>Hesap Ayarları</span>
                </Link>
                {isStaff && (
                  <Link
                    href={user.role === "admin" ? "/admin" : "/admin/webtoon-ekle"}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm text-brand hover:bg-brand/10"
                  >
                    <Shield className="h-4 w-4" />
                    <span>Yönetim Araçları</span>
                  </Link>
                )}
              </div>
            )}
          </div>

          {/* Drawer Footer */}
          <div className="border-t border-subtle pt-4 mt-6">
            {!user ? (
              <div className="flex flex-col gap-2">
                <Button
                  variant="primary"
                  size="md"
                  className="w-full"
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    router.push("/login");
                  }}
                >
                  <User className="h-4 w-4" />
                  <span>Giriş Yap</span>
                </Button>
                <Button
                  variant="secondary"
                  size="md"
                  className="w-full"
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    router.push("/register");
                  }}
                >
                  <span>Kayıt Ol</span>
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-2 rounded-xl border border-subtle bg-elevated/60 p-2.5">
                <Link
                  href="/profil"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex items-center gap-2.5 min-w-0 flex-1"
                >
                  {user.profile_image ? (
                    <img
                      src={resolveMediaUrl(user.profile_image)}
                      alt={user.username || "Profil"}
                      className="h-9 w-9 rounded-full object-cover ring-1 ring-white/15 shrink-0"
                    />
                  ) : (
                    <div className="h-9 w-9 rounded-full bg-gradient-to-tr from-brand to-indigo-500 flex items-center justify-center text-white text-sm font-bold shrink-0">
                      {user.username
                        ? user.username.charAt(0).toUpperCase()
                        : "U"}
                    </div>
                  )}
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-bold text-ink-primary truncate">
                      {user.username}
                    </span>
                    <span className="text-xs text-ink-muted capitalize">
                      {user.role || "user"}
                    </span>
                  </div>
                </Link>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-rose-400 hover:bg-rose-500/15 transition-colors shrink-0"
                  title="Çıkış Yap"
                  aria-label="Çıkış Yap"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </header>
  );
}
