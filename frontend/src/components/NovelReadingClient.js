"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import DOMPurify from "dompurify";
import {
  ChevronLeft,
  ChevronRight,
  Layers,
} from "lucide-react";
import { apiFetch, encodeRouteParam } from "@/lib/apiClient";
import { formatChapterNumber, isAutoChapterTitle } from "@/lib/chapterTitle";
import { useReadingHistory } from "@/lib/readingHistory";
import { Skeleton } from "@/components/ui";
import ReaderShell from "@/components/ReaderShell";
import ReadingHero from "@/components/ReadingHero";
import ReadingSettingsSheet, {
  DEFAULT_NOVEL_SETTINGS,
  loadNovelSettings,
  saveNovelSettings,
} from "@/components/ReadingSettingsSheet";
import ChapterReactions from "@/components/ChapterReactions";
import CommentSection from "@/components/CommentSection";
import RecommendedSeries from "@/components/RecommendedSeries";

const COLUMN_WIDTHS = {
  narrow: "max-w-xl",
  standard: "max-w-3xl",
  wide: "max-w-5xl",
};

function sanitizeNovelHtmlSsr(rawHtml) {
  return String(rawHtml || "")
    .replace(/<(script|style|iframe|object|embed|noscript|svg|math)\b[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<(script|style|iframe|object|embed|noscript|svg|math)\b[^>]*\/?>/gi, "")
    .replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/\s+(?:style|color|bgcolor|face|class)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/(href|src)\s*=\s*(["'])\s*javascript:[\s\S]*?\2/gi, '$1="#"');
}

function sanitizeNovelHtml(rawHtml, useDomPurify = false) {
  const input = String(rawHtml || "");
  if (useDomPurify && typeof window !== "undefined" && DOMPurify?.isSupported) {
    return DOMPurify.sanitize(input, {
      FORBID_TAGS: ["script", "style", "iframe", "object", "embed"],
      FORBID_ATTR: ["style", "color", "bgcolor", "face", "class"],
    });
  }
  return sanitizeNovelHtmlSsr(input);
}

function estimateReadingMinutes(rawContent) {
  const plain = String(rawContent || "")
    .replace(/<[^>]+>/g, " ")
    .trim();
  if (!plain) return 1;
  const words = plain.split(/\s+/).length;
  return Math.max(1, Math.round(words / 210));
}

export default function NovelReadingClient({
  slug,
  chapterNumber,
  initialChapter = null,
  initialChapters = [],
}) {
  const [chapter, setChapter] = useState(initialChapter);
  const [allChapters, setAllChapters] = useState(initialChapters);
  const [loading, setLoading] = useState(!initialChapter);
  const [error, setError] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState(DEFAULT_NOVEL_SETTINGS);
  const [scrollPct, setScrollPct] = useState(0);
  const [commentCount, setCommentCount] = useState(
    initialChapter?.comment_count ?? 0
  );

  const lastSavedPctRef = useRef(-1);

  const { hydrated, getSeriesProgress, recordChapterRead, updateScrollProgress } =
    useReadingHistory();

  useEffect(() => {
    setSettings(loadNovelSettings());
  }, []);

  // Load chapter (and ping view count with real browser IP + credentials)
  useEffect(() => {
    if (!slug || !chapterNumber) return;
    let cancelled = false;

    const load = async () => {
      if (!initialChapter) {
        setLoading(true);
        setError(null);
      }

      try {
        const res = await apiFetch(
          `/novels/${encodeRouteParam(slug)}/chapters/${encodeRouteParam(chapterNumber)}`,
          {
            cache: "no-store",
            credentials: "include",
          }
        );

        if (res.ok) {
          const fresh = await res.json();
          if (!cancelled) {
            setChapter(fresh);
            setError(null);
          }
        } else if (!initialChapter && !cancelled) {
          setError("Bölüm bulunamadı.");
        }
      } catch (err) {
        console.error("Novel bölüm yükleme hatası:", err);
        if (!initialChapter && !cancelled) {
          setError("Bölüm yüklenirken bağlantı hatası oluştu.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [slug, chapterNumber, initialChapter]);

  // Fetch chapter list if not provided via SSR
  useEffect(() => {
    if (!slug || initialChapters.length > 0) return;
    let cancelled = false;

    apiFetch(`/novels/${encodeRouteParam(slug)}`, { cache: "force-cache" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data?.chapters) {
          const sorted = [...data.chapters].sort(
            (a, b) => Number(b.chapter_number) - Number(a.chapter_number)
          );
          setAllChapters(sorted);
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [slug, initialChapters.length]);

  const canonicalSlug = chapter?.novel_slug || slug;

  // Record chapter read in history
  useEffect(() => {
    if (!chapter || !chapter.novel_id) return;
    const cleanNum = formatChapterNumber(chapter.chapter_number);
    recordChapterRead({
      type: "novel",
      seriesType: "NOVEL",
      seriesId: chapter.novel_id,
      slug: String(canonicalSlug),
      title: chapter.novel_title || "",
      coverImage: chapter.novel_cover || "",
      lastChapterId: chapter.id,
      lastChapterNumber: cleanNum,
      lastChapterTitle: chapter.title,
      lastChapterUrl: `/novel/${canonicalSlug}/bolum/${cleanNum}`,
      chapterKey: cleanNum,
    });
  }, [chapter?.id, chapter?.novel_id, canonicalSlug, recordChapterRead]);

  // Track scroll progress
  useEffect(() => {
    if (!chapter) return;

    const onScroll = () => {
      const maxScroll =
        document.documentElement.scrollHeight - window.innerHeight;
      const pct =
        maxScroll > 0
          ? Math.min(100, Math.max(0, Math.round((window.scrollY / maxScroll) * 100)))
          : 100;
      setScrollPct(pct);

      if (
        chapter.novel_id &&
        Math.abs(pct - lastSavedPctRef.current) >= 5
      ) {
        lastSavedPctRef.current = pct;
        updateScrollProgress("novel", chapter.novel_id, pct, {
          lastChapterId: chapter.id,
          lastChapterNumber: formatChapterNumber(chapter.chapter_number),
        });
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, [chapter, updateScrollProgress]);

  const seriesHref = `/novel/${canonicalSlug}`;
  const prevHref =
    chapter?.prev_chapter !== null && chapter?.prev_chapter !== undefined
      ? `${seriesHref}/bolum/${formatChapterNumber(chapter.prev_chapter)}`
      : null;
  const nextHref =
    chapter?.next_chapter !== null && chapter?.next_chapter !== undefined
      ? `${seriesHref}/bolum/${formatChapterNumber(chapter.next_chapter)}`
      : null;

  const chapterOptions = useMemo(
    () =>
      allChapters.map((ch) => {
        const cleanNum = formatChapterNumber(ch.chapter_number);
        return {
          value: cleanNum,
          number: cleanNum,
          title: ch.title,
          href: `${seriesHref}/bolum/${cleanNum}`,
        };
      }),
    [allChapters, seriesHref]
  );

  // Build nearby chapters link strip (first, ±5 around current, latest) for SSR internal linking
  const nearbyChapterLinks = useMemo(() => {
    if (!allChapters || allChapters.length <= 1 || !chapter) return [];
    const asc = [...allChapters].sort(
      (a, b) => Number(a.chapter_number) - Number(b.chapter_number)
    );
    const currentClean = formatChapterNumber(chapter.chapter_number);
    const currentIdx = asc.findIndex(
      (c) => formatChapterNumber(c.chapter_number) === currentClean
    );

    const indices = new Set();
    indices.add(0);
    if (currentIdx >= 0) {
      for (
        let i = Math.max(0, currentIdx - 5);
        i <= Math.min(asc.length - 1, currentIdx + 5);
        i++
      ) {
        indices.add(i);
      }
    } else {
      for (let i = 0; i < Math.min(10, asc.length); i++) {
        indices.add(i);
      }
    }
    indices.add(asc.length - 1);

    return Array.from(indices)
      .sort((a, b) => a - b)
      .map((idx) => {
        const item = asc[idx];
        const num = formatChapterNumber(item.chapter_number);
        return {
          num,
          href: `${seriesHref}/bolum/${num}`,
          active: num === currentClean,
        };
      });
  }, [allChapters, chapter, seriesHref]);

  const progressEntry =
    hydrated && chapter?.novel_id
      ? getSeriesProgress("novel", chapter.novel_id)
      : null;

  const readingMinutes = useMemo(
    () => estimateReadingMinutes(chapter?.content),
    [chapter?.content]
  );

  const sanitizedHtml = useMemo(() => {
    if (!chapter?.content) return null;
    const hasHtml = /<[a-z][\s\S]*>/i.test(chapter.content);
    if (!hasHtml) return null;
    return sanitizeNovelHtml(chapter.content, hydrated);
  }, [chapter?.content, hydrated]);

  const handleSettingsChange = (next) => {
    setSettings(next);
    saveNovelSettings(next);
  };

  const handleResetSettings = () => {
    setSettings({ ...DEFAULT_NOVEL_SETTINGS });
    saveNovelSettings(DEFAULT_NOVEL_SETTINGS);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-canvas px-4 py-16">
        <div className="max-w-3xl mx-auto space-y-5">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-10 w-3/4" />
          <div className="space-y-3 pt-6">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-11/12" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !chapter) {
    return (
      <div className="min-h-screen bg-canvas flex flex-col items-center justify-center text-center gap-4 px-4">
        <p className="text-ink-secondary">{error || "Bölüm bulunamadı."}</p>
        <Link
          href={seriesHref}
          className="text-sm font-semibold text-accent hover:underline"
        >
          Seriye Dön
        </Link>
      </div>
    );
  }

  const chNumStr = formatChapterNumber(chapter.chapter_number);
  const customTitle =
    chapter.title && !isAutoChapterTitle(chapter.title) ? chapter.title : null;

  const fontClass =
    settings.fontFamily === "sans" ? "font-sans" : "font-serif";
  const alignClass =
    settings.align === "justify" ? "prose-novel-justified" : "text-left";
  const widthClass =
    COLUMN_WIDTHS[settings.maxWidth] || COLUMN_WIDTHS.standard;

  return (
    <ReaderShell
      seriesType="NOVEL"
      readerTheme={settings.theme}
      seriesTitle={chapter.novel_title}
      seriesHref={seriesHref}
      chapterLabel={`Bölüm ${chNumStr}`}
      chapterSubLabel={`~${readingMinutes} dk`}
      chapters={chapterOptions}
      currentChapterValue={chNumStr}
      readChapterIds={progressEntry?.readChapterIds || []}
      prevHref={prevHref}
      nextHref={nextHref}
      onOpenSettings={() => setSettingsOpen(true)}
      settingsOpen={settingsOpen}
      scrollPct={scrollPct}
    >
      {/* Restored Modern ReadingHero */}
      <ReadingHero
        type="novel"
        title={customTitle || `Bölüm ${chNumStr}`}
        subtitle={customTitle ? `Bölüm #${chNumStr}` : null}
        seriesTitle={chapter.novel_title || "Novel"}
        coverImage={chapter.novel_cover}
        viewCount={chapter.view_count}
        commentCount={commentCount}
        date={chapter.created_at}
        readingMinutes={readingMinutes}
        slug={canonicalSlug}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      {/* Novel Reading Prose */}
      <main
        className={`mx-auto ${widthClass} py-8 transition-[max-width] duration-200`}
        style={{
          paddingLeft: `${settings.paddingPx}px`,
          paddingRight: `${settings.paddingPx}px`,
        }}
      >
        <article
          className={`${fontClass} ${alignClass} text-[var(--reader-text)] transition-[font-size] duration-150`}
          style={{
            fontSize: `${settings.fontSizePx}px`,
            lineHeight: settings.lineHeight,
            ["--novel-indent"]: settings.indent ? "1.75rem" : "0",
          }}
        >
          {sanitizedHtml !== null ? (
            <div
              className="novel-content"
              dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
            />
          ) : (
            <div className="novel-content">
              {String(chapter.content || "")
                .split("\n")
                .map((para, idx) =>
                  !para.trim() ? (
                    <br key={idx} />
                  ) : (
                    <p key={idx}>{para}</p>
                  )
                )}
            </div>
          )}
        </article>
      </main>

      {/* Post-Chapter Footer (Always crisp Obsidian dark surface for Engagement) */}
      <div className="bg-canvas text-ink-primary border-t border-subtle mt-8">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="grid grid-cols-3 gap-2.5">
            {prevHref ? (
              <Link
                href={prevHref}
                className="h-12 rounded-xl bg-surface border border-subtle hover:border-hover px-3 flex items-center justify-center gap-1.5 text-sm font-semibold text-ink-primary transition"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                <span>Önceki</span>
              </Link>
            ) : (
              <span className="h-12 rounded-xl bg-surface/40 border border-subtle px-3 flex items-center justify-center gap-1.5 text-sm font-semibold text-ink-muted opacity-40 cursor-not-allowed">
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                <span>Önceki</span>
              </span>
            )}

            <Link
              href={seriesHref}
              className="h-12 rounded-xl bg-surface border border-subtle hover:border-hover px-3 flex items-center justify-center gap-1.5 text-sm font-semibold text-ink-secondary hover:text-ink-primary transition"
            >
              <Layers className="h-4 w-4" aria-hidden="true" />
              <span>Bölümler</span>
            </Link>

            {nextHref ? (
              <Link
                href={nextHref}
                className="h-12 rounded-xl bg-accent text-[#0B0B0F] hover:brightness-110 px-3 flex items-center justify-center gap-1.5 text-sm font-bold shadow-md transition"
              >
                <span>Sonraki</span>
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            ) : (
              <span className="h-12 rounded-xl bg-surface/40 border border-subtle px-3 flex items-center justify-center gap-1.5 text-sm font-semibold text-ink-muted opacity-40 cursor-not-allowed">
                <span>Sonraki</span>
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </span>
            )}
          </div>

          {/* Nearby Chapters Strip for Quick Navigation & Deep Crawlability */}
          {nearbyChapterLinks.length > 1 && (
            <nav
              aria-label="Diğer Bölümler"
              className="mt-5 rounded-2xl border border-subtle bg-surface/70 p-3.5"
            >
              <div className="flex items-center justify-between gap-2 mb-2.5">
                <span className="text-xs font-bold uppercase tracking-wider text-ink-secondary">
                  Diğer Bölümler
                </span>
                <Link
                  href={`${seriesHref}#bolumler`}
                  className="text-xs font-semibold text-accent hover:underline"
                >
                  Tüm Bölümler ({allChapters.length})
                </Link>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {nearbyChapterLinks.map((item) => (
                  <Link
                    key={item.num}
                    href={item.href}
                    prefetch={false}
                    title={`${chapter.novel_title || "Novel"} Bölüm ${item.num} Oku`}
                    aria-current={item.active ? "page" : undefined}
                    className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold tabular-nums transition ${
                      item.active
                        ? "bg-accent text-[#0B0B0F] border-transparent shadow-sm"
                        : "bg-canvas border-subtle text-ink-secondary hover:text-ink-primary hover:border-accent-border"
                    }`}
                  >
                    Bölüm {item.num}
                  </Link>
                ))}
              </div>
            </nav>
          )}

          <div className="mt-6">
            <ChapterReactions type="novel" targetId={chapter.id} />
          </div>

          <div id="yorumlar" className="mt-4 scroll-mt-16">
            <CommentSection
              type="novel"
              itemId={chapter.novel_id}
              chapterId={chapter.id}
              onCountChange={setCommentCount}
            />
          </div>

          <RecommendedSeries type="novel" currentId={chapter.novel_id} />
        </div>
      </div>

      <ReadingSettingsSheet
        mode="novel"
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        onChange={handleSettingsChange}
        onReset={handleResetSettings}
      />
    </ReaderShell>
  );
}
