"use client";

import React, { forwardRef } from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";

export const Popover = PopoverPrimitive.Root;
export const PopoverTrigger = PopoverPrimitive.Trigger;
export const PopoverAnchor = PopoverPrimitive.Anchor;
export const PopoverClose = PopoverPrimitive.Close;
export const PopoverPortal = PopoverPrimitive.Portal;

export const PopoverContent = forwardRef(function PopoverContent(
  {
    className = "",
    align = "end",
    sideOffset = 8,
    collisionPadding = 12,
    ...props
  },
  ref
) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        ref={ref}
        align={align}
        sideOffset={sideOffset}
        collisionPadding={collisionPadding}
        className={[
          "z-50 w-80 max-w-[calc(100vw-1.5rem)] rounded-2xl border border-white/10",
          "bg-elevated/95 backdrop-blur-xl p-4 text-ink-primary shadow-2xl outline-none",
          "data-[state=open]:animate-scale-in",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
        {...props}
      />
    </PopoverPrimitive.Portal>
  );
});
PopoverContent.displayName = "PopoverContent";
