"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Flame, Eye, Layers } from "lucide-react";
import { resolveMediaUrl } from "@/lib/apiClient";
import { formatTrNumber } from "@/lib/formatTr";
import SeriesCard from "@/components/SeriesCard";
import { Badge, badgeVariantFromSeriesType } from "@/components/ui";

const UPDATE_TABS = [
  { value: "ALL", label: "Tümü" },
  { value: "WEBTOON", label: "Webtoon" },
  { value: "MANGA", label: "Manga" },
  { value: "NOVEL", label: "Novel" },
];

const TREND_TABS = [
  { value: "ALL", label: "Tümü" },
  { value: "WEBTOON", label: "Webtoon" },
  { value: "NOVEL", label: "Novel" },
];

export default function HomeClientFeed({ allSeries = [], popularList = [] }) {
  const [updateFilter, setUpdateFilter] = useState("ALL");
  const [trendFilter, setTrendFilter] = useState("ALL");

  const filteredUpdates = useMemo(() => {
    if (updateFilter === "ALL") return allSeries;
    return allSeries.filter((item) => item.typeLabel === updateFilter);
  }, [allSeries, updateFilter]);

  const filteredTrends = useMemo(() => {
    const source =
      trendFilter === "ALL"
        ? allSeries
        : trendFilter === "NOVEL"
        ? allSeries.filter((item) => item.typeLabel === "NOVEL")
        : allSeries.filter(
            (item) => item.typeLabel === "WEBTOON" || item.typeLabel === "MANGA"
          );

    return [...source]
      .sort((a, b) => (b.view_count || 0) - (a.view_count || 0))
      .slice(0, 10);
  }, [allSeries, trendFilter]);

  return (
    <div className="flex flex-col lg:flex-row gap-10 items-start">
      {/* LEFT: Latest Updated Series Grid */}
      <div className="flex-1 w-full min-w-0">
        <section>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-3.5 border-b border-subtle">
            <div className="flex items-center gap-3">
              <span className="w-1.5 h-7 bg-gradient-to-b from-brand to-indigo-500 rounded-full inline-block" />
              <h2 className="text-xl sm:text-2xl font-bold text-ink-primary tracking-tight">
                Son Güncellenenler
              </h2>
              <span className="text-xs font-semibold text-ink-muted rounded-full bg-surface border border-subtle px-2.5 py-0.5">
                {filteredUpdates.length}
              </span>
            </div>

            <div className="flex items-center justify-between sm:justify-end gap-3">
              <div
                role="group"
                aria-label="Güncelleme format filtresi"
                className="inline-flex items-center gap-1 rounded-xl border border-subtle bg-surface p-1 overflow-x-auto"
              >
                {UPDATE_TABS.map((t) => {
                  const active = updateFilter === t.value;
                  return (
                    <button
                      key={t.value}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setUpdateFilter(t.value)}
                      className={`inline-flex items-center justify-center whitespace-nowrap rounded-lg text-xs px-2.5 py-1 font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 ${
                        active
                          ? "bg-elevated text-ink-primary shadow-sm ring-1 ring-white/10"
                          : "text-ink-secondary hover:text-ink-primary"
                      }`}
                    >
                      {t.label}
                    </button>
                  );
                })}
              </div>

              <Link
                href="/seriler"
                title="Tüm webtoon, manga ve novel serilerini gör"
                className="hidden xl:inline-flex items-center gap-1 text-xs font-semibold text-ink-secondary hover:text-brand transition-colors shrink-0"
              >
                <span>Tümünü Gör</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>

          {filteredUpdates.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-4 gap-y-8 sm:gap-x-5 sm:gap-y-9">
              {filteredUpdates.map((item, idx) => (
                <SeriesCard
                  key={`${item.typeLabel}-${item.id}`}
                  series={item}
                  variant="updates"
                  showLatestChapters={true}
                  priority={idx < 4}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-subtle bg-surface/60 py-16 text-center">
              <Layers className="h-8 w-8 text-ink-muted mb-2" />
              <p className="text-sm font-semibold text-ink-primary">
                Bu formatta henüz seri bulunmuyor.
              </p>
            </div>
          )}

          <div className="mt-8 flex justify-center xl:hidden">
            <Link
              href="/seriler"
              title="Tüm webtoon, manga ve novel serilerini görüntüle"
              className="inline-flex items-center gap-2 rounded-xl border border-subtle bg-surface hover:bg-elevated px-5 py-2.5 text-xs font-semibold text-ink-primary transition"
            >
              <span>Tüm Serileri Görüntüle</span>
              <ArrowRight className="h-3.5 w-3.5 text-brand" />
            </Link>
          </div>
        </section>
      </div>

      {/* RIGHT: Trending Podium Sidebar */}
      <aside className="w-full lg:w-80 xl:w-[340px] shrink-0">
        <div className="bg-surface/90 rounded-2xl border border-subtle p-5 sticky top-20 shadow-2xl">
          <div className="flex items-center justify-between gap-2 mb-4 pb-3 border-b border-subtle">
            <h2 className="text-base font-bold text-ink-primary flex items-center gap-2">
              <Flame className="h-4 w-4 text-brand" aria-hidden="true" />
              <span>Trend Listesi</span>
            </h2>

            <div
              role="group"
              aria-label="Trend format filtresi"
              className="inline-flex items-center gap-1 rounded-xl border border-subtle bg-surface p-0.5"
            >
              {TREND_TABS.map((t) => {
                const active = trendFilter === t.value;
                return (
                  <button
                    key={t.value}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setTrendFilter(t.value)}
                    className={`inline-flex items-center justify-center whitespace-nowrap rounded-lg text-[11px] px-2 py-1 font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 ${
                      active
                        ? "bg-elevated text-ink-primary shadow-sm ring-1 ring-white/10"
                        : "text-ink-secondary hover:text-ink-primary"
                    }`}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-2.5">
            {filteredTrends.map((w, index) => {
              const rank = index + 1;
              const isPodium = rank <= 3;
              const seriesHref = `/${w.linkPath}/${w.slug || w.id}`;
              const coverUrl = resolveMediaUrl(w.cover_image);
              const badgeVariant = badgeVariantFromSeriesType(w.typeLabel);

              return (
                <Link
                  key={`${w.typeLabel}-${w.id}`}
                  href={seriesHref}
                  title={w.title || "Seri"}
                  className={`flex items-center gap-3.5 rounded-xl p-2 transition-all duration-200 group ${
                    isPodium
                      ? "bg-elevated/70 hover:bg-elevated border border-white/[0.08] hover:border-brand/40"
                      : "hover:bg-white/[0.04] border border-transparent"
                  }`}
                >
                  {/* Rank Badge */}
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center font-black text-xs shrink-0 ${
                      rank === 1
                        ? "bg-gradient-to-br from-brand to-indigo-600 text-white shadow-sm shadow-purple-950"
                        : rank === 2
                        ? "bg-purple-500/20 text-purple-300 border border-purple-500/40"
                        : rank === 3
                        ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/40"
                        : "text-ink-muted font-bold"
                    }`}
                  >
                    {rank}
                  </div>

                  {/* Mini 2:3 Cover */}
                  <div className="relative aspect-[2/3] w-11 rounded-lg overflow-hidden shrink-0 bg-canvas ring-1 ring-white/10 group-hover:ring-brand/50 transition">
                    <Image
                      src={coverUrl}
                      alt={w.title}
                      fill
                      sizes="44px"
                      loading="lazy"
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>

                  {/* Title & Meta */}
                  <div className="flex flex-col justify-center min-w-0 flex-1">
                    <h3 className="text-xs sm:text-sm font-bold text-ink-primary group-hover:text-brand transition-colors truncate leading-snug">
                      {w.title}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant={badgeVariant} size="sm">
                        {w.typeLabel}
                      </Badge>
                      <span className="inline-flex items-center gap-1 text-[11px] text-ink-muted">
                        <Eye className="h-3 w-3" />
                        {formatTrNumber(w.view_count)}
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </aside>
    </div>
  );
}
