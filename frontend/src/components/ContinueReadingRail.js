"use client";

import Link from "next/link";
import Image from "next/image";
import { Play, X, History, Trash2 } from "lucide-react";
import { useReadingHistory } from "@/lib/readingHistory";
import { resolveMediaUrl } from "@/lib/apiClient";
import { formatChapterNumber } from "@/lib/chapterTitle";
import { Badge, badgeVariantFromSeriesType } from "@/components/ui";

export default function ContinueReadingRail() {
  const { items, hydrated, removeSeriesProgress, clearReadingHistory } =
    useReadingHistory();

  if (!hydrated || !items || items.length === 0) {
    return null;
  }

  const visibleItems = items.slice(0, 8);

  return (
    <section className="mb-6 sm:mb-8 animate-fade-in">
      <div className="flex items-center justify-between mb-2.5 pb-2 border-b border-subtle">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-md bg-brand/15 border border-brand/30 text-brand">
            <History className="h-3.5 w-3.5" />
          </div>
          <h2 className="text-sm sm:text-base font-bold text-ink-primary tracking-tight">
            Okumaya Devam Et
          </h2>
        </div>

        <button
          type="button"
          onClick={clearReadingHistory}
          className="inline-flex items-center gap-1 text-[11px] sm:text-xs font-medium text-ink-muted hover:text-rose-400 transition-colors"
          title="Okuma geçmişini temizle"
        >
          <Trash2 className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
          <span>Temizle</span>
        </button>
      </div>

      {/* Strictly single-row swipeable horizontal rail on all screen sizes */}
      <div className="flex flex-nowrap overflow-x-auto snap-x snap-mandatory gap-2.5 sm:gap-3 scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0 pb-1">
        {visibleItems.map((entry) => {
          const coverUrl = resolveMediaUrl(entry.coverImage);
          const badgeVariant = badgeVariantFromSeriesType(entry.seriesType);
          const progress = Math.max(4, Math.min(100, entry.scrollPct || 0));

          return (
            <div
              key={`${entry.type}:${entry.seriesId}`}
              className="group relative w-[220px] sm:w-[260px] shrink-0 snap-start flex items-center gap-2.5 sm:gap-3 rounded-xl border border-subtle bg-surface/90 hover:bg-elevated hover:border-brand/40 p-2 sm:p-2.5 transition-all duration-200 shadow-sm"
            >
              {/* 2:3 Compact Cover */}
              <Link
                href={entry.lastChapterUrl}
                title={`${entry.title} - Bölüm ${formatChapterNumber(entry.lastChapterNumber)}`}
                className="relative aspect-[2/3] w-10 sm:w-12 shrink-0 overflow-hidden rounded-md bg-canvas ring-1 ring-white/10"
              >
                <Image
                  src={coverUrl}
                  alt={entry.title}
                  fill
                  sizes="48px"
                  className="object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </Link>

              {/* Compact Metadata & Progress */}
              <div className="min-w-0 flex-1 pr-4">
                <div className="flex items-center gap-1 mb-0.5">
                  <Badge
                    variant={badgeVariant}
                    size="sm"
                    className="!text-[9px] !px-1.5 !py-0"
                  >
                    {entry.seriesType}
                  </Badge>
                </div>

                <Link
                  href={entry.lastChapterUrl}
                  className="block font-bold text-xs sm:text-sm text-ink-primary truncate group-hover:text-brand transition-colors leading-tight"
                  title={entry.title}
                >
                  {entry.title}
                </Link>

                <Link
                  href={entry.lastChapterUrl}
                  title={`${entry.title} - Bölüm ${formatChapterNumber(entry.lastChapterNumber)}`}
                  className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-semibold text-ink-secondary group-hover:text-ink-primary transition-colors truncate max-w-full"
                >
                  <Play className="h-2.5 w-2.5 text-brand fill-brand shrink-0" />
                  <span className="truncate">
                    Bölüm {formatChapterNumber(entry.lastChapterNumber)}
                  </span>
                  {entry.scrollPct > 0 && (
                    <span className="text-[10px] text-ink-muted font-normal shrink-0">
                      • %{entry.scrollPct}
                    </span>
                  )}
                </Link>

                {/* Slim Progress Bar */}
                <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-white/[0.08]">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-brand to-indigo-500 transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>

              {/* Compact Remove Button */}
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  removeSeriesProgress(entry.type, entry.seriesId);
                }}
                className="absolute top-1.5 right-1.5 inline-flex h-5 w-5 items-center justify-center rounded-md text-ink-muted hover:text-ink-primary hover:bg-white/10 opacity-75 group-hover:opacity-100 transition"
                aria-label={`${entry.title} geçmişini kaldır`}
                title="Listeden kaldır"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
