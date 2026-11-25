"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { apiFetch, apiJson } from "@/lib/apiClient";
import SeriesCard, { SeriesCardSkeleton } from "@/components/SeriesCard";

export default function RecommendedSeries({
  type = "novel",
  currentId = null,
  items = null,
  limit = 6,
}) {
  const [recommendations, setRecommendations] = useState(
    Array.isArray(items) ? items.slice(0, limit) : []
  );
  const [loading, setLoading] = useState(!Array.isArray(items));

  useEffect(() => {
    if (Array.isArray(items)) {
      setRecommendations(items.slice(0, limit));
      setLoading(false);
      return;
    }

    let cancelled = false;
    const fetchRecommendations = async () => {
      try {
        const normalizedType = type === "novel" ? "novel" : "webtoon";
        let list = [];

        if (currentId !== null && currentId !== undefined && currentId !== "") {
          const recRes = await apiFetch(
            `/recommendations/${normalizedType}/${encodeURIComponent(
              String(currentId)
            )}?limit=${limit}`,
            { cache: "no-store" }
          );
          if (recRes.ok) {
            const recData = await recRes.json();
            list = Array.isArray(recData) ? recData : recData?.data || [];
          }
        }

        // Graceful fallback if recommendations endpoint returns empty or currentId is omitted
        if (list.length === 0) {
          const fallbackEndpoint =
            normalizedType === "novel"
              ? `/novels/?limit=${limit + 3}`
              : `/webtoons/?limit=${limit + 3}`;
          const fallbackData = await apiJson(fallbackEndpoint, {
            cache: "force-cache",
          });
          const rawList = Array.isArray(fallbackData)
            ? fallbackData
            : fallbackData?.data || [];
          list = rawList.filter(
            (item) =>
              currentId === null || String(item.id) !== String(currentId)
          );
        }

        if (!cancelled) {
          setRecommendations(list.slice(0, limit));
        }
      } catch (error) {
        console.error("Önerilen seriler alınamadı:", error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchRecommendations();
    return () => {
      cancelled = true;
    };
  }, [type, currentId, items, limit]);

  if (!loading && recommendations.length === 0) return null;

  return (
    <section className="my-10 border-t border-subtle pt-8">
      <h3 className="text-lg font-bold text-ink-primary mb-5 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-accent" aria-hidden="true" />
        <span>Bunları da Beğenebilirsiniz</span>
      </h3>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          <SeriesCardSkeleton />
          <SeriesCardSkeleton />
          <SeriesCardSkeleton className="hidden lg:flex" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {recommendations.map((item) => (
            <SeriesCard
              key={`${item.type || type}-${item.id}`}
              series={item}
              type={item.type ? undefined : type}
              variant="compact"
            />
          ))}
        </div>
      )}
    </section>
  );
}
