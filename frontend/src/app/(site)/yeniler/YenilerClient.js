"use client";

import { useState, useEffect, useMemo } from "react";
import { Sparkles } from "lucide-react";
import { apiFetch } from "@/lib/apiClient";
import SeriesCard, { SeriesCardSkeleton } from "@/components/SeriesCard";

const FORMAT_TABS = [
  { value: "ALL", label: "Tümü" },
  { value: "WEBTOON", label: "Webtoon" },
  { value: "MANGA", label: "Manga" },
  { value: "NOVEL", label: "Novel" },
];

function buildNewestSeries(webtoonData = [], novelData = []) {
  const formattedWebtoons = (
    Array.isArray(webtoonData) ? webtoonData : []
  ).map((w, idx, arr) => {
    const isManga = String(w.type || "")
      .toUpperCase()
      .includes("MANGA");
    return {
      ...w,
      typeLabel: isManga ? "MANGA" : "WEBTOON",
      linkPath: "webtoon",
      isNew: idx >= arr.length - 6,
    };
  });

  const formattedNovels = (Array.isArray(novelData) ? novelData : []).map(
    (n, idx, arr) => ({
      ...n,
      typeLabel: "NOVEL",
      linkPath: "novel",
      isNew: idx >= arr.length - 6,
    })
  );

  const getCreatedTimestamp = (item) => {
    const ts = new Date(item.created_at || 0).getTime();
    if (Number.isFinite(ts) && ts > 0) return ts;
    return Number(item.id) || 0;
  };

  return [...formattedWebtoons, ...formattedNovels].sort(
    (a, b) => getCreatedTimestamp(b) - getCreatedTimestamp(a)
  );
}

export default function YenilerClient({
  initialWebtoons = [],
  initialNovels = [],
}) {
  const initialCombined = useMemo(
    () => buildNewestSeries(initialWebtoons, initialNovels),
    [initialWebtoons, initialNovels]
  );
  const hasInitialData = initialCombined.length > 0;

  const [seriesList, setSeriesList] = useState(initialCombined);
  const [loading, setLoading] = useState(!hasInitialData);
  const [formatFilter, setFormatFilter] = useState("ALL");

  useEffect(() => {
    if (hasInitialData) return;
    let active = true;
    const fetchData = async () => {
      try {
        const [webtoonRes, novelRes] = await Promise.all([
          apiFetch("/webtoons/?limit=1000"),
          apiFetch("/novels/?limit=1000"),
        ]);

        const webtoonData = webtoonRes.ok ? await webtoonRes.json() : [];
        const novelData = novelRes.ok ? await novelRes.json() : [];

        if (!active) return;
        setSeriesList(buildNewestSeries(webtoonData, novelData));
      } catch (err) {
        console.error("Veri çekme hatası:", err);
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchData();
    return () => {
      active = false;
    };
  }, [hasInitialData]);

  const filteredSeries = useMemo(() => {
    if (formatFilter === "ALL") return seriesList;
    return seriesList.filter((item) => item.typeLabel === formatFilter);
  }, [seriesList, formatFilter]);

  return (
    <div className="min-h-screen pb-16 font-sans">
      {/* HEADER */}
      <div className="bg-surface/80 border-b border-subtle pt-8 pb-6 px-4 sm:px-6">
        <div className="container mx-auto max-w-7xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-ink-primary flex items-center gap-3 tracking-tight">
              <span className="bg-brand/15 border border-brand/30 text-brand w-10 h-10 rounded-xl flex items-center justify-center shadow-sm">
                <Sparkles className="h-5 w-5" />
              </span>
              <span>Yeni Eklenenler</span>
            </h1>
            <p className="text-ink-secondary text-sm mt-1.5">
              Kaos Manga kütüphanesine eklenen en yeni webtoon, manga ve novel serileri.
            </p>
          </div>

          <div
            role="group"
            aria-label="Format filtresi"
            className="inline-flex items-center gap-1 rounded-xl border border-subtle bg-surface p-1 self-start sm:self-auto"
          >
            {FORMAT_TABS.map((t) => {
              const active = formatFilter === t.value;
              return (
                <button
                  key={t.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setFormatFilter(t.value)}
                  className={`inline-flex items-center justify-center whitespace-nowrap rounded-lg px-3.5 py-1.5 text-sm font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 ${
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
      </div>

      {/* GRID */}
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 py-8">
        <h2 className="sr-only">Yeni Eklenen Seriler</h2>
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-x-4 gap-y-8 sm:gap-x-5 sm:gap-y-9">
            {Array.from({ length: 10 }).map((_, idx) => (
              <SeriesCardSkeleton key={idx} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-x-4 gap-y-8 sm:gap-x-5 sm:gap-y-9">
            {filteredSeries.map((item) => (
              <SeriesCard
                key={`${item.typeLabel}-${item.id}`}
                series={item}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
