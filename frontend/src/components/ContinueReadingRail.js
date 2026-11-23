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
    <section className="mb-12 animate-fade-in">
      <div className="flex items-center justify-between mb-4 pb-2.5 border-b border-subtle">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand/15 border border-brand/30 text-brand">
            <History className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-ink-primary tracking-tight">
              Okumaya Devam Et
            </h2>
          </div>
        </div>

        <button
          type="button"
          onClick={clearReadingHistory}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-muted hover:text-rose-400 transition-colors"
          title="Okuma geçmişini temizle"
        >
          <Trash2 className="h-3.5 w-3.5" />
          <span>Temizle</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {visibleItems.map((entry) => {
          const coverUrl = resolveMediaUrl(entry.coverImage);
          const badgeVariant = badgeVariantFromSeriesType(entry.seriesType);
          const progress = Math.max(4, Math.min(100, entry.scrollPct || 0));

          return (
            <div
              key={`${entry.type}:${entry.seriesId}`}
              className="group relative flex items-center gap-3.5 rounded-xl border border-subtle bg-surface/90 hover:bg-elevated hover:border-brand/40 p-2.5 transition-all duration-200 shadow-md"
            >
              {/* 2:3 Mini Cover */}
              <Link
                href={entry.lastChapterUrl}
                className="relative aspect-[2/3] w-14 shrink-0 overflow-hidden rounded-lg bg-canvas ring-1 ring-white/10"
              >
                <Image
                  src={coverUrl}
                  alt={entry.title}
                  fill
                  sizes="56px"
                  className="object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </Link>

              {/* Metadata & Progress */}
              <div className="min-w-0 flex-1 pr-5">
                <div className="flex items-center gap-1.5 mb-1">
                  <Badge variant={badgeVariant} size="sm">
                    {entry.seriesType}
                  </Badge>
                </div>

                <Link
                  href={entry.lastChapterUrl}
                  className="block font-bold text-sm text-ink-primary truncate group-hover:text-brand transition-colors"
                  title={entry.title}
                >
                  {entry.title}
                </Link>

                <Link
                  href={entry.lastChapterUrl}
                  className="mt-1 inline-flex items-center gap-1.5 text-xs font-semibold text-ink-secondary group-hover:text-ink-primary transition-colors"
                >
                  <Play className="h-3 w-3 text-brand fill-brand" />
                  <span>
                    Bölüm {formatChapterNumber(entry.lastChapterNumber)}
                  </span>
                  {entry.scrollPct > 0 && (
                    <span className="text-[11px] text-ink-muted font-normal">
                      • %{entry.scrollPct}
                    </span>
                  )}
                </Link>

                {/* Progress Bar */}
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.07]">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-brand to-indigo-500 transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>

              {/* Remove from history button */}
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  removeSeriesProgress(entry.type, entry.seriesId);
                }}
                className="absolute top-2 right-2 inline-flex h-6 w-6 items-center justify-center rounded-md text-ink-muted hover:text-ink-primary hover:bg-white/10 opacity-70 group-hover:opacity-100 transition"
                aria-label={`${entry.title} geçmişini kaldır`}
                title="Listeden kaldır"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
