import React, { forwardRef } from "react";
import { Loader2 } from "lucide-react";

const VARIANT_CLASSES = {
  primary:
    "bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white shadow-sm shadow-purple-500/20 border border-purple-400/25",
  secondary:
    "bg-elevated hover:bg-white/[0.11] text-ink-primary border border-subtle hover:border-hover",
  ghost:
    "bg-transparent hover:bg-white/[0.06] text-ink-secondary hover:text-ink-primary border border-transparent",
  outline:
    "bg-transparent hover:bg-white/[0.05] text-ink-primary border border-white/15 hover:border-white/25",
  danger:
    "bg-rose-600/90 hover:bg-rose-600 text-white border border-rose-500/30 shadow-sm shadow-rose-950/30",
  accent:
    "bg-accent text-[#0B0B0F] font-semibold hover:brightness-110 active:brightness-95 border border-white/10 shadow-sm",
};

const SIZE_CLASSES = {
  sm: "h-8 px-3 text-xs rounded-lg gap-1.5",
  md: "h-10 px-4 text-sm rounded-xl gap-2",
  lg: "h-11 px-5 text-sm rounded-xl gap-2",
  icon: "h-9 w-9 p-0 rounded-xl shrink-0",
};

export function buttonClasses({
  variant = "primary",
  size = "md",
  className = "",
} = {}) {
  return [
    "inline-flex items-center justify-center font-medium select-none whitespace-nowrap",
    "transition-all duration-200 ease-smooth",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas",
    "disabled:opacity-50 disabled:pointer-events-none",
    VARIANT_CLASSES[variant] || VARIANT_CLASSES.primary,
    SIZE_CLASSES[size] || SIZE_CLASSES.md,
    className,
  ]
    .filter(Boolean)
    .join(" ");
}

/**
 * Obsidian & Amethyst button primitive.
 * @param {object} props
 * @param {"primary"|"secondary"|"ghost"|"outline"|"danger"|"accent"} [props.variant="primary"]
 * @param {"sm"|"md"|"lg"|"icon"} [props.size="md"]
 * @param {boolean} [props.loading=false]
 */
const Button = forwardRef(function Button(
  {
    variant = "primary",
    size = "md",
    type = "button",
    loading = false,
    disabled = false,
    className = "",
    children,
    ...props
  },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClasses({ variant, size, className })}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin shrink-0" aria-hidden="true" />}
      {children}
    </button>
  );
});

Button.displayName = "Button";

export { Button };
export default Button;
