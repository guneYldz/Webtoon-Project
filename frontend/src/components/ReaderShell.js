"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Compass,
  Heart,
  Home,
  Menu,
  MessageSquare,
  Search,
  SlidersHorizontal,
  BookOpen,
  User,
  CheckCircle2,
} from "lucide-react";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui";
import { formatChapterNumber, isAutoChapterTitle } from "@/lib/chapterTitle";

/**
 * Distraction-free floating reader shell with auto-hiding 48px Top & Bottom HUDs,
 * searchable chapter picker, quick navigation menu, and guarded keyboard shortcuts.
 */
export default function ReaderShell({
  seriesType = "WEBTOON",
  readerTheme = "charcoal",
  seriesTitle = "",
  seriesHref = "/",
  chapterLabel = "",
  chapterSubLabel = "",
  chapters = [],
  currentChapterValue,
  readChapterIds = [],
  prevHref = null,
  nextHref = null,
  onOpenSettings,
  settingsOpen = false,
  scrollPct = 0,
  children,
}) {
  const router = useRouter();
  const [hudVisible, setHudVisible] = useState(true);
  const [chapterPopoverOpen, setChapterPopoverOpen] = useState(false);
  const [chapterSearch, setChapterSearch] = useState("");
  const lastScrollY = useRef(0);

  // Scroll direction auto-hide
  useEffect(() => {
    const handleScroll = () => {
      const y = window.scrollY;
      const docHeight =
        document.documentElement.scrollHeight - window.innerHeight;
      const nearTop = y < 80;
      const nearBottom = docHeight > 0 && y >= docHeight - 120;

      if (nearTop || nearBottom) {
        setHudVisible(true);
      } else if (y > lastScrollY.current + 12) {
        setHudVisible(false);
      } else if (y < lastScrollY.current - 12) {
        setHudVisible(true);
      }
      lastScrollY.current = y;
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Guarded keyboard navigation (ArrowLeft / ArrowRight)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
      if (settingsOpen || chapterPopoverOpen) return;

      const target = e.target;
      if (target && typeof target === "object") {
        const tag = String(target.tagName || "").toUpperCase();
        if (
          tag === "INPUT" ||
          tag === "TEXTAREA" ||
          tag === "SELECT" ||
          target.isContentEditable
        ) {
          return;
        }
      }

      if (e.key === "ArrowLeft" && prevHref) {
        e.preventDefault();
        router.push(prevHref);
      } else if (e.key === "ArrowRight" && nextHref) {
        e.preventDefault();
        router.push(nextHref);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [prevHref, nextHref, router, settingsOpen, chapterPopoverOpen]);

  const filteredChapters = useMemo(() => {
    const q = chapterSearch.trim().toLowerCase();
    if (!q) return chapters;
    return chapters.filter((ch) => {
      const num = formatChapterNumber(ch.number).toLowerCase();
      const title = String(ch.title || "").toLowerCase();
      return num.includes(q) || title.includes(q);
    });
  }, [chapters, chapterSearch]);

  const readSet = useMemo(
    () => new Set((readChapterIds || []).map((id) => String(id))),
    [readChapterIds]
  );

  const handleCanvasClick = (e) => {
    if (typeof window !== "undefined") {
      const selection = window.getSelection();
      if (selection && selection.toString().trim().length > 0) {
        return;
      }
    }

    const target = e.target;
    if (
      target instanceof Element &&
      target.closest(
        "a, button, input, select, textarea, label, [role='dialog'], [role='menu'], [data-radix-popper-content-wrapper], [data-no-hud-toggle]"
      )
    ) {
      return;
    }

    setHudVisible((v) => !v);
  };

  const scrollToComments = () => {
    const el = document.getElementById("yorumlar");
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const showBars = hudVisible || settingsOpen || chapterPopoverOpen;

  return (
    <div
      data-series-type={seriesType}
      data-reader-theme={readerTheme}
      onClick={handleCanvasClick}
      className="min-h-screen w-full bg-[var(--reader-bg)] text-[var(--reader-text)] transition-colors duration-200 flex flex-col"
    >
      {/* 48px Auto-Hiding Top HUD */}
      <header
        data-no-hud-toggle=""
        className={`fixed top-0 left-0 right-0 z-40 h-12 bg-[#0B0B0F]/90 backdrop-blur-xl border-b border-white/10 text-[#F4F4F6] transition-transform duration-200 ease-smooth ${
          showBars ? "translate-y-0" : "-translate-y-full"
        }`}
      >
        <div className="max-w-5xl mx-auto h-full px-3 sm:px-4 flex items-center justify-between gap-2">
          {/* Left: Home Logo + Back to Series */}
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <Link
              href="/"
              title="Ana Sayfa"
              className="w-8 h-8 rounded-lg overflow-hidden border border-white/15 shrink-0 hover:border-accent-border transition flex items-center justify-center bg-surface"
            >
              <img
                src="/logo.png"
                alt="Kaos Manga"
                className="w-full h-full object-cover"
              />
            </Link>

            <Link
              href={seriesHref}
              className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs sm:text-sm font-medium text-ink-secondary hover:text-white hover:bg-white/[0.06] transition min-w-0"
              title={seriesTitle || "Seriye Dön"}
            >
              <ArrowLeft className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
              <span className="truncate max-w-[110px] sm:max-w-[220px]">
                {seriesTitle || "Seri"}
              </span>
            </Link>
          </div>

          {/* Center: Searchable Chapter Picker Popover */}
          <div className="shrink-0">
            <Popover
              open={chapterPopoverOpen}
              onOpenChange={(open) => {
                setChapterPopoverOpen(open);
                if (!open) setChapterSearch("");
              }}
            >
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="h-8 px-2.5 sm:px-3 rounded-lg bg-white/[0.06] hover:bg-white/[0.11] border border-white/10 text-xs font-semibold text-white inline-flex items-center gap-1.5 transition"
                >
                  <span className="max-w-[110px] sm:max-w-[160px] truncate">
                    {chapterLabel || "Bölümler"}
                  </span>
                  <ChevronDown className="h-3.5 w-3.5 text-ink-secondary shrink-0" />
                </button>
              </PopoverTrigger>

              <PopoverContent
                align="center"
                className="w-72 sm:w-80 p-3 bg-[#13131A]/95 border-white/15"
              >
                <div className="relative mb-2.5">
                  <Search className="h-3.5 w-3.5 text-ink-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={chapterSearch}
                    onChange={(e) => setChapterSearch(e.target.value)}
                    placeholder="Bölüm no veya başlık..."
                    className="w-full h-9 rounded-lg bg-canvas border border-subtle pl-8 pr-3 text-xs text-ink-primary placeholder:text-ink-muted outline-none focus:border-accent-border"
                    autoFocus
                  />
                </div>

                <div className="max-h-72 overflow-y-auto space-y-1 pr-1">
                  {filteredChapters.length === 0 ? (
                    <p className="text-xs text-ink-muted text-center py-6">
                      Bölüm bulunamadı.
                    </p>
                  ) : (
                    filteredChapters.map((ch) => {
                      const numStr = formatChapterNumber(ch.number);
                      const active =
                        String(ch.value) === String(currentChapterValue);
                      const isRead =
                        readSet.has(String(ch.value)) ||
                        readSet.has(String(ch.number));
                      const hasTitle =
                        ch.title && !isAutoChapterTitle(ch.title);

                      return (
                        <Link
                          key={ch.value}
                          href={ch.href}
                          onClick={() => setChapterPopoverOpen(false)}
                          className={`flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-xs transition ${
                            active
                              ? "bg-accent-soft text-white border border-accent-border font-semibold"
                              : isRead
                              ? "text-ink-muted hover:bg-white/[0.05] hover:text-ink-primary"
                              : "text-ink-secondary hover:bg-white/[0.06] hover:text-white"
                          }`}
                        >
                          <span className="truncate">
                            Bölüm {numStr}
                            {hasTitle ? ` — ${ch.title}` : ""}
                          </span>
                          {isRead && !active && (
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400/80 shrink-0" />
                          )}
                        </Link>
                      );
                    })
                  )}
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {/* Right: Settings Trigger + Quick Navigation Menu */}
          <div className="flex items-center justify-end gap-1.5 flex-1">
            {onOpenSettings && (
              <button
                type="button"
                onClick={onOpenSettings}
                aria-label="Okuma ayarları"
                title="Okuma ayarları"
                className={`h-8 px-2.5 rounded-lg border text-xs font-semibold inline-flex items-center gap-1.5 transition ${
                  settingsOpen
                    ? "bg-accent-soft border-accent-border text-white"
                    : "bg-white/[0.05] border-white/10 text-ink-secondary hover:text-white hover:bg-white/[0.1]"
                }`}
              >
                <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="hidden sm:inline">Ayarlar</span>
              </button>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="Hızlı menü"
                  title="Hızlı menü"
                  className="h-8 w-8 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-ink-secondary hover:text-white inline-flex items-center justify-center transition"
                >
                  <Menu className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem asChild>
                  <Link href="/" className="flex items-center gap-2">
                    <Home className="h-4 w-4" />
                    <span>Ana Sayfa</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/kesfet" className="flex items-center gap-2">
                    <Compass className="h-4 w-4" />
                    <span>Keşfet</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/seriler" className="flex items-center gap-2">
                    <BookOpen className="h-4 w-4" />
                    <span>Seriler</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/favoriler" className="flex items-center gap-2">
                    <Heart className="h-4 w-4" />
                    <span>Favorilerim</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/profil" className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    <span>Profilim</span>
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Main Reader Content */}
      <div className="flex-1 pt-12 pb-16">{children}</div>

      {/* 48px Auto-Hiding Bottom HUD */}
      <footer
        data-no-hud-toggle=""
        className={`fixed bottom-0 left-0 right-0 z-40 h-12 bg-[#0B0B0F]/92 backdrop-blur-xl border-t border-white/10 text-[#F4F4F6] transition-transform duration-200 ease-smooth ${
          showBars ? "translate-y-0" : "translate-y-full"
        }`}
      >
        {/* Top 2px live reading progress bar */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-white/10 overflow-hidden">
          <div
            className="h-full bg-accent transition-[width] duration-150"
            style={{ width: `${Math.min(100, Math.max(0, scrollPct))}%` }}
          />
        </div>

        <div className="max-w-4xl mx-auto h-full px-3 sm:px-4 flex items-center justify-between gap-2">
          {prevHref ? (
            <Link
              href={prevHref}
              className="h-8 px-2.5 sm:px-3 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-xs font-semibold text-white inline-flex items-center gap-1 transition shrink-0"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              <span>Önceki</span>
            </Link>
          ) : (
            <span className="h-8 px-2.5 sm:px-3 rounded-lg bg-white/[0.03] border border-white/5 text-xs font-semibold text-ink-muted opacity-45 inline-flex items-center gap-1 cursor-not-allowed shrink-0">
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              <span>Önceki</span>
            </span>
          )}

          <div className="flex items-center gap-2.5 min-w-0">
            <div className="text-center min-w-0">
              <p className="text-xs font-semibold text-white truncate max-w-[140px] sm:max-w-[240px]">
                {chapterLabel}
              </p>
              <p className="text-[10px] text-ink-muted tabular-nums">
                {chapterSubLabel ? `${chapterSubLabel} • ` : ""}%{Math.round(scrollPct)}
              </p>
            </div>

            <button
              type="button"
              onClick={scrollToComments}
              aria-label="Yorumlara git"
              title="Yorumlara git"
              className="h-7 w-7 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-ink-secondary hover:text-accent inline-flex items-center justify-center transition shrink-0"
            >
              <MessageSquare className="h-3.5 w-3.5" />
            </button>
          </div>

          {nextHref ? (
            <Link
              href={nextHref}
              className="h-8 px-2.5 sm:px-3 rounded-lg bg-accent text-[#0B0B0F] hover:brightness-110 text-xs font-bold inline-flex items-center gap-1 transition shadow-sm shrink-0"
            >
              <span>Sonraki</span>
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          ) : (
            <span className="h-8 px-2.5 sm:px-3 rounded-lg bg-white/[0.03] border border-white/5 text-xs font-semibold text-ink-muted opacity-45 inline-flex items-center gap-1 cursor-not-allowed shrink-0">
              <span>Sonraki</span>
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </span>
          )}
        </div>
      </footer>
    </div>
  );
}
