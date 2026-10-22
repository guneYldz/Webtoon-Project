"use client";

import { useEffect, useRef, useState } from "react";

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
          ? "bg-white/5 backdrop-blur-sm p-6 rounded-2xl border border-white/10"
          : "max-w-4xl"
      }
    >
      <p
        ref={pRef}
        className={`text-gray-300 text-base md:text-lg leading-relaxed italic ${
          expanded ? "" : "line-clamp-4 md:line-clamp-5"
        }`}
      >
        {text}
      </p>
      {(clamped || expanded) && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-4 inline-flex items-center gap-2 text-sm font-bold tracking-wide text-purple-300 hover:text-white transition"
        >
          {expanded ? (
            <>
              <span>Kısalt</span>
              <span className="text-xs">▲</span>
            </>
          ) : (
            <>
              <span>Devamını oku</span>
              <span className="text-xs">▼</span>
            </>
          )}
        </button>
      )}
    </div>
  );
}
