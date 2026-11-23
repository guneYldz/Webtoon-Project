"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

export default function SeriesSummary({ text, boxed = true }) {
  const [expanded, setExpanded] = useState(false);
  const [clamped, setClamped] = useState(false);
  const pRef = useRef(null);

  useEffect(() => {
    const el = pRef.current;
    if (!el) return;
    const check = () => {
      if (expanded) return;
      setClamped(el.scrollHeight > el.clientHeight + 4);
    };
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, [text, expanded]);

  if (!text) return null;

  return (
    <div
      className={
        boxed
          ? "bg-surface/75 backdrop-blur-md p-5 rounded-2xl border border-subtle"
          : "max-w-4xl"
      }
    >
      <p
        ref={pRef}
        className={`text-ink-secondary text-sm sm:text-base leading-relaxed whitespace-pre-line ${
          expanded ? "" : "line-clamp-4 md:line-clamp-5"
        }`}
      >
        {text}
      </p>
      {(clamped || expanded) && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold tracking-wide text-accent hover:brightness-125 transition"
        >
          {expanded ? (
            <>
              <span>Kısalt</span>
              <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
            </>
          ) : (
            <>
              <span>Devamını oku</span>
              <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
            </>
          )}
        </button>
      )}
    </div>
  );
}
