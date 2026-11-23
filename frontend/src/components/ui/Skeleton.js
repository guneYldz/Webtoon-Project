import React from "react";

/**
 * Shimmering loading placeholder matching Obsidian surfaces.
 */
export function Skeleton({ className = "", ...props }) {
  return (
    <div
      aria-hidden="true"
      className={`skeleton-shimmer rounded-lg bg-white/[0.05] ${className}`}
      {...props}
    />
  );
}

/**
 * Standard 2:3 Series Card placeholder to prevent CLS across Home, Discovery, and Profile grids.
 */
export function SeriesCardSkeleton({ className = "" }) {
  return (
    <div className={`flex flex-col gap-2.5 ${className}`} aria-hidden="true">
      <Skeleton className="aspect-[2/3] w-full rounded-xl ring-1 ring-inset ring-white/[0.06]" />
      <div className="space-y-1.5 px-0.5">
        <Skeleton className="h-4 w-5/6 rounded-md" />
        <Skeleton className="h-3 w-1/2 rounded-md" />
      </div>
    </div>
  );
}

/**
 * Row skeleton for ChapterDirectory lists.
 */
export function ChapterRowSkeleton({ className = "" }) {
  return (
    <div
      aria-hidden="true"
      className={`flex items-center justify-between gap-3 rounded-xl border border-subtle bg-surface px-4 py-3 ${className}`}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <Skeleton className="h-4 w-16 rounded-md shrink-0" />
        <Skeleton className="h-4 w-44 max-w-full rounded-md" />
      </div>
      <Skeleton className="h-3.5 w-16 rounded-md shrink-0" />
    </div>
  );
}

export default Skeleton;
