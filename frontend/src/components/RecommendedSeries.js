"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { apiJson } from "@/lib/apiClient";
import SeriesCard, { SeriesCardSkeleton } from "@/components/SeriesCard";

export default function RecommendedSeries({
  type = "novel",
  currentId = null,
  items = null,
}) {
  const [recommendations, setRecommendations] = useState(
    Array.isArray(items) ? items.slice(0, 3) : []
  );
  const [loading, setLoading] = useState(!Array.isArray(items));

  useEffect(() => {
    if (Array.isArray(items)) {
      setRecommendations(items.slice(0, 3));
      setLoading(false);
      return;
    }

    let cancelled = false;
    const fetchRecommendations = async () => {
      try {
        const endpoint =
          type === "novel" ? "/novels/?limit=12" : "/webtoons/?limit=12";
        const data = await apiJson(endpoint, { cache: "force-cache" });
        const list = Array.isArray(data) ? data : data?.data || [];
        const filtered = list.filter(
          (item) => currentId === null || String(item.id) !== String(currentId)
        );
        // Deterministic rotate by currentId if present, else pick top 3
        const offset =
          currentId && filtered.length > 3
            ? Math.abs(Number(currentId) || 0) % Math.max(1, filtered.length - 2)
            : 0;
        if (!cancelled) {
          setRecommendations(filtered.slice(offset, offset + 3));
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
  }, [type, currentId, items]);

  if (!loading && recommendations.length === 0) return null;

  return (
    <section className="my-10 border-t border-subtle pt-8">
      <h3 className="text-lg font-bold text-ink-primary mb-5 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-accent" aria-hidden="true" />
        <span>Bunları da Beğenebilirsiniz</span>
      </h3>

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <SeriesCardSkeleton />
          <SeriesCardSkeleton />
          <SeriesCardSkeleton className="hidden sm:flex" />
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {recommendations.map((item) => (
            <SeriesCard
              key={item.id}
              series={item}
              type={type}
              variant="compact"
            />
          ))}
        </div>
      )}
    </section>
  );
}
