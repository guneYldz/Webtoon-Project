import Link from "next/link";
import Image from "next/image";
import { BookOpen, Eye, Flame } from "lucide-react";
import { resolveMediaUrl } from "@/lib/apiClient";
import { seriesTypeLabel } from "@/lib/seriesType";
import { formatTrNumber } from "@/lib/formatTr";
import FavoriteButton from "./FavoriteButton";
import {
  Badge,
  badgeVariantFromSeriesType,
  buttonClasses,
} from "@/components/ui";

const FeaturedSlider = ({ webtoon, isFirst = false }) => {
  if (!webtoon) return null;

  const labelText = seriesTypeLabel(webtoon.type, webtoon.typeLabel);
  const isNovel = labelText === "NOVEL";
  const routeType = isNovel ? "novel" : "webtoon";
  const seriesHref = `/${routeType}/${webtoon.slug || webtoon.id}`;

  const validBanner =
    webtoon.banner_image &&
    webtoon.banner_image.length > 5 &&
    webtoon.banner_image.includes(".");

  const bgImage = resolveMediaUrl(
    validBanner ? webtoon.banner_image : webtoon.cover_image
  );
  const posterImage = resolveMediaUrl(webtoon.cover_image);
  const badgeVariant = badgeVariantFromSeriesType(labelText);
  const isOngoing = webtoon.status === "ongoing";

  return (
    <div className="relative w-full h-[440px] md:h-[520px] overflow-hidden bg-canvas select-none">
      {/* 1. Ambient Backdrop Image */}
      <div className="absolute inset-0 w-full h-full overflow-hidden">
        <div
          className={`relative w-full h-full transition-transform duration-700 ${
            !validBanner
              ? "blur-2xl scale-110 opacity-45"
              : "opacity-75 scale-105"
          }`}
        >
          <Image
            src={bgImage}
            alt={`${webtoon.title} Vitrin`}
            fill
            sizes="(max-width: 768px) 100vw, 1280px"
            quality={85}
            className="object-cover object-center"
            priority={Boolean(isFirst && validBanner)}
            loading={isFirst && validBanner ? undefined : isFirst ? "eager" : "lazy"}
            fetchPriority={isFirst && validBanner ? "high" : "auto"}
          />
        </div>
        <div className="absolute inset-0 bg-canvas/45" />
      </div>

      {/* 2. Layered Readability Gradients */}
      <div className="absolute inset-0 bg-gradient-to-t from-canvas via-canvas/75 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-r from-canvas via-canvas/65 to-transparent" />

      {/* 3. Editorial Content + Crisp 2:3 Cover Card */}
      <div className="relative z-10 h-full container mx-auto max-w-7xl px-6 md:px-12 pb-12 pt-8 flex items-end justify-between gap-10">
        {/* Left: Copy & CTAs */}
        <div className="flex flex-col gap-3.5 max-w-2xl">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={badgeVariant} tone="solid" size="md">
              {labelText}
            </Badge>
            <Badge
              variant={isOngoing ? "ongoing" : "completed"}
              tone="soft"
              size="md"
              dot={isOngoing}
            >
              {isOngoing ? "Güncel Seri" : "Tamamlandı"}
            </Badge>
            <span className="inline-flex items-center gap-1 rounded-md bg-white/[0.07] border border-white/10 px-2 py-0.5 text-[11px] font-semibold text-amber-300">
              <Flame className="h-3 w-3 text-amber-400" />
              Öne Çıkan
            </span>
          </div>

          <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-ink-primary leading-tight tracking-tight line-clamp-2 drop-shadow">
            {webtoon.title}
          </h2>

          <p className="text-ink-secondary line-clamp-2 md:line-clamp-3 text-sm md:text-base leading-relaxed max-w-xl">
            {webtoon.summary ||
              "Bu serinin özeti yakında eklenecek. Hemen ilk bölümden okumaya başlayabilirsin."}
          </p>

          <div className="flex flex-wrap items-center gap-4 text-xs sm:text-sm text-ink-secondary font-medium">
            <span className="inline-flex items-center gap-1.5">
              <Eye className="h-4 w-4 text-brand" />
              {formatTrNumber(webtoon.view_count)} Okunma
            </span>
            {Array.isArray(webtoon.categories) &&
              webtoon.categories.slice(0, 3).map((cat, idx) => {
                const name = cat?.name || cat;
                if (!name) return null;
                return (
                  <span
                    key={idx}
                    className="rounded-full bg-white/[0.06] border border-white/10 px-2.5 py-0.5 text-xs text-ink-secondary"
                  >
                    {name}
                  </span>
                );
              })}
          </div>

          <div className="flex flex-wrap items-center gap-3 mt-2">
            <Link
              href={seriesHref}
              className={buttonClasses({
                variant: "primary",
                size: "lg",
                className: "rounded-full px-7 font-bold shadow-lg shadow-purple-950/50",
              })}
              title={`${webtoon.title} Türkçe Oku`}
            >
              <BookOpen className="h-4 w-4" />
              <span>Hemen Oku</span>
            </Link>

            <FavoriteButton
              type={routeType}
              id={webtoon.id}
              className="bg-white/10 hover:bg-white/20 text-white border border-white/20 hover:border-white/40 backdrop-blur-md px-5 py-2.5 rounded-full text-sm font-semibold transition z-20"
            />
          </div>
        </div>

        {/* Right: Crisp 2:3 Poster Card on Desktop */}
        <Link
          href={seriesHref}
          title={webtoon.title}
          className="hidden md:block shrink-0 relative aspect-[2/3] w-48 lg:w-56 rounded-2xl overflow-hidden ring-1 ring-white/20 shadow-2xl shadow-black/80 group/poster"
        >
          <Image
            src={posterImage}
            alt={webtoon.title}
            fill
            sizes="224px"
            quality={90}
            loading={isFirst ? undefined : "lazy"}
            className="object-cover transition-transform duration-500 group-hover/poster:scale-105"
          />
        </Link>
      </div>
    </div>
  );
};

export default FeaturedSlider;
