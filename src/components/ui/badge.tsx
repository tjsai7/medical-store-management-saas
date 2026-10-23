import * as React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?:
    | "default"
    | "success"
    | "warning"
    | "danger"
    | "info"
    | "outline"
    | "neutral";
  size?: "sm" | "md";
}

export function Badge({
  className,
  variant = "default",
  size = "md",
  children,
  ...props
}: BadgeProps) {
  const baseStyles =
    "inline-flex items-center font-medium rounded-full transition-colors select-none";

  const variantStyles: Record<string, string> = {
    default: "bg-teal-50 text-teal-800 border border-teal-200",
    neutral: "bg-slate-100 text-slate-700 border border-slate-200",
    success: "bg-emerald-50 text-emerald-800 border border-emerald-200",
    warning: "bg-amber-50 text-amber-800 border border-amber-200",
    danger: "bg-red-50 text-red-800 border border-red-200",
    info: "bg-blue-50 text-blue-800 border border-blue-200",
    outline: "text-slate-700 border border-slate-300 bg-transparent",
  };

  const sizeStyles: Record<string, string> = {
    sm: "px-2 py-0.5 text-[11px] leading-tight gap-1",
    md: "px-2.5 py-0.5 text-xs gap-1.5",
  };

  return (
    <div
      className={cn(baseStyles, variantStyles[variant], sizeStyles[size], className)}
      {...props}
    >
      {children}
    </div>
  );
}
