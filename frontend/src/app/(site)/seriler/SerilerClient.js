"use client";

import { useState, useEffect, useMemo } from "react";
import { Layers, RotateCcw } from "lucide-react";
import { apiFetch } from "@/lib/apiClient";
import SeriesCard, { SeriesCardSkeleton } from "@/components/SeriesCard";
import { Button } from "@/components/ui";

const LETTERS = [
  "Tümü",
  "A",
  "B",
  "C",
  "Ç",
  "D",
  "E",
  "F",
  "G",
  "H",
  "I",
  "İ",
  "J",
  "K",
  "L",
  "M",
  "N",
  "O",
  "Ö",
  "P",
  "R",
  "S",
  "Ş",
  "T",
  "U",
  "Ü",
  "V",
  "Y",
  "Z",
  "#",
];

const FORMAT_TABS = [
  { value: "ALL", label: "Tümü" },
  { value: "WEBTOON", label: "Webtoon" },
  { value: "MANGA", label: "Manga" },
  { value: "NOVEL", label: "Novel" },
];

function buildSortedSeries(webtoonData = [], novelData = []) {
  const formattedWebtoons = (
    Array.isArray(webtoonData) ? webtoonData : []
  ).map((w) => {
    const isManga = String(w.type || "")
      .toUpperCase()
      .includes("MANGA");
    return {
      ...w,
      typeLabel: isManga ? "MANGA" : "WEBTOON",
      linkPath: "webtoon",
    };
  });

  const formattedNovels = (Array.isArray(novelData) ? novelData : []).map(
    (n) => ({
      ...n,
      typeLabel: "NOVEL",
      linkPath: "novel",
    })
  );

  return [...formattedWebtoons, ...formattedNovels].sort((a, b) =>
    String(a.title || "").localeCompare(String(b.title || ""), "tr")
  );
}

export default function SerilerClient({
  initialWebtoons = [],
  initialNovels = [],
}) {
  const initialCombined = useMemo(
    () => buildSortedSeries(initialWebtoons, initialNovels),
    [initialWebtoons, initialNovels]
  );
  const hasInitialData = initialCombined.length > 0;

  const [seriesList, setSeriesList] = useState(initialCombined);
  const [loading, setLoading] = useState(!hasInitialData);
  const [formatFilter, setFormatFilter] = useState("ALL");
  const [activeLetter, setActiveLetter] = useState("Tümü");

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
        setSeriesList(buildSortedSeries(webtoonData, novelData));
      } catch (err) {
        console.error("Veriler çekilemedi:", err);
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
    return seriesList.filter((item) => {
      if (formatFilter !== "ALL" && item.typeLabel !== formatFilter) {
        return false;
      }
      if (activeLetter !== "Tümü") {
        const firstChar = String(item.title || "")
          .trim()
          .charAt(0)
          .toLocaleUpperCase("tr-TR");
        if (activeLetter === "#") {
          return !/^[A-ZÇĞİÖŞÜ]$/i.test(firstChar);
        }
        return firstChar === activeLetter;
      }
      return true;
    });
  }, [seriesList, formatFilter, activeLetter]);

  return (
    <div className="min-h-screen pb-16 font-sans">
      {/* HEADER */}
      <div className="bg-surface/80 border-b border-subtle pt-8 pb-6 px-4 sm:px-6">
        <div className="container mx-auto max-w-7xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-ink-primary flex items-center gap-3 tracking-tight">
                <span className="bg-brand/15 border border-brand/30 text-brand w-10 h-10 rounded-xl flex items-center justify-center shadow-sm">
                  <Layers className="h-5 w-5" />
                </span>
                <span>Tüm Seriler</span>
              </h1>
              <p className="text-ink-secondary text-sm mt-1.5">
                Arşivimizdeki toplam{" "}
                <strong className="text-ink-primary font-bold">
                  {loading ? "..." : seriesList.length}
                </strong>{" "}
                webtoon, manga ve novel alfabetik olarak listeleniyor.
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

          {/* A-Z Quick Jump Strip */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {LETTERS.map((letter) => {
              const active = activeLetter === letter;
              return (
                <button
                  key={letter}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setActiveLetter(letter)}
                  className={`min-w-[32px] h-8 px-2.5 rounded-lg text-xs font-bold transition-all border ${
                    active
                      ? "bg-purple-600 text-white border-purple-500 shadow-sm"
                      : "bg-canvas text-ink-secondary border-subtle hover:border-hover hover:text-ink-primary"
                  }`}
                >
                  {letter}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* GRID */}
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 py-8">
        <h2 className="sr-only">Seri Kataloğu</h2>
        <div className="mb-6 flex items-center justify-between text-xs sm:text-sm text-ink-secondary">
          <span>
            Gösterilen:{" "}
            <strong className="text-ink-primary font-bold">
              {loading ? "..." : filteredSeries.length}
            </strong>{" "}
            seri
          </span>
          {(formatFilter !== "ALL" || activeLetter !== "Tümü") && (
            <button
              type="button"
              onClick={() => {
                setFormatFilter("ALL");
                setActiveLetter("Tümü");
              }}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand hover:text-purple-300"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Filtreyi Sıfırla</span>
            </button>
          )}
        </div>

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-x-4 gap-y-8 sm:gap-x-5 sm:gap-y-9">
            {Array.from({ length: 10 }).map((_, idx) => (
              <SeriesCardSkeleton key={idx} />
            ))}
          </div>
        ) : filteredSeries.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-x-4 gap-y-8 sm:gap-x-5 sm:gap-y-9">
            {filteredSeries.map((item, idx) => (
              <SeriesCard
                key={`${item.typeLabel}-${item.id}`}
                series={item}
                priority={idx < 4}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center border border-dashed border-subtle rounded-3xl bg-surface/60">
            <Layers className="h-8 w-8 text-ink-muted mb-3" />
            <h3 className="text-base font-bold text-ink-primary mb-1">
              Bu harf veya formatta seri bulunamadı
            </h3>
            <p className="text-ink-secondary text-sm mb-5">
              Farklı bir harf seçebilir veya filtreyi sıfırlayabilirsin.
            </p>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setFormatFilter("ALL");
                setActiveLetter("Tümü");
              }}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Tümünü Göster</span>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
