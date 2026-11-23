/**
 * Distraction-free layout wrapper for chapter reader routes (`(reader)` route group).
 * Renders without global Navbar, Footer, or `.site-canvas` purple ambient glow
 * so OLED, Charcoal, Sepia, and Paper reader themes own 100% of the viewport.
 */
export default function ReaderLayout({ children }) {
  return (
    <div
      data-reader-canvas=""
      className="min-h-screen w-full bg-[var(--reader-bg,var(--bg-canvas))] text-[var(--reader-text,var(--text-primary))] transition-colors duration-200"
    >
      {children}
    </div>
  );
}
