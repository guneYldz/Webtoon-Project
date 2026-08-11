"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "kaos_novel_reading_settings";

export const DEFAULT_READING_SETTINGS = {
  fontSize: 1,      // 0..4  Küçük → Çok büyük
  lineHeight: 1,    // 0..3  Sıkı → Geniş
  padding: 1,       // 0..2  Az → Çok
  indent: true,
  fullWidth: false,
};

const FONT_SIZES = [
  { label: "Küçük", px: 16 },
  { label: "Varsayılan", px: 20 },
  { label: "Orta", px: 22 },
  { label: "Büyük", px: 26 },
  { label: "Çok büyük", px: 30 },
];

const LINE_HEIGHTS = [
  { label: "Sıkı", value: 1.5 },
  { label: "Varsayılan", value: 1.9 },
  { label: "Rahat", value: 2.2 },
  { label: "Geniş", value: 2.6 },
];

const PADDINGS = [
  { label: "Az", className: "px-2 md:px-3" },
  { label: "Varsayılan", className: "px-4 md:px-8" },
  { label: "Çok", className: "px-8 md:px-16" },
];

export function loadReadingSettings() {
  if (typeof window === "undefined") return { ...DEFAULT_READING_SETTINGS };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_READING_SETTINGS };
    return { ...DEFAULT_READING_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_READING_SETTINGS };
  }
}

export function saveReadingSettings(settings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (_) {}
}

export function getReadingStyle(settings) {
  const fs = FONT_SIZES[settings.fontSize] || FONT_SIZES[1];
  const lh = LINE_HEIGHTS[settings.lineHeight] || LINE_HEIGHTS[1];
  const pad = PADDINGS[settings.padding] || PADDINGS[1];
  return {
    fontSizePx: fs.px,
    fontSizeLabel: fs.label,
    lineHeight: lh.value,
    lineHeightLabel: lh.label,
    paddingClass: pad.className,
    paddingLabel: pad.label,
    indent: settings.indent,
    fullWidth: settings.fullWidth,
  };
}

function Stepper({ label, valueLabel, onMinus, onPlus, disableMinus, disablePlus }) {
  return (
    <div className="mb-5">
      <p className="text-xs font-bold tracking-widest uppercase text-gray-500 mb-2">{label}</p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onMinus}
          disabled={disableMinus}
          className="w-11 h-11 rounded-xl bg-[#121212] border border-gray-700 text-gray-300 text-xl font-bold disabled:opacity-30 hover:border-gray-500 transition"
        >
          −
        </button>
        <div className="flex-1 h-11 rounded-xl bg-[#121212] border border-gray-700 flex items-center justify-center text-sm font-bold text-gray-200">
          {valueLabel}
        </div>
        <button
          type="button"
          onClick={onPlus}
          disabled={disablePlus}
          className="w-11 h-11 rounded-xl bg-[#121212] border border-gray-700 text-gray-300 text-xl font-bold disabled:opacity-30 hover:border-gray-500 transition"
        >
          +
        </button>
      </div>
    </div>
  );
}

function TogglePair({ label, value, onChange }) {
  return (
    <div className="mb-5">
      <p className="text-xs font-bold tracking-widest uppercase text-gray-500 mb-2">{label}</p>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onChange(false)}
          aria-label={`${label} kapalı`}
          className={`h-11 rounded-xl border flex items-center justify-center transition ${
            !value
              ? "bg-gray-200 text-black border-gray-200"
              : "bg-[#121212] text-gray-500 border-gray-700 hover:border-gray-500"
          }`}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => onChange(true)}
          aria-label={`${label} açık`}
          className={`h-11 rounded-xl border flex items-center justify-center transition ${
            value
              ? "bg-gray-200 text-black border-gray-200"
              : "bg-[#121212] text-gray-500 border-gray-700 hover:border-gray-500"
          }`}
        >
          {label === "Girinti" ? (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" d="M4 7h16M8 12h12M8 17h12" />
              <path strokeLinecap="round" d="M4 12v5" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4h4M20 8V4h-4M4 16v4h4M20 16v4h-4" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}

/**
 * Alttan açılan okuma ayarları paneli (novel).
 */
export default function ReadingSettingsSheet({ open, onClose, settings, onChange, onSave, onReset }) {
  const style = getReadingStyle(settings);

  // Escape ile kapat
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const bump = (key, delta, min, max) => {
    onChange({
      ...settings,
      [key]: Math.min(max, Math.max(min, settings[key] + delta)),
    });
  };

  return (
    <div className="fixed inset-0 z-[2000] flex items-end justify-center">
      <button
        type="button"
        className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
        aria-label="Kapat"
        onClick={onClose}
      />

      <div className="relative w-full max-w-md bg-[#1a1a1a] border-t border-gray-700 rounded-t-3xl shadow-2xl px-5 pt-4 pb-8 animate-in slide-in-from-bottom duration-300">
        {/* Tutamak */}
        <div className="w-10 h-1 rounded-full bg-gray-700 mx-auto mb-4" />

        <div className="flex items-center justify-between mb-6">
          <h3 className="text-sm font-black tracking-[0.2em] uppercase text-gray-200">
            Okuma Ayarları
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-[#121212] border border-gray-700 text-gray-400 hover:text-white transition"
            aria-label="Kapat"
          >
            ✕
          </button>
        </div>

        <Stepper
          label="Yazı boyutu"
          valueLabel={style.fontSizeLabel}
          onMinus={() => bump("fontSize", -1, 0, FONT_SIZES.length - 1)}
          onPlus={() => bump("fontSize", 1, 0, FONT_SIZES.length - 1)}
          disableMinus={settings.fontSize <= 0}
          disablePlus={settings.fontSize >= FONT_SIZES.length - 1}
        />

        <Stepper
          label="Satır yüksekliği"
          valueLabel={style.lineHeightLabel}
          onMinus={() => bump("lineHeight", -1, 0, LINE_HEIGHTS.length - 1)}
          onPlus={() => bump("lineHeight", 1, 0, LINE_HEIGHTS.length - 1)}
          disableMinus={settings.lineHeight <= 0}
          disablePlus={settings.lineHeight >= LINE_HEIGHTS.length - 1}
        />

        <Stepper
          label="Kenar boşluğu"
          valueLabel={style.paddingLabel}
          onMinus={() => bump("padding", -1, 0, PADDINGS.length - 1)}
          onPlus={() => bump("padding", 1, 0, PADDINGS.length - 1)}
          disableMinus={settings.padding <= 0}
          disablePlus={settings.padding >= PADDINGS.length - 1}
        />

        <TogglePair
          label="Girinti"
          value={settings.indent}
          onChange={(v) => onChange({ ...settings, indent: v })}
        />

        <TogglePair
          label="Tam genişlik"
          value={settings.fullWidth}
          onChange={(v) => onChange({ ...settings, fullWidth: v })}
        />

        <div className="grid grid-cols-2 gap-3 mt-6">
          <button
            type="button"
            onClick={onReset}
            className="h-12 rounded-xl bg-[#121212] border border-gray-700 text-gray-300 font-black text-sm tracking-widest uppercase hover:border-gray-500 transition"
          >
            Sıfırla
          </button>
          <button
            type="button"
            onClick={onSave}
            className="h-12 rounded-xl bg-gray-200 text-black font-black text-sm tracking-widest uppercase hover:bg-white transition"
          >
            Kaydet
          </button>
        </div>
      </div>
    </div>
  );
}

// Export constants for parent usage
export { FONT_SIZES, LINE_HEIGHTS, PADDINGS };
