"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Pill,
  Boxes,
  Layers,
  CalendarX,
  AlertTriangle,
  ArrowLeftRight,
  SlidersHorizontal,
  ClipboardCheck,
  Building2,
  FileSpreadsheet,
  PackageCheck,
  Receipt,
  RotateCcw,
  CreditCard,
  ShoppingCart,
  ReceiptText,
  FileText,
  GitBranch,
  Users,
  Bell,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  title: string;
  href: string;
  icon: React.ElementType;
  badge?: string;
  badgeVariant?: "warning" | "danger" | "info" | "neutral";
  requiredPermission?: string;
}

interface NavGroup {
  group: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    group: "OVERVIEW",
    items: [
      { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    ],
  },
  {
    group: "INVENTORY",
    items: [
      { title: "Medicines", href: "/inventory/medicines", icon: Pill },
      { title: "Inventory & Stock", href: "/inventory/stock", icon: Boxes },
      { title: "Batch Management", href: "/inventory/batches", icon: Layers },
      {
        title: "Expiry Management",
        href: "/inventory/expiry",
        icon: CalendarX,
        badge: "Alerts",
        badgeVariant: "danger",
      },
      {
        title: "Low Stock & Reorder",
        href: "/inventory/reorder",
        icon: AlertTriangle,
        badge: "Low",
        badgeVariant: "warning",
      },
      { title: "Stock Transfers", href: "/inventory/transfers", icon: ArrowLeftRight },
      { title: "Stock Adjustments", href: "/inventory/adjustments", icon: SlidersHorizontal },
      { title: "Stock Count", href: "/inventory/counts", icon: ClipboardCheck },
    ],
  },
  {
    group: "PURCHASES",
    items: [
      { title: "Vendors", href: "/purchases/vendors", icon: Building2 },
      { title: "Purchase Orders", href: "/purchases/orders", icon: FileSpreadsheet },
      { title: "Goods Received", href: "/purchases/receipts", icon: PackageCheck },
      { title: "Vendor Invoices", href: "/purchases/invoices", icon: Receipt },
      { title: "Purchase Returns", href: "/purchases/returns", icon: RotateCcw },
      { title: "Vendor Payments", href: "/purchases/payments", icon: CreditCard },
    ],
  },
  {
    group: "SALES",
    items: [
      {
        title: "POS / Billing",
        href: "/sales/pos",
        icon: ShoppingCart,
        badge: "POS",
        badgeVariant: "info",
      },
      { title: "Sales Invoices", href: "/sales/invoices", icon: ReceiptText },
      { title: "Returns & Refunds", href: "/sales/returns", icon: RotateCcw },
      { title: "Prescriptions", href: "/sales/prescriptions", icon: FileText },
    ],
  },
  {
    group: "OPERATIONS",
    items: [
      { title: "Branches & Locations", href: "/operations/branches", icon: GitBranch },
      { title: "Staff & Permissions", href: "/operations/staff", icon: Users },
      { title: "Notifications", href: "/operations/notifications", icon: Bell },
    ],
  },
  {
    group: "REPORTS",
    items: [
      { title: "All Reports", href: "/reports", icon: BarChart3 },
      { title: "Audit Logs", href: "/reports/audit-logs", icon: ShieldAlert },
    ],
  },
  {
    group: "SETTINGS",
    items: [
      { title: "Settings", href: "/settings", icon: Settings },
    ],
  },
];

export function Sidebar({
  isPlatformAdmin = false,
  tenantName = "Apex MedCare",
}: {
  isPlatformAdmin?: boolean;
  tenantName?: string;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = React.useState(false);

  return (
    <aside
      className={cn(
        "flex flex-col border-r border-slate-200 bg-white transition-all duration-200 select-none shrink-0 z-30",
        collapsed ? "w-16" : "w-60"
      )}
    >
      {/* Brand Header */}
      <div className="flex h-14 items-center justify-between border-b border-slate-200 px-3.5">
        {!collapsed && (
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[#0F766E] text-white font-bold text-sm shadow-xs">
              P
            </div>
            <div className="truncate">
              <h1 className="text-sm font-bold text-slate-900 tracking-tight leading-none">
                PharmaPulse
              </h1>
              <p className="text-[11px] font-medium text-slate-500 truncate mt-0.5">
                {isPlatformAdmin ? "Super Admin" : tenantName}
              </p>
            </div>
          </div>
        )}
        {collapsed && (
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[#0F766E] text-white font-bold text-sm mx-auto">
            P
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            "rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors",
            collapsed && "mx-auto mt-2"
          )}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Nav List */}
      <div className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
        {isPlatformAdmin && (
          <div className="space-y-1">
            {!collapsed && (
              <p className="px-2 text-[10px] font-bold uppercase tracking-wider text-teal-800">
                PLATFORM SUPER ADMIN
              </p>
            )}
            <Link
              href="/admin/tenants"
              className={cn(
                "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                pathname.startsWith("/admin")
                  ? "bg-teal-50 text-[#0F766E] font-semibold"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                collapsed && "justify-center px-0"
              )}
            >
              <ShieldAlert className="h-4 w-4 shrink-0 text-teal-700" />
              {!collapsed && <span>Tenant Management</span>}
            </Link>
          </div>
        )}

        {NAV_GROUPS.map((group) => (
          <div key={group.group} className="space-y-1">
            {!collapsed && (
              <p className="px-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {group.group}
              </p>
            )}
            {group.items.map((item) => {
              const isActive =
                item.href === "/dashboard"
                  ? pathname === "/dashboard"
                  : pathname.startsWith(item.href);
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={collapsed ? item.title : undefined}
                  className={cn(
                    "group flex items-center justify-between rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                    isActive
                      ? "bg-teal-50 text-[#0F766E] font-semibold shadow-2xs"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                    collapsed && "justify-center px-0"
                  )}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Icon
                      className={cn(
                        "h-4 w-4 shrink-0 transition-colors",
                        isActive
                          ? "text-[#0F766E]"
                          : "text-slate-400 group-hover:text-slate-600"
                      )}
                    />
                    {!collapsed && <span className="truncate">{item.title}</span>}
                  </div>
                  {!collapsed && item.badge && (
                    <span
                      className={cn(
                        "rounded px-1.5 py-0.2 text-[10px] font-semibold uppercase",
                        item.badgeVariant === "danger" &&
                          "bg-red-100 text-red-700",
                        item.badgeVariant === "warning" &&
                          "bg-amber-100 text-amber-800",
                        item.badgeVariant === "info" &&
                          "bg-blue-100 text-blue-700",
                        item.badgeVariant === "neutral" &&
                          "bg-slate-100 text-slate-600"
                      )}
                    >
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </div>
    </aside>
  );
}
