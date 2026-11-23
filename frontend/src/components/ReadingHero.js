"use client";

import Link from "next/link";
import { Calendar, Eye, MessageSquare, Clock, SlidersHorizontal } from "lucide-react";
import { resolveMediaUrl } from "@/lib/apiClient";
import { formatTrNumber, formatTrShortDate } from "@/lib/formatTr";

/**
 * Sleek, theme-aware chapter reading hero banner for Webtoon, Manga, and Novel readers.
 * Uses full-bleed blurred cover art fading smoothly into `var(--reader-bg, #0B0B0F)`.
 */
export default function ReadingHero({
  title,
  subtitle = null,
  seriesTitle,
  coverImage,
  viewCount = 0,
  commentCount = 0,
  date,
  readingMinutes = null,
  slug,
  type = "webtoon",
  onOpenSettings = null,
}) {
  const linkPath = type === "novel" ? "novel" : "webtoon";
  const seriesHref = `/${linkPath}/${slug}`;
  const finalImage = coverImage ? resolveMediaUrl(coverImage) : null;
  const formattedDate = formatTrShortDate(date, { withYear: true });

  const scrollToComments = () => {
    const el = document.getElementById("yorumlar");
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <section className="relative -mt-12 pt-16 pb-7 w-full overflow-hidden bg-[var(--reader-bg,#0B0B0F)] border-b border-[var(--reader-border,rgba(255,255,255,0.08))]">
      {/* Full-bleed blurred cover-art ambient backdrop */}
      {finalImage && (
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-cover bg-center scale-110 blur-3xl saturate-150 opacity-40 pointer-events-none"
          style={{ backgroundImage: `url(${finalImage})` }}
        />
      )}

      {/* Theme-harmonizing veil + vertical gradient fade into reader surface */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[var(--reader-bg,#0B0B0F)] opacity-45 pointer-events-none"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "linear-gradient(to bottom, transparent 10%, var(--reader-bg, #0B0B0F) 98%)",
        }}
      />

      <div className="relative z-10 max-w-3xl mx-auto px-4 flex flex-col items-center text-center gap-3">
        {/* Centered Breadcrumb */}
        <nav
          aria-label="Breadcrumb"
          className="flex flex-wrap items-center justify-center gap-1.5 text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-[var(--reader-muted,#A1A1AA)]"
        >
          <Link href="/" className="hover:text-[var(--reader-text,#F4F4F6)] transition">
            Anasayfa
          </Link>
          <span aria-hidden="true">/</span>
          <Link
            href={seriesHref}
            className="hover:text-accent transition max-w-[160px] sm:max-w-xs truncate"
          >
            {seriesTitle}
          </Link>
          <span aria-hidden="true">/</span>
          <span className="text-accent truncate max-w-[140px] sm:max-w-xs">
            {title}
          </span>
        </nav>

        {/* Crisp 2:3 Series Cover Poster */}
        {finalImage && (
          <Link
            href={seriesHref}
            title={`${seriesTitle || "Seri"} sayfasına git`}
            className="group block w-28 sm:w-36 md:w-40 aspect-[2/3] rounded-xl overflow-hidden shadow-2xl ring-1 ring-white/15 bg-surface transition-transform duration-300 hover:scale-[1.02]"
          >
            <img
              src={finalImage}
              alt={`${seriesTitle || title} kapağı`}
              loading="eager"
              className="w-full h-full object-cover"
            />
          </Link>
        )}

        {/* Titles */}
        <div className="space-y-1 max-w-2xl">
          <Link
            href={seriesHref}
            className="inline-block text-xs sm:text-sm font-bold uppercase tracking-wider text-accent hover:underline"
          >
            {seriesTitle}
          </Link>

          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-[var(--reader-text,#F4F4F6)] leading-tight">
            {title}
          </h1>

          {subtitle && (
            <p className="text-sm font-medium text-[var(--reader-muted,#A1A1AA)]">
              {subtitle}
            </p>
          )}
        </div>

        {/* Compact Stats & Quick Settings Row */}
        <div className="flex flex-wrap items-center justify-center gap-2 mt-1">
          <div className="inline-flex flex-wrap items-center justify-center gap-3 sm:gap-4 px-4 py-1.5 rounded-full bg-[var(--reader-surface,#13131A)]/85 backdrop-blur-md border border-[var(--reader-border,rgba(255,255,255,0.09))] text-xs font-medium text-[var(--reader-muted,#A1A1AA)] shadow-sm">
            {formattedDate && (
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
                <span>{formattedDate}</span>
              </span>
            )}
            <span className="inline-flex items-center gap-1.5 tabular-nums">
              <Eye className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
              <span>{formatTrNumber(viewCount)}</span>
            </span>
            <button
              type="button"
              onClick={scrollToComments}
              className="inline-flex items-center gap-1.5 tabular-nums hover:text-[var(--reader-text,#F4F4F6)] transition"
              title="Yorumlara git"
            >
              <MessageSquare className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
              <span>{formatTrNumber(commentCount)}</span>
            </button>
            {readingMinutes ? (
              <span className="inline-flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
                <span>~{readingMinutes} dk</span>
              </span>
            ) : null}
          </div>

          {onOpenSettings && (
            <button
              type="button"
              onClick={onOpenSettings}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[var(--reader-surface,#13131A)]/85 backdrop-blur-md border border-[var(--reader-border,rgba(255,255,255,0.09))] text-xs font-semibold text-[var(--reader-text,#F4F4F6)] hover:border-accent-border transition shadow-sm"
            >
              <SlidersHorizontal className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
              <span>Görünüm</span>
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
