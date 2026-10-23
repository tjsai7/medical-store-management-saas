"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Search,
  Bell,
  Building,
  ChevronDown,
  LogOut,
  User as UserIcon,
  ShoppingCart,
  CheckCircle2,
} from "lucide-react";
import { Badge } from "@/lib/../components/ui/badge";

interface TopbarProps {
  user: {
    fullName: string;
    email: string;
    isPlatformAdmin: boolean;
  };
  role: {
    name: string;
    code: string;
  } | null;
  activeBranch: {
    id: string;
    name: string;
    code: string;
  } | null;
  branches: Array<{
    id: string;
    name: string;
    code: string;
  }>;
}

export function Topbar({ user, role, activeBranch, branches }: TopbarProps) {
  const router = useRouter();
  const [profileOpen, setProfileOpen] = React.useState(false);
  const [branchOpen, setBranchOpen] = React.useState(false);
  const [notifOpen, setNotifOpen] = React.useState(false);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  const handleSwitchBranch = async (branchId: string) => {
    setBranchOpen(false);
    await fetch("/api/auth/switch-branch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ branchId }),
    });
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-20 flex h-14 w-full items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6">
      {/* Left: Active Branch Selector & Search */}
      <div className="flex items-center gap-3">
        {activeBranch && (
          <div className="relative">
            <button
              onClick={() => setBranchOpen(!branchOpen)}
              className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-100 transition-colors"
            >
              <Building className="h-3.5 w-3.5 text-[#0F766E]" />
              <span className="max-w-[160px] truncate">{activeBranch.name}</span>
              <span className="text-[10px] text-slate-500 font-normal">({activeBranch.code})</span>
              <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
            </button>

            {branchOpen && (
              <div className="absolute left-0 mt-1 w-64 rounded-md border border-slate-200 bg-white p-1 shadow-lg z-50">
                <p className="px-2 py-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Switch Store Location
                </p>
                {branches.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => handleSwitchBranch(b.id)}
                    className="flex w-full items-center justify-between rounded px-2 py-1.5 text-xs text-slate-700 hover:bg-teal-50 hover:text-teal-900 transition-colors"
                  >
                    <div className="text-left">
                      <p className="font-medium">{b.name}</p>
                      <p className="text-[10px] text-slate-400">Code: {b.code}</p>
                    </div>
                    {b.id === activeBranch.id && (
                      <CheckCircle2 className="h-4 w-4 text-[#0F766E]" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Global Search Bar */}
        <div className="relative hidden md:flex items-center">
          <Search className="absolute left-2.5 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search medicine, SKU, batch, or bill..."
            className="h-8 w-64 rounded-md border border-slate-200 bg-slate-50 pl-8 pr-3 text-xs text-slate-800 placeholder:text-slate-400 focus:border-[#0F766E] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#0F766E] transition-all"
          />
        </div>
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-2.5">
        {/* Quick Launch POS */}
        <Link
          href="/sales/pos"
          className="hidden sm:inline-flex items-center gap-1.5 rounded-md bg-[#0F766E] px-3 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-[#115E59] transition-colors"
        >
          <ShoppingCart className="h-3.5 w-3.5" />
          <span>Open POS (F8)</span>
        </Link>

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => setNotifOpen(!notifOpen)}
            className="relative rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
          >
            <Bell className="h-4 w-4" />
            <span className="absolute top-1.5 right-1.5 flex h-2 w-2 rounded-full bg-amber-500 ring-2 ring-white" />
          </button>

          {notifOpen && (
            <div className="absolute right-0 mt-1 w-80 rounded-md border border-slate-200 bg-white p-3 shadow-xl z-50">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <p className="text-xs font-semibold text-slate-900">Notifications</p>
                <Link
                  href="/operations/notifications"
                  onClick={() => setNotifOpen(false)}
                  className="text-[11px] text-[#0F766E] hover:underline"
                >
                  View all
                </Link>
              </div>
              <div className="py-2 space-y-2 text-xs">
                <div className="p-2 rounded bg-amber-50 border border-amber-200">
                  <p className="font-semibold text-amber-900">Near Expiry Alert</p>
                  <p className="text-[11px] text-amber-800 mt-0.5">
                    Dolo 650mg Batch DL23M09 (18 strips) expires within 30 days.
                  </p>
                </div>
                <div className="p-2 rounded bg-red-50 border border-red-200">
                  <p className="font-semibold text-red-900">Critical Low Stock</p>
                  <p className="text-[11px] text-red-800 mt-0.5">
                    Telma 40mg Tablet is at 9 units (Threshold: 25).
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* User Profile */}
        <div className="relative">
          <button
            onClick={() => setProfileOpen(!profileOpen)}
            className="flex items-center gap-2 rounded-md p-1 hover:bg-slate-100 transition-colors"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-teal-100 text-[#0F766E] font-semibold text-xs border border-teal-200">
              {user.fullName.charAt(0)}
            </div>
            <div className="hidden text-left sm:block">
              <p className="text-xs font-semibold text-slate-800 leading-tight">
                {user.fullName}
              </p>
              <p className="text-[10px] text-slate-500 font-medium">
                {role ? role.name : user.isPlatformAdmin ? "Super Admin" : "User"}
              </p>
            </div>
            <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
          </button>

          {profileOpen && (
            <div className="absolute right-0 mt-1 w-56 rounded-md border border-slate-200 bg-white p-1 shadow-lg z-50">
              <div className="px-3 py-2 border-b border-slate-100">
                <p className="text-xs font-semibold text-slate-900">{user.fullName}</p>
                <p className="text-[11px] text-slate-500 truncate">{user.email}</p>
                <div className="mt-1">
                  <Badge variant="default" size="sm">
                    {role ? role.name : "Super Admin"}
                  </Badge>
                </div>
              </div>
              <div className="py-1">
                <Link
                  href="/settings"
                  onClick={() => setProfileOpen(false)}
                  className="flex items-center gap-2 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-100 rounded"
                >
                  <UserIcon className="h-3.5 w-3.5 text-slate-500" />
                  <span>Account & Settings</span>
                </Link>
                <button
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 rounded"
                >
                  <LogOut className="h-3.5 w-3.5 text-red-500" />
                  <span>Sign out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
