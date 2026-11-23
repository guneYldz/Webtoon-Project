import React from "react";

const SOFT_VARIANTS = {
  default: "bg-elevated text-ink-secondary border-subtle",
  webtoon: "bg-sky-500/15 text-sky-400 border-sky-500/30",
  manga: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  novel: "bg-purple-500/15 text-purple-300 border-purple-500/30",
  ongoing: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  completed: "bg-zinc-500/15 text-zinc-300 border-zinc-500/30",
  new: "bg-brand/20 text-purple-300 border-brand/40",
  outline: "bg-transparent text-ink-secondary border-white/15",
};

const SOLID_VARIANTS = {
  default: "bg-elevated/95 text-ink-primary border-white/10",
  webtoon: "bg-sky-700/95 text-white border-sky-500/50 shadow-sm",
  manga: "bg-amber-500/95 text-zinc-950 border-amber-400/50 shadow-sm",
  novel: "bg-purple-700/95 text-white border-purple-500/50 shadow-sm",
  ongoing: "bg-emerald-700/95 text-white border-emerald-500/50",
  completed: "bg-zinc-700/95 text-zinc-100 border-zinc-500/40",
  new: "bg-purple-700 text-white border-purple-400/40",
  outline: "bg-black/70 backdrop-blur-md text-ink-primary border-white/20",
};

const SIZE_CLASSES = {
  sm: "text-[10px] px-1.5 py-0.5 rounded",
  md: "text-[11px] px-2 py-0.5 rounded-md",
};

/**
 * Maps a series type string (`WEBTOON`, `MANGA`, `NOVEL`) to its Badge variant.
 */
export function badgeVariantFromSeriesType(seriesType) {
  const normalized = String(seriesType || "").toUpperCase();
  if (normalized.includes("NOVEL")) return "novel";
  if (normalized.includes("MANGA")) return "manga";
  return "webtoon";
}

/**
 * Compact semantic Badge primitive.
 * @param {object} props
 * @param {"default"|"webtoon"|"manga"|"novel"|"ongoing"|"completed"|"new"|"outline"} [props.variant="default"]
 * @param {"soft"|"solid"} [props.tone="soft"]
 * @param {"sm"|"md"} [props.size="md"]
 * @param {boolean} [props.dot=false] - Shows a small leading status dot (useful for `ongoing`)
 */
export function Badge({
  variant = "default",
  tone = "soft",
  size = "md",
  dot = false,
  className = "",
  children,
  ...props
}) {
  const palette = tone === "solid" ? SOLID_VARIANTS : SOFT_VARIANTS;
  const variantClass = palette[variant] || palette.default;
  const sizeClass = SIZE_CLASSES[size] || SIZE_CLASSES.md;

  return (
    <span
      className={[
        "inline-flex items-center gap-1.5 border font-bold uppercase tracking-wider leading-tight whitespace-nowrap select-none",
        sizeClass,
        variantClass,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    >
      {dot && (
        <span
          aria-hidden="true"
          className={`h-1.5 w-1.5 rounded-full shrink-0 ${
            variant === "ongoing" ? "bg-emerald-400" : "bg-current"
          }`}
        />
      )}
      {children}
    </span>
  );
}

export default Badge;
