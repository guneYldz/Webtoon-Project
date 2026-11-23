# Kaos Manga — Obsidian & Amethyst Design System Contract

> **Scope / Kapsam**: `AI-webtoon/frontend` için tek tasarım ve mimari kaynak dokümanı. Yeni bileşen, sayfa veya düzeltme ekleyen tüm geliştiriciler ve AI oturumları bu kurallara uymalıdır.

---

## 1. Visual Identity & Color Tokens (`globals.css` & `tailwind.config.js`)

Platformun görsel dili **"Obsidian & Amethyst Editorial"** üzerine kuruludur: koyu, yüksek kontrastlı yüzeyler kapak sanatını öne çıkarır; vurgu renkleri kontrollü kullanılır.

### Core Surfaces & Borders
| Token | CSS Variable | Hex / Value | Tailwind Class | Kullanım |
| --- | --- | --- | --- | --- |
| Canvas | `--bg-canvas` | `#0B0B0F` | `bg-canvas` | Sayfa tabanı |
| Surface | `--bg-surface` | `#13131A` | `bg-surface` | Kartlar, listeler, bölümler |
| Elevated | `--bg-elevated` | `#1C1C26` | `bg-elevated` | Hover, modal, popover, dropdown |
| Glass | `--bg-glass` | `rgba(19,19,26,0.78)` | `bg-glass backdrop-blur-xl` | Yapışkan header / HUD |
| Border Subtle | `--border-subtle` | `rgba(255,255,255,0.07)` | `border-subtle` | Varsayılan ayırıcılar |
| Border Hover | `--border-hover` | `rgba(255,255,255,0.16)` | `border-hover` | Hover kenarlıkları |
| Brand Primary | `--accent` (default) | `#A855F7` | `bg-brand`, `text-brand` | Global ana aksiyonlar & aktif durumlar |

### Text Hierarchy (WCAG AA+)
- Primary: `--text-primary` (`#F4F4F6` / `text-ink-primary`) — başlıklar ve ana içerik.
- Secondary: `--text-secondary` (`#A1A1AA` / `text-ink-secondary`) — açıklamalar, ikincil etiketler.
- Muted: `--text-muted` (`#71717A` / `text-ink-muted`) — tarih, görüntülenme ve yardımcı meta bilgisi (**asla `text-gray-600` kullanma**).

---

## 2. Anti-Rainbow Rule (Format Accent Scoping)

Global chrome (`Navbar`, `Footer`, arama, filtreler, profil, auth, ana sayfa sekmeleri) **%100 Obsidian + Amethyst (`#A855F7`)** kalır.

Format renkleri (`--accent`, `--accent-soft`, `--accent-border`) **yalnızca**:
1. `<SeriesCard />` üzerindeki küçük format rozetlerinde (`<Badge variant="webtoon|manga|novel" />`),
2. Seri Detay ve Bölüm Okuyucu kapsayıcılarında `[data-series-type="..."]` attribute'u altında kullanılır:

| `data-series-type` | `--accent` | Anlam |
| --- | --- | --- |
| `WEBTOON` | `#38BDF8` (Sky) | Webtoon / Manhwa |
| `MANGA` | `#F59E0B` (Amber) | Manga |
| `NOVEL` | `#A855F7` (Amethyst) | Web Novel |

Seri detay ve okuyucu içindeki reaksiyon, yorum, aktif bölüm ve CTA vurguları sabit `blue-*` yerine `bg-accent`, `text-accent`, `bg-accent-soft`, `border-accent-border` kullanmalıdır.

---

## 3. Strict 3-Font Budget (Turkish `latin-ext` Mandatory)

`src/app/layout.js` içinde **sadece 3 Google Font** yüklenir; **hepsi `subsets: ["latin", "latin-ext"]`** ile tanımlıdır (Türkçe `ğ, ş, ı, İ, ö, ü, ç` karakterlerinde kırılma olmaz):

1. **`Inter`** (`--font-inter` → `font-sans`, `preload: true`): Tüm UI, navigasyon, kartlar ve opsiyonel Sans okuyucu modu.
2. **`Cinzel`** (`--font-cinzel` → `font-display`, `preload: false`): Yalnızca `KAOS MANGA` marka logosu ve özel hero başlıkları.
3. **`Lora`** (`--font-lora` → `font-serif`, `preload: false`): Yalnızca Novel okuyucu metin alanı ve editoryal alıntılar.

> **Yasak**: Yeni `next/font/google` çağrısı ekleme, `Crimson_Pro`/`Lato` geri getirme veya `style={{ fontFamily }}` satır içi font tanımlama (`font-display` / `font-serif` sınıflarını kullan).

---

## 4. Layout Architecture: `(site)` vs `(reader)`

- **Root (`src/app/layout.js`)**: `<html>` font değişkenleri, SEO/JSON-LD, `GoogleAnalytics` ve global `<Toaster />` (`sonner`) içerir. **`<Navbar />` burada render edilmez.**
- **Site Group (`src/app/(site)/layout.js`)**: `.site-canvas` (sadece site sayfalarında görünen üst mor radyal ambient glow) + slim `<Navbar />` (64–68px) + `<Footer />`.
- **Reader Group (`src/app/(reader)/layout.js`)**: Navbar, Footer ve mor arka plan olmadan saf okuma yüzeyi (`data-reader-canvas`). Okuyucu bileşenleri kök sarmalayıcıya `data-reader-theme` ve `data-series-type` atar.

### Reader Themes (`[data-reader-theme]`)
| Theme | `--reader-bg` | `--reader-text` | `--reader-surface` |
| --- | --- | --- | --- |
| `oled` | `#000000` | `#E5E5E7` | `#0D0D12` |
| `charcoal` | `#121216` | `#E4E4E7` | `#1B1B23` |
| `sepia` | `#F4ECD8` | `#3B2F22` | `#EBE0C6` |
| `paper` | `#F8FAFC` | `#1E293B` | `#FFFFFF` |

### Turkish Novel Typography
- İki yana yaslı (justified) novel paragraflarında mutlaka `.prose-novel-justified` (`text-align: justify; hyphens: auto;`) kullan; `<html lang="tr">` sayesinde Türkçe tireleme aktif olur.
- Rich-text HTML çıktısı `dangerouslySetInnerHTML` öncesi daima `isomorphic-dompurify` ile temizlenmeli, satır içi `color`/`background` stilleri atılmalıdır.

---

## 5. Cards, Spacing & Motion

- **Cover Aspect Ratio**: Tüm seri kartları kesinlikle `aspect-[2/3]`, `rounded-xl` ve `ring-1 ring-inset ring-white/10`.
- **Badges**: `text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md` (2 sütunlu mobilde kapağı ezmez).
- **Motion**: Yalnızca CSS transitions (`ease-smooth`, `duration-200`, kapak zoom `duration-500`) ve Tailwind keyframes (`animate-fade-in`, `animate-slide-up`, `animate-scale-in`, `skeleton-shimmer`). **`framer-motion` kurma.**
- **Icons & Feedback**: Tüm ikonlar `lucide-react` (FontAwesome `fa-*` ve UI emojileri yasak). Tüm bildirimler `sonner` `toast()` (tarayıcı `alert()` / `confirm()` yasak).

---

## 6. Shared UI Primitives (`@/components/ui`)

Barrel import: `import { Button, Badge, Dialog, DropdownMenu, Popover, Tabs, Skeleton } from "@/components/ui";`

- **`Button`**: `variant`: `primary | secondary | ghost | outline | danger | accent`; `size`: `sm | md | lg | icon`; `loading?: boolean`. Link'ler için `buttonClasses(...)`.
- **`Badge`**: `variant`: `default | webtoon | manga | novel | ongoing | completed | new | outline`; `tone`: `soft | solid`; `dot?: boolean`. Yardımcı: `badgeVariantFromSeriesType(seriesType)`.
- **`Dialog`**: Radix modal + drawer (`DialogContent` üzerinde `side="center" | "right" | "left" | "bottom"` ve canlı önizleme çekmeceleri için `hideOverlay`).
- **`DropdownMenu` & `Popover`**: Radix portal + collision-aware menüler (`getBoundingClientRect` ile manuel pozisyonlama yasak).
- **`Tabs`**: `variant="pills" | "underline"`.
- **`Skeleton`**: `Skeleton`, `SeriesCardSkeleton`, `ChapterRowSkeleton`.

---

## 7. Core Shared Libraries

### API Client (`@/lib/apiClient`)
- `API` / `PUBLIC_API_URL` / `INTERNAL_API_URL` / `getApiBaseUrl()`
- `resolveMediaUrl(path, fallback = "/placeholder.jpg")`: Backend göreli yollarını ve Docker içi `http://backend:8000` URL'lerini tarayıcıya güvenli URL'lere çevirir.
- `apiFetch(path, { auth: "none" | "user" | "admin", json, next, fallbackToPublic })` & `apiJson<T>(...)` (`ApiError` fırlatır).
- Admin oturum yardımcıları (`sessionStorage` tabanlı, `/login-admin` ve `AdminShell` ile tek kaynak): `getAdminToken`, `setAdminToken`, `clearAdminToken`, `getAdminSession`, `isAdminAuthenticated`, `getAdminAuthHeaders`.
- `src/api.js` yalnızca geriye dönük uyumluluk köprüsüdür; yeni kod doğrudan `@/lib/apiClient` import etmelidir.

### Reading History (`@/lib/readingHistory`)
- Tek `localStorage` anahtarı: `kaos_reading_history_v1` (en fazla 30 seri, `updatedAt` azalan sırada), `${type}:${seriesId}` anahtarlı.
- Fonksiyonlar: `recordChapterRead`, `updateScrollProgress`, `getSeriesProgress`, `getAllReadingHistory`, `removeSeriesProgress`, `clearReadingHistory`, `isChapterRead`.
- SSR-güvenli hook: `useReadingHistory()` → `{ items, hydrated, recordChapterRead, updateScrollProgress, getSeriesProgress, removeSeriesProgress, clearReadingHistory }`. İlk render'da boş döner, `useEffect` içinde hidrate olur, `"reading-history-updated"` custom event + `storage` event ile tüm bileşen ve sekmeleri senkronize eder.

---

## 8. Do / Don't Checklist

- **DO** use `@/lib/apiClient` (`apiFetch`, `apiJson`, `resolveMediaUrl`) instead of hardcoding `https://kaosmanga.net/api` or `http://backend:8000`.
- **DO** use `@/components/ui` primitives, `lucide-react` icons, and `sonner` `toast` for all interactive UI.
- **DO** keep global pages in Obsidian + Amethyst and scope Webtoon/Manga/Novel accents via `[data-series-type]`.
- **DO** guard keyboard shortcuts (`ArrowLeft`/`ArrowRight`) against `INPUT`, `TEXTAREA`, and `contentEditable` targets.
- **DO** wait for `hydrated === true` from `useReadingHistory()` before rendering client-only progress UI.
- **DON'T** re-add `body::before` global gradients, `alert()`, FontAwesome classes, raw UI emojis, `axios`, `react-quill`, or `framer-motion`.
- **DON'T** read admin tokens from `localStorage` — admin auth lives exclusively in `sessionStorage` via `getAdminToken()`.
- **DON'T** link series by numeric ID when `slug` is available (`/${type}/${series.slug || series.id}`).
