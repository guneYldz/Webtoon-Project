"use client";

import React, { forwardRef } from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";

export const Tabs = TabsPrimitive.Root;

export const TabsList = forwardRef(function TabsList(
  { className = "", variant = "pills", ...props },
  ref
) {
  const variantClasses =
    variant === "underline"
      ? "inline-flex items-center gap-1 border-b border-subtle bg-transparent p-0"
      : "inline-flex items-center gap-1 rounded-xl border border-subtle bg-surface p-1";

  return (
    <TabsPrimitive.List
      ref={ref}
      className={[variantClasses, className].filter(Boolean).join(" ")}
      {...props}
    />
  );
});
TabsList.displayName = "TabsList";

export const TabsTrigger = forwardRef(function TabsTrigger(
  { className = "", variant = "pills", ...props },
  ref
) {
  const variantClasses =
    variant === "underline"
      ? [
          "relative inline-flex items-center justify-center gap-1.5 whitespace-nowrap px-3.5 py-2.5 text-sm font-medium text-ink-secondary transition-colors",
          "hover:text-ink-primary border-b-2 border-transparent -mb-px",
          "data-[state=active]:border-brand data-[state=active]:text-ink-primary",
        ].join(" ")
      : [
          "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3.5 py-1.5 text-sm font-medium text-ink-secondary transition-all duration-150",
          "hover:text-ink-primary",
          "data-[state=active]:bg-elevated data-[state=active]:text-ink-primary data-[state=active]:shadow-sm data-[state=active]:ring-1 data-[state=active]:ring-white/10",
        ].join(" ");

  return (
    <TabsPrimitive.Trigger
      ref={ref}
      className={[
        variantClasses,
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60",
        "disabled:pointer-events-none disabled:opacity-45",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    />
  );
});
TabsTrigger.displayName = "TabsTrigger";

export const TabsContent = forwardRef(function TabsContent(
  { className = "", ...props },
  ref
) {
  return (
    <TabsPrimitive.Content
      ref={ref}
      className={[
        "mt-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 rounded-lg",
        "data-[state=active]:animate-fade-in",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    />
  );
});
TabsContent.displayName = "TabsContent";
