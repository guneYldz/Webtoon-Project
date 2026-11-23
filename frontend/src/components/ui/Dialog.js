"use client";

import React, { forwardRef } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogPortal = DialogPrimitive.Portal;
export const DialogClose = DialogPrimitive.Close;

export const DialogOverlay = forwardRef(function DialogOverlay(
  { className = "", ...props },
  ref
) {
  return (
    <DialogPrimitive.Overlay
      ref={ref}
      className={[
        "fixed inset-0 z-50 bg-black/70 backdrop-blur-sm",
        "data-[state=open]:animate-fade-in data-[state=closed]:animate-fade-out",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    />
  );
});
DialogOverlay.displayName = "DialogOverlay";

const POSITION_CLASSES = {
  center:
    "left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100vw-2rem)] max-w-lg rounded-2xl border border-white/10 bg-surface p-6 shadow-2xl data-[state=open]:animate-scale-in",
  right:
    "inset-y-0 right-0 h-full w-full max-w-sm border-l border-white/10 bg-surface/95 backdrop-blur-xl p-5 shadow-2xl data-[state=open]:animate-fade-in",
  left:
    "inset-y-0 left-0 h-full w-full max-w-xs border-r border-white/10 bg-surface/95 backdrop-blur-xl p-5 shadow-2xl data-[state=open]:animate-fade-in",
  bottom:
    "inset-x-0 bottom-0 w-full max-h-[85vh] overflow-y-auto rounded-t-2xl border-t border-white/10 bg-surface/95 backdrop-blur-xl p-5 shadow-2xl data-[state=open]:animate-slide-up",
};

/**
 * Accessible Radix Dialog / Drawer content.
 * Supports `side="center" | "right" | "left" | "bottom"` and optional `hideOverlay`
 * (useful for live-preview reader settings drawers).
 */
export const DialogContent = forwardRef(function DialogContent(
  {
    className = "",
    overlayClassName = "",
    children,
    side = "center",
    showClose = true,
    hideOverlay = false,
    ...props
  },
  ref
) {
  const posClass = POSITION_CLASSES[side] || POSITION_CLASSES.center;

  return (
    <DialogPortal>
      {!hideOverlay && <DialogOverlay className={overlayClassName} />}
      <DialogPrimitive.Content
        ref={ref}
        className={[
          "fixed z-50 text-ink-primary focus:outline-none",
          posClass,
          className,
        ]
          .filter(Boolean)
          .join(" ")}
        {...props}
      >
        {children}
        {showClose && (
          <DialogPrimitive.Close
            aria-label="Kapat"
            className="absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-lg text-ink-secondary hover:text-ink-primary hover:bg-white/[0.07] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
          >
            <X className="h-4 w-4" />
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  );
});
DialogContent.displayName = "DialogContent";

export function DialogHeader({ className = "", ...props }) {
  return (
    <div
      className={`flex flex-col space-y-1.5 text-left pr-8 ${className}`}
      {...props}
    />
  );
}

export function DialogFooter({ className = "", ...props }) {
  return (
    <div
      className={`flex flex-col-reverse sm:flex-row sm:justify-end gap-2 mt-6 ${className}`}
      {...props}
    />
  );
}

export const DialogTitle = forwardRef(function DialogTitle(
  { className = "", ...props },
  ref
) {
  return (
    <DialogPrimitive.Title
      ref={ref}
      className={`text-lg font-bold tracking-tight text-ink-primary ${className}`}
      {...props}
    />
  );
});
DialogTitle.displayName = "DialogTitle";

export const DialogDescription = forwardRef(function DialogDescription(
  { className = "", ...props },
  ref
) {
  return (
    <DialogPrimitive.Description
      ref={ref}
      className={`text-sm text-ink-secondary ${className}`}
      {...props}
    />
  );
});
DialogDescription.displayName = "DialogDescription";
