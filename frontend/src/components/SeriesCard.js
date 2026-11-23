import Link from "next/link";
import Image from "next/image";
import { Eye, Clock } from "lucide-react";
import { resolveMediaUrl } from "@/lib/apiClient";
import { seriesTypeLabel } from "@/lib/seriesType";
import { formatChapterNumber } from "@/lib/chapterTitle";
import { formatTrNumber } from "@/lib/formatTr";
import RelativeTime from "@/components/RelativeTime";
import {
  Badge,
  badgeVariantFromSeriesType,
  SeriesCardSkeleton,
} from "@/components/ui";

/**
 * Unified Series Card component for Home, Explore (/kesfet), Catalog (/seriler),
 * New Releases (/yeniler), Favorites (/favoriler), Profile, and Recommendations.
 *
 * @param {object} props
 * @param {object} props.series - Series data object
 * @param {object} [props.webtoon] - Legacy prop alias for series
 * @param {string} [props.type] - Optional explicit type override ("webtoon"|"novel"|"manga")
 * @param {"default"|"updates"|"compact"} [props.variant="default"]
 * @param {boolean} [props.showLatestChapters=false]
 * @param {boolean} [props.priority=false]
 */
export function SeriesCard({
  series,
  webtoon,
  type,
  variant = "default",
  showLatestChapters = false,
  priority = false,
  className = "",
}) {
  const item = series || webtoon;
  if (!item) return null;

  const title = item.title || item.baslik || "İsimsiz Seri";
  const coverUrl = resolveMediaUrl(item.cover_image || item.resim);
  const resolvedRawType =
    String(type || "").toUpperCase() === "NOVEL"
      ? "NOVEL"
      : item.type || type;
  const typeLabel = seriesTypeLabel(
    resolvedRawType,
    item.typeLabel || item.tag
  );
  const isNovel = typeLabel === "NOVEL";
  const routePrefix = item.linkPath || (isNovel ? "novel" : "webtoon");

  // Resolve canonical series link (supports pre-built links like "/novel/slug" from favorites API)
  const rawSlug = item.slug ? String(item.slug) : "";
  const seriesHref = item.link
    ? item.link
    : rawSlug.startsWith("/")
    ? rawSlug
    : `/${routePrefix}/${rawSlug || item.id}`;

  const badgeVariant = badgeVariantFromSeriesType(typeLabel);
  const isOngoing =
    item.status === "ongoing" ||
    String(item.status || "").toLowerCase() === "güncel";
  const hasStatus = Boolean(item.status);
  const isNew = Boolean(item.isNew);

  const latestChapters = Array.isArray(item.latestChapters)
    ? item.latestChapters
    : [];
  const shouldRenderChapters =
    (variant === "updates" || showLatestChapters) && latestChapters.length > 0;

  const primaryCategory =
    (Array.isArray(item.categories) &&
      (item.categories[0]?.name || item.categories[0])) ||
    null;

  const episodeCount = Array.isArray(item.episodes)
    ? item.episodes.length
    : Array.isArray(item.chapters)
    ? item.chapters.length
    : item.chapter_count ?? null;

  return (
    <div className={`group flex flex-col gap-2.5 ${className}`}>
      {/* Poster Container — Strictly aspect-[2/3], rounded-xl, inner ring */}
      <div className="relative aspect-[2/3] w-full rounded-xl overflow-hidden bg-surface ring-1 ring-inset ring-white/10 shadow-lg group-hover:ring-brand/50 group-hover:shadow-purple-950/30 transition-all duration-300">
        <Link
          href={seriesHref}
          title={title}
          className="relative block w-full h-full focus-visible:outline-none"
        >
          <Image
            src={coverUrl}
            alt={title}
            fill
            priority={priority}
            loading={priority ? undefined : "lazy"}
            className="object-cover transition-transform duration-500 ease-smooth group-hover:scale-105"
            sizes="(max-width: 640px) 48vw, (max-width: 1024px) 31vw, 220px"
            quality={85}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent opacity-65 group-hover:opacity-45 transition-opacity pointer-events-none" />
        </Link>

        {/* Top-Left Format Badge */}
        <div className="absolute top-2.5 left-2.5 z-10 flex items-center gap-1.5 pointer-events-none">
          <Badge variant={badgeVariant} tone="solid" size="sm">
            {typeLabel}
          </Badge>
        </div>

        {/* Top-Right Status / New Badge */}
        {(isNew || (hasStatus && variant !== "compact")) && (
          <div className="absolute top-2.5 right-2.5 z-10 pointer-events-none">
            {isNew ? (
              <Badge variant="new" tone="solid" size="sm">
                YENİ
              </Badge>
            ) : (
              <Badge
                variant={isOngoing ? "ongoing" : "completed"}
                tone="solid"
                size="sm"
                dot={isOngoing}
              >
                {isOngoing ? "Güncel" : "Bitti"}
              </Badge>
            )}
          </div>
        )}

        {/* Bottom Overlay Stats for Compact/Default Variants */}
        {variant !== "updates" &&
          (item.view_count !== undefined || episodeCount !== null) && (
            <div className="absolute bottom-2 left-2.5 right-2.5 z-10 flex items-center justify-between text-[11px] font-medium text-zinc-200 pointer-events-none">
              {episodeCount !== null ? (
                <span className="rounded bg-black/60 backdrop-blur-md px-1.5 py-0.5 border border-white/10">
                  {episodeCount} Bölüm
                </span>
              ) : (
                <span />
              )}
              {item.view_count !== undefined && (
                <span className="inline-flex items-center gap-1 rounded bg-black/60 backdrop-blur-md px-1.5 py-0.5 border border-white/10">
                  <Eye className="h-3 w-3 text-ink-secondary" />
                  {formatTrNumber(item.view_count)}
                </span>
              )}
            </div>
          )}
      </div>

      {/* Card Body */}
      <div className="px-0.5 flex flex-col gap-1.5 min-w-0">
        <Link
          href={seriesHref}
          title={title}
          className="focus-visible:outline-none"
        >
          <h3 className="font-bold text-sm text-ink-primary truncate group-hover:text-brand transition-colors duration-150">
            {title}
          </h3>
        </Link>

        {/* Latest Chapters List (Home Updates Variant) */}
        {shouldRenderChapters ? (
          <div className="flex flex-col gap-1.5 mt-0.5">
            {latestChapters.slice(0, 2).map((chap, idx) => {
              const chapNum = chap.chapter_number ?? chap.episode_number;
              const chapTarget = isNovel ? chapNum || chap.id : chap.id;
              const chapHref = `/${routePrefix}/${
                rawSlug || item.id
              }/bolum/${chapTarget}`;
              const hasCreatedAt = Boolean(chap.created_at);

              return (
                <Link
                  key={chap.id || idx}
                  href={chapHref}
                  title={`${title} - Bölüm ${formatChapterNumber(chapNum)}`}
                  className="flex items-center justify-between gap-2 text-xs bg-surface hover:bg-elevated border border-subtle hover:border-hover rounded-lg px-2.5 py-1.5 transition-colors text-ink-secondary hover:text-ink-primary"
                >
                  <span className="font-semibold text-ink-primary truncate">
                    Bölüm {formatChapterNumber(chapNum)}
                  </span>
                  <span className="inline-flex items-center gap-1 text-[11px] text-ink-muted shrink-0">
                    {hasCreatedAt ? (
                      <>
                        <Clock className="h-3 w-3 text-brand/80" />
                        <RelativeTime date={chap.created_at} fallback="Yeni" />
                      </>
                    ) : (
                      <span className="text-brand font-semibold">Yeni</span>
                    )}
                  </span>
                </Link>
              );
            })}
          </div>
        ) : (
          /* Standard Meta Subtitle Row */
          <div className="flex items-center justify-between gap-2 text-xs text-ink-muted">
            <span className="truncate">
              {primaryCategory ||
                item.author ||
                (item.created_at ? (
                  <RelativeTime
                    date={item.created_at}
                    fallback={
                      isNovel
                        ? "Web Novel"
                        : typeLabel === "MANGA"
                        ? "Manga"
                        : "Webtoon"
                    }
                  />
                ) : isNovel ? (
                  "Web Novel"
                ) : typeLabel === "MANGA" ? (
                  "Manga"
                ) : (
                  "Webtoon"
                ))}
            </span>
            {variant === "updates" && latestChapters.length === 0 && (
              <span className="text-[11px] italic text-ink-muted">
                Yakında
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export { SeriesCardSkeleton };
export default SeriesCard;
