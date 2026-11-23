"use client";

import React, { forwardRef } from "react";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { Check, Circle } from "lucide-react";

export const DropdownMenu = DropdownMenuPrimitive.Root;
export const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;
export const DropdownMenuGroup = DropdownMenuPrimitive.Group;
export const DropdownMenuPortal = DropdownMenuPrimitive.Portal;
export const DropdownMenuSub = DropdownMenuPrimitive.Sub;
export const DropdownMenuRadioGroup = DropdownMenuPrimitive.RadioGroup;

export const DropdownMenuContent = forwardRef(function DropdownMenuContent(
  {
    className = "",
    sideOffset = 6,
    collisionPadding = 12,
    align = "end",
    ...props
  },
  ref
) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        ref={ref}
        align={align}
        sideOffset={sideOffset}
        collisionPadding={collisionPadding}
        className={[
          "z-50 min-w-[12.5rem] overflow-hidden rounded-xl border border-white/10",
          "bg-elevated/95 backdrop-blur-xl p-1.5 text-ink-primary shadow-2xl",
          "data-[state=open]:animate-scale-in focus:outline-none",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  );
});
DropdownMenuContent.displayName = "DropdownMenuContent";

export const DropdownMenuItem = forwardRef(function DropdownMenuItem(
  { className = "", inset = false, destructive = false, ...props },
  ref
) {
  return (
    <DropdownMenuPrimitive.Item
      ref={ref}
      className={[
        "relative flex cursor-pointer select-none items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm outline-none transition-colors",
        "data-[disabled]:pointer-events-none data-[disabled]:opacity-45",
        destructive
          ? "text-rose-400 focus:bg-rose-500/15 focus:text-rose-300"
          : "text-ink-secondary focus:bg-white/[0.07] focus:text-ink-primary",
        inset ? "pl-8" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    />
  );
});
DropdownMenuItem.displayName = "DropdownMenuItem";

export const DropdownMenuCheckboxItem = forwardRef(
  function DropdownMenuCheckboxItem(
    { className = "", children, checked, ...props },
    ref
  ) {
    return (
      <DropdownMenuPrimitive.CheckboxItem
        ref={ref}
        checked={checked}
        className={[
          "relative flex cursor-pointer select-none items-center rounded-lg py-2 pl-8 pr-2.5 text-sm text-ink-secondary outline-none transition-colors",
          "focus:bg-white/[0.07] focus:text-ink-primary data-[disabled]:pointer-events-none data-[disabled]:opacity-45",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
        {...props}
      >
        <span className="absolute left-2.5 flex h-4 w-4 items-center justify-center">
          <DropdownMenuPrimitive.ItemIndicator>
            <Check className="h-4 w-4 text-brand" />
          </DropdownMenuPrimitive.ItemIndicator>
        </span>
        {children}
      </DropdownMenuPrimitive.CheckboxItem>
    );
  }
);
DropdownMenuCheckboxItem.displayName = "DropdownMenuCheckboxItem";

export const DropdownMenuRadioItem = forwardRef(function DropdownMenuRadioItem(
  { className = "", children, ...props },
  ref
) {
  return (
    <DropdownMenuPrimitive.RadioItem
      ref={ref}
      className={[
        "relative flex cursor-pointer select-none items-center rounded-lg py-2 pl-8 pr-2.5 text-sm text-ink-secondary outline-none transition-colors",
        "focus:bg-white/[0.07] focus:text-ink-primary data-[disabled]:pointer-events-none data-[disabled]:opacity-45",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    >
      <span className="absolute left-2.5 flex h-3.5 w-3.5 items-center justify-center">
        <DropdownMenuPrimitive.ItemIndicator>
          <Circle className="h-2 w-2 fill-brand text-brand" />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </DropdownMenuPrimitive.RadioItem>
  );
});
DropdownMenuRadioItem.displayName = "DropdownMenuRadioItem";

export const DropdownMenuLabel = forwardRef(function DropdownMenuLabel(
  { className = "", inset = false, ...props },
  ref
) {
  return (
    <DropdownMenuPrimitive.Label
      ref={ref}
      className={[
        "px-2.5 py-1.5 text-xs font-semibold text-ink-muted uppercase tracking-wider",
        inset ? "pl-8" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    />
  );
});
DropdownMenuLabel.displayName = "DropdownMenuLabel";

export const DropdownMenuSeparator = forwardRef(function DropdownMenuSeparator(
  { className = "", ...props },
  ref
) {
  return (
    <DropdownMenuPrimitive.Separator
      ref={ref}
      className={`my-1.5 h-px bg-white/[0.08] ${className}`}
      {...props}
    />
  );
});
DropdownMenuSeparator.displayName = "DropdownMenuSeparator";

export function DropdownMenuShortcut({ className = "", ...props }) {
  return (
    <span
      className={`ml-auto text-[11px] tracking-widest text-ink-muted ${className}`}
      {...props}
    />
  );
}
