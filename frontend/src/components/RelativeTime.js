"use client";

import { useEffect, useState } from "react";
import { formatRelativeTimeFromNow, formatTrShortDate } from "@/lib/formatTr";

/**
 * Hydration-safe Turkish relative timestamp.
 * Renders a deterministic UTC+3 short date on SSR & first paint, then enhances
 * to relative text ("3 sa önce") after mount — eliminating React #425/#418 mismatches.
 */
export default function RelativeTime({ date, fallback = null, className = "" }) {
  const staticLabel = formatTrShortDate(date);
  const [label, setLabel] = useState(staticLabel);

  useEffect(() => {
    const relative = formatRelativeTimeFromNow(date, Date.now());
    if (relative) {
      setLabel(relative);
    }
  }, [date]);

  const display = label || fallback;
  if (!display) return null;

  return (
    <span className={className} suppressHydrationWarning>
      {display}
    </span>
  );
}
