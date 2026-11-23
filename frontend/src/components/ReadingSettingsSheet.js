"use client";

import { Minus, Plus, RotateCcw, AlignLeft, AlignJustify } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  Button,
} from "@/components/ui";

const NOVEL_STORAGE_KEY = "kaos_novel_reading_settings_v3";
const LEGACY_NOVEL_STORAGE_KEY = "kaos_novel_reading_settings";
const WEBTOON_STORAGE_KEY = "kaos_webtoon_reading_settings_v1";

export const DEFAULT_NOVEL_SETTINGS = {
  v: 3,
  theme: "charcoal", // "oled" | "charcoal" | "sepia" | "paper"
  fontFamily: "serif", // "serif" | "sans"
  fontSizePx: 19, // 14..30
  lineHeight: 1.85, // 1.3..2.5
  maxWidth: "standard", // "narrow" | "standard" | "wide"
  align: "left", // "left" | "justify"
  indent: false,
  paddingPx: 20, // 12..48
};

export const DEFAULT_WEBTOON_SETTINGS = {
  v: 1,
  widthPreset: "standard", // "narrow" | "standard" | "wide" | "full"
  panelGap: false,
  theme: "charcoal", // "oled" | "charcoal"
  brightness: 100, // 65..100
};

// Backward-compatible alias
export const DEFAULT_READING_SETTINGS = DEFAULT_NOVEL_SETTINGS;

function clamp(val, min, max, fallback) {
  const num = Number(val);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, num));
}

const VALID_NOVEL_THEMES = new Set(["oled", "charcoal", "sepia", "paper"]);
const VALID_WEBTOON_THEMES = new Set(["oled", "charcoal"]);
const VALID_MAX_WIDTHS = new Set(["narrow", "standard", "wide"]);
const VALID_WEBTOON_WIDTHS = new Set(["narrow", "standard", "wide", "full"]);

export function loadNovelSettings() {
  if (typeof window === "undefined") return { ...DEFAULT_NOVEL_SETTINGS };
  try {
    const raw =
      localStorage.getItem(NOVEL_STORAGE_KEY) ||
      localStorage.getItem(LEGACY_NOVEL_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_NOVEL_SETTINGS };
    const parsed = JSON.parse(raw);

    // Migrate v2 0-100 slider scale if present
    if (parsed && parsed.v === 2) {
      const lerp = (min, max, t) => min + (max - min) * (clamp(t, 0, 100, 40) / 100);
      return {
        ...DEFAULT_NOVEL_SETTINGS,
        fontSizePx: Math.round(clamp(lerp(14, 30, parsed.fontSize), 14, 30, 19)),
        lineHeight: Number(clamp(lerp(1.3, 2.5, parsed.lineHeight), 1.3, 2.5, 1.85).toFixed(2)),
        maxWidth: parsed.fullWidth ? "wide" : "standard",
        indent: Boolean(parsed.indent),
        paddingPx: Math.round(clamp(lerp(12, 48, parsed.padding), 12, 48, 20)),
      };
    }

    return {
      ...DEFAULT_NOVEL_SETTINGS,
      theme: VALID_NOVEL_THEMES.has(parsed.theme) ? parsed.theme : "charcoal",
      fontFamily: parsed.fontFamily === "sans" ? "sans" : "serif",
      fontSizePx: Math.round(clamp(parsed.fontSizePx, 14, 30, 19)),
      lineHeight: Number(clamp(parsed.lineHeight, 1.3, 2.5, 1.85).toFixed(2)),
      maxWidth: VALID_MAX_WIDTHS.has(parsed.maxWidth) ? parsed.maxWidth : "standard",
      align: parsed.align === "justify" ? "justify" : "left",
      indent: Boolean(parsed.indent),
      paddingPx: Math.round(clamp(parsed.paddingPx, 12, 48, 20)),
    };
  } catch {
    return { ...DEFAULT_NOVEL_SETTINGS };
  }
}

export function saveNovelSettings(settings) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      NOVEL_STORAGE_KEY,
      JSON.stringify({ ...DEFAULT_NOVEL_SETTINGS, ...settings, v: 3 })
    );
  } catch {
    // Ignore storage failures
  }
}

export function loadWebtoonSettings() {
  if (typeof window === "undefined") return { ...DEFAULT_WEBTOON_SETTINGS };
  try {
    const raw = localStorage.getItem(WEBTOON_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_WEBTOON_SETTINGS };
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_WEBTOON_SETTINGS,
      widthPreset: VALID_WEBTOON_WIDTHS.has(parsed.widthPreset)
        ? parsed.widthPreset
        : "standard",
      panelGap: Boolean(parsed.panelGap),
      theme: VALID_WEBTOON_THEMES.has(parsed.theme) ? parsed.theme : "charcoal",
      brightness: Math.round(clamp(parsed.brightness, 65, 100, 100)),
    };
  } catch {
    return { ...DEFAULT_WEBTOON_SETTINGS };
  }
}

export function saveWebtoonSettings(settings) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      WEBTOON_STORAGE_KEY,
      JSON.stringify({ ...DEFAULT_WEBTOON_SETTINGS, ...settings, v: 1 })
    );
  } catch {
    // Ignore storage failures
  }
}

// Backward-compatible aliases
export const loadReadingSettings = loadNovelSettings;
export const saveReadingSettings = saveNovelSettings;
export const getReadingStyle = (s) => s;

const NOVEL_THEMES = [
  { id: "oled", label: "OLED", bg: "#000000", fg: "#E5E5E7", ring: "border-white/25" },
  { id: "charcoal", label: "Kömür", bg: "#121216", fg: "#E4E4E7", ring: "border-white/25" },
  { id: "sepia", label: "Sepya", bg: "#F4ECD8", fg: "#3B2F22", ring: "border-amber-700/40" },
  { id: "paper", label: "Kağıt", bg: "#F8FAFC", fg: "#1E293B", ring: "border-slate-400/50" },
];

const WEBTOON_WIDTHS = [
  { id: "narrow", label: "Dar" },
  { id: "standard", label: "Standart" },
  { id: "wide", label: "Geniş" },
  { id: "full", label: "Tam" },
];

function StepperControl({ label, valueLabel, value, min, max, step, onChange }) {
  const decrement = () => onChange(Number(clamp(value - step, min, max, value).toFixed(2)));
  const increment = () => onChange(Number(clamp(value + step, min, max, value).toFixed(2)));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-ink-secondary">
          {label}
        </span>
        <span className="text-xs font-bold tabular-nums text-ink-primary bg-canvas px-2 py-0.5 rounded-md border border-subtle">
          {valueLabel}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={decrement}
          disabled={value <= min}
          aria-label={`${label} azalt`}
          className="h-8 w-8 rounded-lg bg-canvas border border-subtle text-ink-secondary hover:text-white hover:border-hover disabled:opacity-35 inline-flex items-center justify-center shrink-0 transition"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-label={label}
          className="flex-1 h-1.5 rounded-full appearance-none bg-white/10 accent-brand cursor-pointer"
        />
        <button
          type="button"
          onClick={increment}
          disabled={value >= max}
          aria-label={`${label} artır`}
          className="h-8 w-8 rounded-lg bg-canvas border border-subtle text-ink-secondary hover:text-white hover:border-hover disabled:opacity-35 inline-flex items-center justify-center shrink-0 transition"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

/**
 * Translucent live-preview reading settings drawer (non-blocking via hideOverlay).
 */
export default function ReadingSettingsSheet({
  mode = "novel",
  open,
  onClose,
  settings,
  onChange,
  onReset,
}) {
  const update = (key, val) => {
    const next = { ...settings, [key]: val };
    onChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent
        side="right"
        hideOverlay
        className="w-[calc(100vw-1.5rem)] sm:max-w-sm bg-[#13131A]/90 backdrop-blur-xl border border-white/15 shadow-2xl overflow-y-auto"
      >
        <DialogHeader>
          <DialogTitle className="text-base font-bold">Okuma Ayarları</DialogTitle>
          <DialogDescription className="text-xs">
            Değişiklikler anlık uygulanır ve otomatik kaydedilir.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-5 space-y-5">
          {mode === "novel" ? (
            <>
              {/* Theme Swatches */}
              <div className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-ink-secondary block">
                  Okuma Teması
                </span>
                <div className="grid grid-cols-4 gap-2">
                  {NOVEL_THEMES.map((t) => {
                    const active = settings.theme === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => update("theme", t.id)}
                        className={`flex flex-col items-center gap-1.5 p-2 rounded-xl border transition ${
                          active
                            ? "border-accent ring-2 ring-accent/40 bg-accent-soft"
                            : "border-subtle bg-canvas/60 hover:border-hover"
                        }`}
                      >
                        <span
                          className={`w-7 h-7 rounded-full border ${t.ring} flex items-center justify-center text-[11px] font-bold`}
                          style={{ backgroundColor: t.bg, color: t.fg }}
                        >
                          Aa
                        </span>
                        <span className="text-[11px] font-medium text-ink-primary">
                          {t.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Font Family */}
              <div className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-ink-secondary block">
                  Yazı Tipi
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => update("fontFamily", "serif")}
                    className={`h-10 rounded-xl border text-sm font-serif transition ${
                      settings.fontFamily === "serif"
                        ? "bg-accent-soft border-accent-border text-white font-semibold"
                        : "bg-canvas/60 border-subtle text-ink-secondary hover:border-hover"
                    }`}
                  >
                    Lora (Serif)
                  </button>
                  <button
                    type="button"
                    onClick={() => update("fontFamily", "sans")}
                    className={`h-10 rounded-xl border text-sm font-sans transition ${
                      settings.fontFamily === "sans"
                        ? "bg-accent-soft border-accent-border text-white font-semibold"
                        : "bg-canvas/60 border-subtle text-ink-secondary hover:border-hover"
                    }`}
                  >
                    Inter (Sans)
                  </button>
                </div>
              </div>

              <StepperControl
                label="Yazı Boyutu"
                valueLabel={`${settings.fontSizePx}px`}
                value={settings.fontSizePx}
                min={14}
                max={30}
                step={1}
                onChange={(v) => update("fontSizePx", v)}
              />

              <StepperControl
                label="Satır Yüksekliği"
                valueLabel={`${Number(settings.lineHeight).toFixed(2)}×`}
                value={settings.lineHeight}
                min={1.3}
                max={2.5}
                step={0.05}
                onChange={(v) => update("lineHeight", v)}
              />

              <StepperControl
                label="Kenar Boşluğu"
                valueLabel={`${settings.paddingPx}px`}
                value={settings.paddingPx}
                min={12}
                max={48}
                step={4}
                onChange={(v) => update("paddingPx", v)}
              />

              {/* Column Width */}
              <div className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-ink-secondary block">
                  Okuma Genişliği
                </span>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "narrow", label: "Dar" },
                    { id: "standard", label: "Orta" },
                    { id: "wide", label: "Geniş" },
                  ].map((w) => (
                    <button
                      key={w.id}
                      type="button"
                      onClick={() => update("maxWidth", w.id)}
                      className={`h-9 rounded-xl border text-xs font-semibold transition ${
                        settings.maxWidth === w.id
                          ? "bg-accent-soft border-accent-border text-white"
                          : "bg-canvas/60 border-subtle text-ink-secondary hover:border-hover"
                      }`}
                    >
                      {w.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Alignment & Indent */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-ink-secondary block">
                    Hizalama
                  </span>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => update("align", "left")}
                      title="Sola Yaslı"
                      aria-label="Sola yaslı"
                      className={`h-9 rounded-xl border flex items-center justify-center transition ${
                        settings.align === "left"
                          ? "bg-accent-soft border-accent-border text-white"
                          : "bg-canvas/60 border-subtle text-ink-secondary hover:border-hover"
                      }`}
                    >
                      <AlignLeft className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => update("align", "justify")}
                      title="İki Yana Yaslı"
                      aria-label="İki yana yaslı"
                      className={`h-9 rounded-xl border flex items-center justify-center transition ${
                        settings.align === "justify"
                          ? "bg-accent-soft border-accent-border text-white"
                          : "bg-canvas/60 border-subtle text-ink-secondary hover:border-hover"
                      }`}
                    >
                      <AlignJustify className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-ink-secondary block">
                    Paragraf Girintisi
                  </span>
                  <button
                    type="button"
                    onClick={() => update("indent", !settings.indent)}
                    className={`w-full h-9 rounded-xl border text-xs font-semibold transition ${
                      settings.indent
                        ? "bg-accent-soft border-accent-border text-white"
                        : "bg-canvas/60 border-subtle text-ink-secondary hover:border-hover"
                    }`}
                  >
                    {settings.indent ? "Açık" : "Kapalı"}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Webtoon/Manga Width Presets */}
              <div className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-ink-secondary block">
                  Sayfa Genişliği
                </span>
                <div className="grid grid-cols-4 gap-1.5">
                  {WEBTOON_WIDTHS.map((w) => (
                    <button
                      key={w.id}
                      type="button"
                      onClick={() => update("widthPreset", w.id)}
                      className={`h-9 rounded-xl border text-xs font-semibold transition ${
                        settings.widthPreset === w.id
                          ? "bg-accent-soft border-accent-border text-white"
                          : "bg-canvas/60 border-subtle text-ink-secondary hover:border-hover"
                      }`}
                    >
                      {w.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Panel Gap */}
              <div className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-ink-secondary block">
                  Panel Aralığı
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => update("panelGap", false)}
                    className={`h-9 rounded-xl border text-xs font-semibold transition ${
                      !settings.panelGap
                        ? "bg-accent-soft border-accent-border text-white"
                        : "bg-canvas/60 border-subtle text-ink-secondary hover:border-hover"
                    }`}
                  >
                    Bitişik (Webtoon)
                  </button>
                  <button
                    type="button"
                    onClick={() => update("panelGap", true)}
                    className={`h-9 rounded-xl border text-xs font-semibold transition ${
                      settings.panelGap
                        ? "bg-accent-soft border-accent-border text-white"
                        : "bg-canvas/60 border-subtle text-ink-secondary hover:border-hover"
                    }`}
                  >
                    Aralıklı (Manga)
                  </button>
                </div>
              </div>

              {/* Canvas Theme */}
              <div className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-ink-secondary block">
                  Arka Plan
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => update("theme", "oled")}
                    className={`h-9 rounded-xl border text-xs font-semibold transition ${
                      settings.theme === "oled"
                        ? "bg-accent-soft border-accent-border text-white"
                        : "bg-canvas/60 border-subtle text-ink-secondary hover:border-hover"
                    }`}
                  >
                    OLED Siyah
                  </button>
                  <button
                    type="button"
                    onClick={() => update("theme", "charcoal")}
                    className={`h-9 rounded-xl border text-xs font-semibold transition ${
                      settings.theme === "charcoal"
                        ? "bg-accent-soft border-accent-border text-white"
                        : "bg-canvas/60 border-subtle text-ink-secondary hover:border-hover"
                    }`}
                  >
                    Kömür Grisi
                  </button>
                </div>
              </div>

              <StepperControl
                label="Görsel Parlaklığı"
                valueLabel={`%${settings.brightness}`}
                value={settings.brightness}
                min={65}
                max={100}
                step={5}
                onChange={(v) => update("brightness", v)}
              />
            </>
          )}

          <div className="pt-2 border-t border-subtle flex items-center justify-between gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onReset}
              className="text-ink-secondary"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              Varsayılana Sıfırla
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={onClose}>
              Kapat
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
