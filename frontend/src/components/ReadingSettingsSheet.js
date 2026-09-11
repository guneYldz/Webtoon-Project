"use client";

import { useEffect } from "react";

const STORAGE_KEY = "kaos_novel_reading_settings";

export const DEFAULT_READING_SETTINGS = {
  v: 2,
  fontSize: 40,       // 0-100 → ~20px
  lineHeight: 40,     // 0-100 → ~1.9
  letterSpacing: 0,   // 0-100
  wordSpacing: 0,     // 0-100
  padding: 35,        // 0-100
  indent: true,
  fullWidth: false,
};

const lerp = (min, max, t) => min + (max - min) * (Math.min(100, Math.max(0, Number(t) || 0)) / 100);

function migrateSettings(raw) {
  const merged = { ...DEFAULT_READING_SETTINGS, ...raw };
  if (merged.v === 2) {
    return {
      ...DEFAULT_READING_SETTINGS,
      ...merged,
      fontSize: clamp100(merged.fontSize),
      lineHeight: clamp100(merged.lineHeight),
      letterSpacing: clamp100(merged.letterSpacing),
      wordSpacing: clamp100(merged.wordSpacing),
      padding: clamp100(merged.padding),
    };
  }
  // Eski adım indekslerini (0-4 / 0-3 / 0-2) 0-100 skalasına taşı
  const fontMap = [10, 40, 55, 75, 95];
  const lhMap = [15, 40, 65, 90];
  const padMap = [15, 35, 80];
  return {
    ...DEFAULT_READING_SETTINGS,
    fontSize: fontMap[merged.fontSize] ?? 40,
    lineHeight: lhMap[merged.lineHeight] ?? 40,
    padding: padMap[merged.padding] ?? 35,
    indent: merged.indent !== false,
    fullWidth: !!merged.fullWidth,
    letterSpacing: 0,
    wordSpacing: 0,
  };
}

const clamp100 = (n) => Math.min(100, Math.max(0, Number(n) || 0));

export function loadReadingSettings() {
  if (typeof window === "undefined") return { ...DEFAULT_READING_SETTINGS };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_READING_SETTINGS };
    return migrateSettings(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_READING_SETTINGS };
  }
}

export function saveReadingSettings(settings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...settings, v: 2 }));
  } catch (_) {}
}

export function getReadingStyle(settings) {
  const s = settings?.v === 2 ? settings : migrateSettings(settings || {});
  return {
    fontSizePx: Math.round(lerp(14, 36, s.fontSize)),
    lineHeight: Number(lerp(1.25, 2.8, s.lineHeight).toFixed(2)),
    letterSpacingEm: Number(lerp(0, 0.12, s.letterSpacing).toFixed(3)),
    wordSpacingEm: Number(lerp(0, 0.45, s.wordSpacing).toFixed(3)),
    paddingPx: Math.round(lerp(8, 64, s.padding)),
    indent: !!s.indent,
    fullWidth: !!s.fullWidth,
  };
}

function RangeSlider({ label, value, onChange, hint }) {
  return (
    <div className="mb-5">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-bold tracking-widest uppercase text-gray-500">{label}</p>
        <span className="text-xs font-bold tabular-nums text-gray-300">{Math.round(value)}</span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-2 rounded-full appearance-none bg-zinc-800 accent-gray-200 cursor-pointer"
      />
      {hint ? <p className="mt-1 text-[11px] text-zinc-600">{hint}</p> : null}
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

export default function ReadingSettingsSheet({ open, onClose, settings, onChange, onSave, onReset }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const set = (key, val) => onChange({ ...settings, [key]: val });

  return (
    <div className="fixed inset-0 z-[2000] flex items-end justify-center">
      <button
        type="button"
        className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
        aria-label="Kapat"
        onClick={onClose}
      />

      <div className="relative w-full max-w-md max-h-[88vh] overflow-y-auto bg-[#1a1a1a] border-t border-gray-700 rounded-t-3xl shadow-2xl px-5 pt-4 pb-8">
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

        <RangeSlider
          label="Yazı boyutu"
          value={settings.fontSize}
          onChange={(v) => set("fontSize", v)}
        />
        <RangeSlider
          label="Satır yüksekliği"
          value={settings.lineHeight}
          onChange={(v) => set("lineHeight", v)}
        />
        <RangeSlider
          label="Kelime aralığı"
          value={settings.wordSpacing}
          onChange={(v) => set("wordSpacing", v)}
        />
        <RangeSlider
          label="Harf aralığı"
          value={settings.letterSpacing}
          onChange={(v) => set("letterSpacing", v)}
        />
        <RangeSlider
          label="Kenar boşluğu"
          value={settings.padding}
          onChange={(v) => set("padding", v)}
        />

        <TogglePair
          label="Girinti"
          value={settings.indent}
          onChange={(v) => set("indent", v)}
        />
        <TogglePair
          label="Tam genişlik"
          value={settings.fullWidth}
          onChange={(v) => set("fullWidth", v)}
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
