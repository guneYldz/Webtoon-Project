"use client";

import Link from "next/link";
import {
  BookOpen,
  Play,
  Eye,
  Layers,
  PenTool,
  RotateCcw,
} from "lucide-react";
import { resolveMediaUrl } from "@/lib/apiClient";
import { seriesTypeLabel, seriesKindTr } from "@/lib/seriesType";
import { formatChapterNumber } from "@/lib/chapterTitle";
import { useReadingHistory } from "@/lib/readingHistory";
import { Badge, badgeVariantFromSeriesType, buttonClasses } from "@/components/ui";
import Breadcrumbs from "@/components/Breadcrumbs";
import FavoriteButton from "@/components/FavoriteButton";
import SeriesSummary from "@/components/SeriesSummary";
import ChapterDirectory from "@/components/ChapterDirectory";

/**
 * Unified Series Detail view for Webtoon, Manga, and Novel.
 */
export default function SeriesDetailView({ series, type = "webtoon", routeKey }) {
  const { hydrated, getSeriesProgress } = useReadingHistory();

  if (!series) return null;

  const isNovel = type === "novel";
  const normalizedType = isNovel
    ? "NOVEL"
    : seriesTypeLabel(series.type, series.typeLabel);
  const kindLabel = seriesKindTr(series.type, isNovel ? "NOVEL" : series.typeLabel);
  const slugOrId = routeKey || series.slug || series.id;
  const basePath = isNovel ? `/novel/${slugOrId}` : `/webtoon/${slugOrId}`;

  const rawChapters = isNovel ? series.chapters || [] : series.episodes || [];
  const sortedAsc = [...rawChapters].sort((a, b) => {
    const na = Number(isNovel ? a.chapter_number : a.episode_number) || 0;
    const nb = Number(isNovel ? b.chapter_number : b.episode_number) || 0;
    return na - nb;
  });

  const firstItem = sortedAsc[0] || null;
  const firstHref = firstItem
    ? isNovel
      ? `${basePath}/bolum/${firstItem.chapter_number}`
      : `${basePath}/bolum/${firstItem.id}`
    : null;
  const firstNum = firstItem
    ? formatChapterNumber(
        isNovel ? firstItem.chapter_number : firstItem.episode_number
      )
    : null;

  const progress = hydrated ? getSeriesProgress(type, series.id) : null;
  const continueHref = progress?.lastChapterUrl || null;
  const continueNum = progress?.lastChapterNumber
    ? formatChapterNumber(progress.lastChapterNumber)
    : null;

  const coverUrl = resolveMediaUrl(series.cover_image);

  const isOngoing = series.status === "ongoing";

  return (
    <div data-series-type={normalizedType} className="min-h-screen pb-20">
      {/* Hero Banner & Metadata */}
      <div className="relative -mt-16 md:-mt-[68px] pt-16 md:pt-[68px] w-full overflow-hidden border-b border-subtle">
        {/* Luminous Full-Bleed Cover-Tinted Backdrop */}
        {series.cover_image && (
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-cover bg-center scale-110 blur-3xl saturate-150 brightness-90 opacity-45 md:opacity-50 pointer-events-none"
            style={{ backgroundImage: `url(${coverUrl})` }}
          />
        )}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-b from-canvas/30 via-canvas/70 to-canvas pointer-events-none"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 90% 70% at 50% 20%, transparent 25%, rgba(11, 11, 15, 0.72) 100%)",
          }}
        />

        <div className="relative container mx-auto max-w-7xl px-4 pt-6 pb-12 z-10">
          <Breadcrumbs
            items={[
              { label: "Anasayfa", href: "/" },
              {
                label: isNovel
                  ? "Noveller"
                  : normalizedType === "MANGA"
                  ? "Mangalar"
                  : "Webtoonlar",
                href: "/seriler",
              },
              { label: series.title, href: null },
            ]}
          />

          <div className="flex flex-col md:flex-row gap-8 lg:gap-10 items-center md:items-start mt-2">
            {/* Poster */}
            <div className="w-44 sm:w-52 md:w-64 shrink-0 rounded-xl overflow-hidden ring-1 ring-inset ring-white/10 shadow-2xl bg-surface aspect-[2/3]">
              <img
                src={coverUrl}
                alt={`${series.title} ${kindLabel.toLowerCase()} kapağı`}
                className="w-full h-full object-cover"
              />
            </div>

            {/* Info & Actions */}
            <div className="flex-1 min-w-0 text-center md:text-left">
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 mb-3">
                <Badge
                  variant={badgeVariantFromSeriesType(normalizedType)}
                  tone="solid"
                >
                  {kindLabel}
                </Badge>
                <Badge variant={isOngoing ? "ongoing" : "completed"} dot>
                  {isOngoing ? "Devam Ediyor" : "Tamamlandı"}
                </Badge>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-elevated/80 border border-subtle text-xs font-medium text-ink-secondary">
                  <Eye className="h-3.5 w-3.5 text-ink-muted" aria-hidden="true" />
                  {(series.view_count || 0).toLocaleString("tr-TR")}
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-elevated/80 border border-subtle text-xs font-medium text-ink-secondary">
                  <Layers className="h-3.5 w-3.5 text-ink-muted" aria-hidden="true" />
                  {rawChapters.length} Bölüm
                </span>
                {series.author && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-elevated/80 border border-subtle text-xs font-medium text-ink-secondary">
                    <PenTool className="h-3.5 w-3.5 text-ink-muted" aria-hidden="true" />
                    {series.author}
                  </span>
                )}
              </div>

              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-ink-primary drop-shadow-md mb-4">
                {series.title}
              </h1>

              {/* Clickable Categories */}
              {Array.isArray(series.categories) && series.categories.length > 0 && (
                <div className="flex flex-wrap justify-center md:justify-start gap-2 mb-6">
                  {series.categories.map((cat) => (
                    <Link
                      key={cat.id || cat.name}
                      href={`/kesfet?category=${encodeURIComponent(cat.name)}`}
                      className="px-3 py-1 rounded-full bg-elevated/90 border border-subtle text-xs font-medium text-ink-secondary hover:text-ink-primary hover:border-accent-border hover:bg-accent-soft transition"
                    >
                      {cat.name}
                    </Link>
                  ))}
                </div>
              )}

              {/* Primary CTA Row */}
              <div className="flex flex-wrap justify-center md:justify-start gap-3 mb-7">
                {continueHref ? (
                  <>
                    <Link
                      href={continueHref}
                      className={buttonClasses({
                        variant: "accent",
                        size: "lg",
                        className: "shadow-lg",
                      })}
                    >
                      <Play className="h-4 w-4 fill-current" aria-hidden="true" />
                      <span>Devam Et: Bölüm {continueNum}</span>
                    </Link>
                    {firstHref && (
                      <Link
                        href={firstHref}
                        className={buttonClasses({
                          variant: "secondary",
                          size: "lg",
                        })}
                      >
                        <RotateCcw className="h-4 w-4" aria-hidden="true" />
                        <span>İlk Bölüm ({firstNum})</span>
                      </Link>
                    )}
                  </>
                ) : firstHref ? (
                  <Link
                    href={firstHref}
                    className={buttonClasses({
                      variant: "accent",
                      size: "lg",
                      className: "shadow-lg",
                    })}
                    title={`${series.title} Türkçe ${kindLabel} Oku`}
                  >
                    <BookOpen className="h-4 w-4" aria-hidden="true" />
                    <span>Okumaya Başla (Bölüm {firstNum})</span>
                  </Link>
                ) : null}

                <FavoriteButton type={type} id={series.id} />
              </div>

              <SeriesSummary text={series.summary} boxed />
            </div>
          </div>
        </div>
      </div>

      {/* Chapters Section */}
      <div className="container mx-auto max-w-7xl px-4 py-10">
        <div className="flex items-center justify-between gap-4 border-b border-subtle pb-4 mb-6">
          <h2 className="text-xl sm:text-2xl font-bold text-ink-primary flex items-center gap-2.5">
            <span className="w-1.5 h-6 rounded-full bg-accent" aria-hidden="true" />
            <span>Bölümler</span>
          </h2>
          <span className="text-xs font-semibold text-ink-secondary bg-surface px-3 py-1.5 rounded-lg border border-subtle tabular-nums">
            {rawChapters.length} Bölüm
          </span>
        </div>

        <ChapterDirectory
          items={rawChapters}
          type={type}
          seriesId={series.id}
          basePath={basePath}
          perPage={30}
        />
      </div>
    </div>
  );
}
