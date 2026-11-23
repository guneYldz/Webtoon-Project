"use client";

import React, { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  LayoutDashboard,
  Palette,
  BookOpen,
  FilePlus2,
  Film,
  ListChecks,
  FolderTree,
  Users,
  MessageSquare,
  Megaphone,
  LogOut,
  ExternalLink,
  Menu,
  X,
  Plus,
  ChevronRight,
  ShieldCheck,
} from "lucide-react";
import {
  clearAdminToken,
  getAdminSession,
  isAdminAuthenticated,
} from "@/lib/apiClient";
import { Skeleton } from "@/components/ui";

const BREADCRUMB_MAP: Record<string, string> = {
  "/admin": "Dashboard",
  "/admin/webtoons": "Webtoon & Manga",
  "/admin/webtoon-ekle": "Seri Ekle",
  "/admin/bolum-ekle": "Webtoon/Manga Bölüm Ekle",
  "/admin/webtoon-bolumleri": "Webtoon/Manga Bölümleri",
  "/admin/novels": "Noveller",
  "/admin/novel-ekle": "Novel Ekle",
  "/admin/novel-bolum-ekle": "Novel Bölüm Ekle",
  "/admin/novel-bolumleri": "Novel Bölümleri",
  "/admin/categories": "Kategoriler",
  "/admin/users": "Üyeler",
  "/admin/comments": "Yorumlar",
  "/admin/announcements": "Duyurular",
};

function getPageBreadcrumb(pathname: string) {
  if (BREADCRUMB_MAP[pathname]) return BREADCRUMB_MAP[pathname];
  if (pathname.startsWith("/admin/webtoons/") && pathname.endsWith("/edit")) {
    return "Seri Düzenle";
  }
  if (pathname.startsWith("/admin/novels/") && pathname.endsWith("/edit")) {
    return "Novel Düzenle";
  }
  return "Yönetim";
}

function AdminSidebarNav({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate: () => void;
}) {
  const searchParams = useSearchParams();
  const seriesTypeParam = (searchParams.get("series_type") || "").toUpperCase();

  const isNavActive = (href: string) => {
    if (href === "/admin") return pathname === "/admin";
    const [base, query] = href.split("?");
    if (query) {
      const targetType = new URLSearchParams(query).get("series_type");
      return pathname === base && seriesTypeParam === targetType;
    }
    if (pathname === base) {
      return !seriesTypeParam;
    }
    return pathname.startsWith(`${base}/`);
  };

  return (
    <nav className="flex-1 p-3 space-y-1 overflow-y-auto min-h-0">
      <NavItem
        href="/admin"
        icon={LayoutDashboard}
        label="Dashboard"
        active={isNavActive("/admin")}
        onNavigate={onNavigate}
      />

      <div className="pt-4 pb-1.5 px-3 text-[11px] font-semibold text-ink-muted uppercase tracking-wider">
        İçerik Yönetimi
      </div>

      <NavItem
        href="/admin/webtoons"
        icon={Palette}
        label="Webtoon & Manga"
        active={isNavActive("/admin/webtoons")}
        onNavigate={onNavigate}
      />
      <SubNavItem
        href="/admin/webtoon-ekle?series_type=WEBTOON"
        label="Webtoon Ekle"
        active={isNavActive("/admin/webtoon-ekle?series_type=WEBTOON")}
        onNavigate={onNavigate}
      />
      <SubNavItem
        href="/admin/webtoon-ekle?series_type=MANGA"
        label="Manga Ekle"
        active={isNavActive("/admin/webtoon-ekle?series_type=MANGA")}
        onNavigate={onNavigate}
      />
      <SubNavItem
        href="/admin/bolum-ekle?series_type=WEBTOON"
        label="Webtoon Bölüm Ekle"
        active={isNavActive("/admin/bolum-ekle?series_type=WEBTOON")}
        onNavigate={onNavigate}
      />
      <SubNavItem
        href="/admin/bolum-ekle?series_type=MANGA"
        label="Manga Bölüm Ekle"
        active={isNavActive("/admin/bolum-ekle?series_type=MANGA")}
        onNavigate={onNavigate}
      />
      <NavItem
        href="/admin/webtoon-bolumleri"
        icon={Film}
        label="Bölümler (Webtoon/Manga)"
        active={isNavActive("/admin/webtoon-bolumleri")}
        onNavigate={onNavigate}
      />

      <NavItem
        href="/admin/novels"
        icon={BookOpen}
        label="Noveller"
        active={isNavActive("/admin/novels")}
        onNavigate={onNavigate}
      />
      <SubNavItem
        href="/admin/novel-ekle"
        label="Novel Ekle"
        active={isNavActive("/admin/novel-ekle")}
        onNavigate={onNavigate}
      />
      <SubNavItem
        href="/admin/novel-bolum-ekle"
        label="Novel Bölüm Ekle"
        active={isNavActive("/admin/novel-bolum-ekle")}
        onNavigate={onNavigate}
      />
      <NavItem
        href="/admin/novel-bolumleri"
        icon={ListChecks}
        label="Novel Bölümleri"
        active={isNavActive("/admin/novel-bolumleri")}
        onNavigate={onNavigate}
      />
      <NavItem
        href="/admin/categories"
        icon={FolderTree}
        label="Kategoriler"
        active={isNavActive("/admin/categories")}
        onNavigate={onNavigate}
      />

      <div className="pt-4 pb-1.5 px-3 text-[11px] font-semibold text-ink-muted uppercase tracking-wider">
        Topluluk & Sistem
      </div>
      <NavItem
        href="/admin/users"
        icon={Users}
        label="Üyeler"
        active={isNavActive("/admin/users")}
        onNavigate={onNavigate}
      />
      <NavItem
        href="/admin/comments"
        icon={MessageSquare}
        label="Yorumlar"
        active={isNavActive("/admin/comments")}
        onNavigate={onNavigate}
      />
      <NavItem
        href="/admin/announcements"
        icon={Megaphone}
        label="Duyurular"
        active={isNavActive("/admin/announcements")}
        onNavigate={onNavigate}
      />
    </nav>
  );
}

export default function AdminShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    if (!isAdminAuthenticated()) {
      router.replace("/login-admin");
      setLoading(false);
      return;
    }

    const session = getAdminSession();
    setUsername(session.username || "Admin");
    setAuthenticated(true);
    setLoading(false);
  }, [router]);

  const handleLogout = () => {
    clearAdminToken();
    router.push("/login-admin");
  };

  const closeSidebar = () => setIsSidebarOpen(false);
  const activeCrumb = getPageBreadcrumb(pathname || "/admin");

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-canvas px-4">
        <div className="w-full max-w-sm space-y-3 text-center">
          <Skeleton className="h-8 w-40 mx-auto" />
          <Skeleton className="h-4 w-56 mx-auto" />
        </div>
      </div>
    );
  }

  if (!authenticated) {
    return null;
  }

  return (
    <div className="flex h-[100dvh] max-h-[100dvh] bg-canvas text-ink-primary overflow-hidden fixed inset-0">
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-20 md:hidden"
          onClick={closeSidebar}
        />
      )}

      <aside
        className={`w-64 bg-surface border-r border-subtle flex flex-col fixed inset-y-0 left-0 z-30 transform transition-transform duration-200 ease-smooth md:relative md:translate-x-0 h-full min-h-0 ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="px-5 py-4 border-b border-subtle flex items-center justify-between">
          <Link href="/admin" className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-brand-soft border border-brand-border flex items-center justify-center text-brand">
              <ShieldCheck className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <span className="font-display text-base font-bold tracking-wider text-ink-primary block leading-tight">
                KAOS ADMIN
              </span>
              <span className="text-[11px] text-ink-muted block">
                Yönetim Merkezi
              </span>
            </div>
          </Link>

          <button
            type="button"
            onClick={closeSidebar}
            className="md:hidden p-1.5 rounded-lg text-ink-muted hover:text-ink-primary hover:bg-white/[0.06]"
            aria-label="Menüyü kapat"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <Suspense fallback={<div className="flex-1 p-4" />}>
          <AdminSidebarNav pathname={pathname || "/admin"} onNavigate={closeSidebar} />
        </Suspense>

        <div className="p-3 border-t border-subtle space-y-1">
          <div className="px-3 py-2 rounded-xl bg-canvas/60 border border-subtle flex items-center gap-2.5 mb-2">
            <div className="w-7 h-7 rounded-full bg-brand-soft border border-brand-border flex items-center justify-center text-xs font-bold text-brand shrink-0">
              {username.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-ink-primary truncate">
                {username}
              </p>
              <p className="text-[10px] text-ink-muted uppercase tracking-wider">
                Admin
              </p>
            </div>
          </div>

          <Link
            href="/"
            className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-ink-secondary hover:text-ink-primary hover:bg-white/[0.05] transition"
          >
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
            <span>Siteye Dön</span>
          </Link>

          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            <span>Çıkış Yap</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 min-h-0 h-full overflow-hidden">
        <header className="bg-surface/90 backdrop-blur-md border-b border-subtle h-14 flex items-center px-4 md:px-6 justify-between z-10 w-full shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              className="md:hidden p-2 -ml-2 text-ink-secondary hover:text-ink-primary hover:bg-white/[0.06] rounded-lg transition"
              onClick={() => setIsSidebarOpen(true)}
              aria-label="Menüyü aç"
            >
              <Menu className="h-5 w-5" />
            </button>

            <nav aria-label="Admin Breadcrumb" className="flex items-center gap-1.5 text-xs sm:text-sm min-w-0">
              <Link href="/admin" className="text-ink-muted hover:text-ink-primary transition">
                Admin
              </Link>
              {pathname !== "/admin" && (
                <>
                  <ChevronRight className="h-3.5 w-3.5 text-ink-muted shrink-0" />
                  <span className="font-semibold text-ink-primary truncate">
                    {activeCrumb}
                  </span>
                </>
              )}
            </nav>
          </div>

          <Link
            href="/admin/bolum-ekle"
            className="hidden sm:inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-brand-soft border border-brand-border text-xs font-semibold text-purple-200 hover:bg-brand/25 transition"
          >
            <FilePlus2 className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Hızlı Bölüm Ekle</span>
          </Link>
        </header>

        <div className="admin-scroll flex-1 min-h-0 overflow-y-auto overflow-x-auto p-4 md:p-8 bg-canvas">
          {children}
        </div>
      </main>
    </div>
  );
}

function NavItem({
  href,
  icon: Icon,
  label,
  active,
  onNavigate,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  active: boolean;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
        active
          ? "bg-brand-soft text-white border border-brand-border shadow-sm"
          : "text-ink-secondary hover:bg-white/[0.05] hover:text-ink-primary border border-transparent"
      }`}
    >
      <Icon
        className={`h-4 w-4 shrink-0 ${active ? "text-brand" : "text-ink-muted"}`}
      />
      <span className="truncate">{label}</span>
    </Link>
  );
}

function SubNavItem({
  href,
  label,
  active,
  onNavigate,
}: {
  href: string;
  label: string;
  active: boolean;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={`flex items-center gap-2 ml-4 pl-3 pr-3 py-1.5 rounded-lg text-xs transition-colors border-l ${
        active
          ? "border-brand text-white bg-white/[0.06] font-semibold"
          : "border-subtle text-ink-muted hover:text-ink-primary hover:bg-white/[0.04]"
      }`}
    >
      <Plus className={`h-3 w-3 shrink-0 ${active ? "text-brand" : "text-emerald-400"}`} />
      <span className="truncate">{label}</span>
    </Link>
  );
}
