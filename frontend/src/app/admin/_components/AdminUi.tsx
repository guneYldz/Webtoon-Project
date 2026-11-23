"use client";

import React from "react";
import { ChevronLeft, ChevronRight, AlertTriangle } from "lucide-react";
import {
  Button as RawButton,
  Badge as RawBadge,
  Dialog as RawDialog,
  DialogContent as RawDialogContent,
  DialogHeader as RawDialogHeader,
  DialogTitle as RawDialogTitle,
  DialogDescription as RawDialogDescription,
  DialogFooter as RawDialogFooter,
} from "@/components/ui";
import RawCategoryPicker from "@/components/CategoryPicker";

export interface UiButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "outline" | "danger" | "accent";
  size?: "sm" | "md" | "lg" | "icon";
  loading?: boolean;
  children?: React.ReactNode;
}

export interface UiBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?:
    | "default"
    | "webtoon"
    | "manga"
    | "novel"
    | "ongoing"
    | "completed"
    | "new"
    | "outline";
  tone?: "soft" | "solid";
  size?: "sm" | "md";
  dot?: boolean;
  children?: React.ReactNode;
}

export const Button = RawButton as React.ComponentType<UiButtonProps>;
export const Badge = RawBadge as React.ComponentType<UiBadgeProps>;
export const Dialog = RawDialog as React.ComponentType<any>;
export const DialogContent = RawDialogContent as React.ComponentType<any>;
export const DialogHeader = RawDialogHeader as React.ComponentType<any>;
export const DialogTitle = RawDialogTitle as React.ComponentType<any>;
export const DialogDescription = RawDialogDescription as React.ComponentType<any>;
export const DialogFooter = RawDialogFooter as React.ComponentType<any>;
export const TypedCategoryPicker = RawCategoryPicker as React.ComponentType<{
  api: string;
  token: string;
  selectedIds: number[];
  onChange: (ids: number[]) => void;
}>;

export const adminCardClass =
  "bg-surface border border-subtle rounded-2xl shadow-sm";

export const adminInputClass =
  "w-full h-10 px-3.5 rounded-xl bg-canvas border border-subtle text-sm text-ink-primary placeholder:text-ink-muted outline-none focus:border-brand/60 transition";

export const adminTextareaClass =
  "w-full px-3.5 py-2.5 rounded-xl bg-canvas border border-subtle text-sm text-ink-primary placeholder:text-ink-muted outline-none focus:border-brand/60 transition";

export const adminSelectClass =
  "h-10 px-3.5 rounded-xl bg-canvas border border-subtle text-sm text-ink-primary outline-none focus:border-brand/60 transition cursor-pointer";

export const adminLabelClass =
  "block text-xs font-semibold uppercase tracking-wider text-ink-secondary mb-1.5";

export function AdminPageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-ink-primary">
          {title}
        </h1>
        {description && (
          <p className="text-sm text-ink-secondary mt-1">{description}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function AdminConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Onayla",
  cancelLabel = "Vazgeç",
  variant = "danger",
  loading = false,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "primary";
  loading?: boolean;
  onConfirm: () => void | Promise<void>;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle
              className={`h-5 w-5 shrink-0 ${
                variant === "danger" ? "text-rose-400" : "text-brand"
              }`}
              aria-hidden="true"
            />
            <span>{title}</span>
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button
            type="button"
            variant="secondary"
            disabled={loading}
            onClick={() => onOpenChange(false)}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={variant}
            loading={loading}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function AdminPagination({
  page,
  totalPages,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  onPageChange: (next: number) => void;
}) {
  if (!totalPages || totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-2 mt-6">
      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled={page <= 1}
        onClick={() => onPageChange(Math.max(1, page - 1))}
      >
        <ChevronLeft className="h-4 w-4" />
        Önceki
      </Button>
      <span className="px-3 text-xs font-medium text-ink-secondary tabular-nums">
        Sayfa {page} / {totalPages}
      </span>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled={page >= totalPages}
        onClick={() => onPageChange(Math.min(totalPages, page + 1))}
      >
        Sonraki
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
