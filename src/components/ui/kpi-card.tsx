import * as React from "react";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: LucideIcon;
  trend?: {
    value: string;
    isPositive?: boolean;
    isNeutral?: boolean;
  };
  variant?: "default" | "success" | "warning" | "danger" | "info";
  className?: string;
}

export function KPICard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  variant = "default",
  className,
}: KPICardProps) {
  const iconBgStyles: Record<string, string> = {
    default: "bg-teal-50 text-teal-700",
    success: "bg-emerald-50 text-emerald-700",
    warning: "bg-amber-50 text-amber-700",
    danger: "bg-red-50 text-red-700",
    info: "bg-blue-50 text-blue-700",
  };

  return (
    <div
      className={cn(
        "rounded-lg border border-slate-200 bg-white p-4 shadow-2xs transition-all hover:border-slate-300",
        className
      )}
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
          {title}
        </p>
        {Icon && (
          <div className={cn("rounded-md p-2", iconBgStyles[variant])}>
            <Icon className="h-4 w-4" />
          </div>
        )}
      </div>

      <div className="mt-2 flex items-baseline gap-2">
        <h4 className="text-xl font-bold tracking-tight text-slate-900">
          {value}
        </h4>
        {trend && (
          <span
            className={cn(
              "text-xs font-medium",
              trend.isNeutral
                ? "text-slate-500"
                : trend.isPositive
                ? "text-emerald-700"
                : "text-red-600"
            )}
          >
            {trend.value}
          </span>
        )}
      </div>

      {subtitle && (
        <p className="mt-1 text-xs text-slate-500 truncate">{subtitle}</p>
      )}
    </div>
  );
}
