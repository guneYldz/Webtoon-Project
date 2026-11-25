"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  RefreshCw,
  ImageOff,
  ChevronLeft,
  ChevronRight,
  Layers,
} from "lucide-react";
import { apiFetch, encodeRouteParam, resolveMediaUrl } from "@/lib/apiClient";
import { seriesTypeLabel } from "@/lib/seriesType";
import { formatChapterNumber, isAutoChapterTitle } from "@/lib/chapterTitle";
import { useReadingHistory } from "@/lib/readingHistory";
import { Button, Skeleton } from "@/components/ui";
import ReaderShell from "@/components/ReaderShell";
import ReadingHero from "@/components/ReadingHero";
import ReadingSettingsSheet, {
  DEFAULT_WEBTOON_SETTINGS,
  loadWebtoonSettings,
  saveWebtoonSettings,
} from "@/components/ReadingSettingsSheet";
import ChapterReactions from "@/components/ChapterReactions";
import CommentSection from "@/components/CommentSection";
import RecommendedSeries from "@/components/RecommendedSeries";

const WIDTH_CLASSES = {
  narrow: "max-w-2xl",
  standard: "max-w-4xl",
  wide: "max-w-5xl",
  full: "max-w-full",
};

function WebtoonPanel({ src, alt, eager, brightness }) {
  const imgRef = useRef(null);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const imgSrc =
    retryCount > 0
      ? `${src}${src.includes("?") ? "&" : "?"}retry=${retryCount}`
      : src;

  useEffect(() => {
    if (imgRef.current && imgRef.current.complete) {
      if (imgRef.current.naturalWidth > 0) {
        setLoaded(true);
      }
    }
  }, [imgSrc]);

  const handleRetry = (e) => {
    e.stopPropagation();
    setFailed(false);
    setLoaded(false);
    setRetryCount((c) => c + 1);
  };

  if (failed) {
    return (
      <div
        data-no-hud-toggle=""
        className="w-full min-h-[260px] flex flex-col items-center justify-center gap-3 bg-surface/80 border border-subtle text-center px-4 py-12"
      >
        <ImageOff className="h-8 w-8 text-ink-muted" aria-hidden="true" />
        <p className="text-sm text-ink-secondary">
          Görsel yüklenirken bir sorun oluştu.
        </p>
        <Button type="button" variant="secondary" size="sm" onClick={handleRetry}>
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          Tekrar Dene
        </Button>
      </div>
    );
  }

  return (
    <div
      className={`relative w-full ${
        !loaded ? "min-h-[240px] skeleton-shimmer bg-white/[0.04]" : ""
      }`}
    >
      <img
        ref={imgRef}
        src={imgSrc}
        alt={alt}
        loading={eager ? "eager" : "lazy"}
        decoding={eager ? "sync" : "async"}
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
        style={{
          filter: brightness < 100 ? `brightness(${brightness / 100})` : undefined,
        }}
        className="w-full h-auto block select-none"
      />
    </div>
  );
}

export default function WebtoonReadingClient({
  seriesId,
  episodeId,
  initialEpisode = null,
  initialEpisodes = [],
}) {
  const [episode, setEpisode] = useState(initialEpisode);
  const [allEpisodes, setAllEpisodes] = useState(initialEpisodes);
  const [loading, setLoading] = useState(!initialEpisode);
  const [error, setError] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState(DEFAULT_WEBTOON_SETTINGS);
  const [scrollPct, setScrollPct] = useState(0);
  const [commentCount, setCommentCount] = useState(
    initialEpisode?.comment_count ?? 0
  );

  const prefetchedNextRef = useRef(null);
  const lastSavedPctRef = useRef(-1);

  const { hydrated, getSeriesProgress, recordChapterRead, updateScrollProgress } =
    useReadingHistory();

  useEffect(() => {
    setSettings(loadWebtoonSettings());
  }, []);

  // Load episode (and always fire lightweight credentialed view-count ping on mount!)
  useEffect(() => {
    if (!episodeId) return;
    let cancelled = false;

    const loadData = async () => {
      if (!initialEpisode) {
        setLoading(true);
        setError(null);
      }

      try {
        const res = await apiFetch(`/episodes/${encodeRouteParam(episodeId)}`, {
          cache: "no-store",
          credentials: "include",
        });

        if (res.ok) {
          const fresh = await res.json();
          if (!cancelled) {
            setEpisode(fresh);
            setError(null);
          }
        } else if (!initialEpisode && !cancelled) {
          setError("Bölüm bulunamadı veya yüklenemedi.");
        }
      } catch (err) {
        console.error("Bölüm yükleme hatası:", err);
        if (!initialEpisode && !cancelled) {
          setError("Bölüm yüklenirken bağlantı hatası oluştu.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadData();
    return () => {
      cancelled = true;
    };
  }, [episodeId, initialEpisode]);

  // Fetch chapter list for switcher if not already passed
  useEffect(() => {
    if (!seriesId || initialEpisodes.length > 0) return;
    let cancelled = false;

    apiFetch(`/webtoons/${encodeRouteParam(seriesId)}`, { cache: "force-cache" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data?.episodes) {
          const sorted = [...data.episodes].sort(
            (a, b) => Number(b.episode_number) - Number(a.episode_number)
          );
          setAllEpisodes(sorted);
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [seriesId, initialEpisodes.length]);

  const seriesSlugOrId = episode?.webtoon_slug || seriesId;

  // Record chapter visit in readingHistory
  useEffect(() => {
    if (!episode || !episode.webtoon_id) return;
    recordChapterRead({
      type: "webtoon",
      seriesType: episode.series_type || "WEBTOON",
      seriesId: episode.webtoon_id,
      slug: String(seriesSlugOrId),
      title: episode.webtoon_title || "",
      coverImage: episode.webtoon_cover || "",
      lastChapterId: episode.id,
      lastChapterNumber: formatChapterNumber(episode.episode_number),
      lastChapterTitle: episode.title,
      lastChapterUrl: `/webtoon/${seriesSlugOrId}/bolum/${episode.id}`,
      chapterKey: episode.id,
    });
  }, [episode?.id, episode?.webtoon_id, seriesSlugOrId, recordChapterRead]);

  // Track scroll progress + prefetch next chapter images at >= 80%
  useEffect(() => {
    if (!episode) return;

    const onScroll = () => {
      const maxScroll =
        document.documentElement.scrollHeight - window.innerHeight;
      const pct =
        maxScroll > 0
          ? Math.min(100, Math.max(0, Math.round((window.scrollY / maxScroll) * 100)))
          : 100;
      setScrollPct(pct);

      if (
        episode.webtoon_id &&
        Math.abs(pct - lastSavedPctRef.current) >= 5
      ) {
        lastSavedPctRef.current = pct;
        updateScrollProgress("webtoon", episode.webtoon_id, pct, {
          lastChapterId: episode.id,
          lastChapterNumber: formatChapterNumber(episode.episode_number),
        });
      }

      if (
        pct >= 80 &&
        episode.next_episode_id &&
        prefetchedNextRef.current !== episode.next_episode_id
      ) {
        prefetchedNextRef.current = episode.next_episode_id;
        apiFetch(`/episodes/${episode.next_episode_id}`, {
          cache: "force-cache",
        })
          .then((res) => (res.ok ? res.json() : null))
          .then((nextEp) => {
            if (nextEp?.images && Array.isArray(nextEp.images)) {
              nextEp.images.slice(0, 2).forEach((rawUrl) => {
                const img = new window.Image();
                img.src = resolveMediaUrl(rawUrl);
              });
            }
          })
          .catch(() => {});
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, [episode, updateScrollProgress]);

  const seriesHref = `/webtoon/${seriesSlugOrId}`;
  const prevHref = episode?.prev_episode_id
    ? `${seriesHref}/bolum/${episode.prev_episode_id}`
    : null;
  const nextHref = episode?.next_episode_id
    ? `${seriesHref}/bolum/${episode.next_episode_id}`
    : null;

  const seriesType = seriesTypeLabel(episode?.series_type);

  const chapterOptions = useMemo(
    () =>
      allEpisodes.map((ep) => ({
        value: ep.id,
        number: formatChapterNumber(ep.episode_number),
        title: ep.title,
        href: `${seriesHref}/bolum/${ep.id}`,
      })),
    [allEpisodes, seriesHref]
  );

  // Build nearby episodes link strip (first, ±5 around current, latest) for SSR internal linking
  const nearbyEpisodeLinks = useMemo(() => {
    if (!allEpisodes || allEpisodes.length <= 1 || !episode) return [];
    const asc = [...allEpisodes].sort(
      (a, b) => Number(a.episode_number) - Number(b.episode_number)
    );
    const currentIdx = asc.findIndex(
      (e) => String(e.id) === String(episode.id)
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
        const num = formatChapterNumber(item.episode_number);
        return {
          id: item.id,
          num,
          href: `${seriesHref}/bolum/${item.id}`,
          active: String(item.id) === String(episode.id),
        };
      });
  }, [allEpisodes, episode, seriesHref]);

  const progressEntry =
    hydrated && episode?.webtoon_id
      ? getSeriesProgress("webtoon", episode.webtoon_id)
      : null;

  const handleSettingsChange = (next) => {
    setSettings(next);
    saveWebtoonSettings(next);
  };

  const handleResetSettings = () => {
    setSettings({ ...DEFAULT_WEBTOON_SETTINGS });
    saveWebtoonSettings(DEFAULT_WEBTOON_SETTINGS);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-canvas flex flex-col items-center justify-center gap-4 px-4">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-[520px] w-full max-w-2xl rounded-xl" />
      </div>
    );
  }

  if (error || !episode) {
    return (
      <div className="min-h-screen bg-canvas flex flex-col items-center justify-center text-center gap-4 px-4">
        <p className="text-ink-secondary">
          {error || "Bölüm bulunamadı."}
        </p>
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="secondary"
            onClick={() => window.location.reload()}
          >
            Tekrar Dene
          </Button>
          <Link
            href={seriesHref}
            className="text-sm font-semibold text-accent hover:underline"
          >
            Seriye Dön
          </Link>
        </div>
      </div>
    );
  }

  const epNumStr = formatChapterNumber(episode.episode_number);
  const customTitle =
    episode.title && !isAutoChapterTitle(episode.title) ? episode.title : null;

  return (
    <ReaderShell
      seriesType={seriesType}
      readerTheme={settings.theme}
      seriesTitle={episode.webtoon_title}
      seriesHref={seriesHref}
      chapterLabel={`Bölüm ${epNumStr}`}
      chapterSubLabel={`${episode.images?.length || 0} Sayfa`}
      chapters={chapterOptions}
      currentChapterValue={episode.id}
      readChapterIds={progressEntry?.readChapterIds || []}
      prevHref={prevHref}
      nextHref={nextHref}
      onOpenSettings={() => setSettingsOpen(true)}
      settingsOpen={settingsOpen}
      scrollPct={scrollPct}
    >
      {/* Restored Modern ReadingHero */}
      <ReadingHero
        type="webtoon"
        title={`Bölüm ${epNumStr}`}
        subtitle={customTitle}
        seriesTitle={episode.webtoon_title}
        coverImage={episode.webtoon_cover}
        viewCount={episode.view_count}
        commentCount={commentCount}
        date={episode.created_at}
        slug={seriesSlugOrId}
      />

      {/* Panel Strip */}
      <div
        className={`mx-auto w-full mt-4 transition-[max-width] duration-200 ${
          WIDTH_CLASSES[settings.widthPreset] || WIDTH_CLASSES.standard
        }`}
      >
        <div
          className={`flex flex-col ${settings.panelGap ? "gap-4 px-2 sm:px-0" : "gap-0"}`}
        >
          {episode.images && episode.images.length > 0 ? (
            episode.images.map((rawUrl, index) => (
              <WebtoonPanel
                key={`${episode.id}-${index}`}
                src={resolveMediaUrl(rawUrl)}
                alt={`${episode.webtoon_title} Bölüm ${epNumStr} Sayfa ${index + 1}`}
                eager={index < 3}
                brightness={settings.brightness}
              />
            ))
          ) : (
            <div className="py-24 text-center text-ink-muted text-sm">
              Bu bölüme henüz görsel yüklenmemiş.
            </div>
          )}
        </div>
      </div>

      {/* Post-Chapter Footer (Navigation + Engagement + Recommendations) */}
      <div className="bg-canvas text-ink-primary border-t border-subtle mt-10">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <p className="text-xs text-ink-muted text-center mb-4">
            <strong className="text-ink-secondary font-semibold">
              {episode.webtoon_title}
            </strong>{" "}
            serisinin{" "}
            <strong className="text-ink-secondary font-semibold">
              {epNumStr}. bölümünü
            </strong>
            {customTitle ? ` (${customTitle})` : ""} (
            {episode.images?.length || 0} sayfa) Türkçe olarak okuyorsunuz.
          </p>

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

          {/* Nearby Episodes Strip for Quick Navigation & Deep Crawlability */}
          {nearbyEpisodeLinks.length > 1 && (
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
                  Tüm Bölümler ({allEpisodes.length})
                </Link>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {nearbyEpisodeLinks.map((item) => (
                  <Link
                    key={item.id}
                    href={item.href}
                    prefetch={false}
                    title={`${episode.webtoon_title || "Seri"} Bölüm ${item.num} Oku`}
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
            <ChapterReactions type="webtoon" targetId={episode.id} />
          </div>

          <div id="yorumlar" className="mt-4 scroll-mt-16">
            <CommentSection
              type="webtoon"
              itemId={episode.webtoon_id}
              episodeId={episode.id}
              onCountChange={setCommentCount}
            />
          </div>

          <RecommendedSeries type="webtoon" currentId={episode.webtoon_id} />
        </div>
      </div>

      <ReadingSettingsSheet
        mode="webtoon"
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        onChange={handleSettingsChange}
        onReset={handleResetSettings}
      />
    </ReaderShell>
  );
}
