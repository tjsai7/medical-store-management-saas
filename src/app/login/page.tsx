"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Shield, Sparkles, Building2 } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = React.useState("owner@apexmedcare.com");
  const [password, setPassword] = React.useState("Pharmacy@12345");
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Login failed");
        setLoading(false);
        return;
      }

      if (data.user.isPlatformAdmin) {
        router.push("/admin/tenants");
      } else {
        router.push("/dashboard");
      }
      router.refresh();
    } catch {
      setError("An unexpected error occurred. Please check your connection.");
      setLoading(false);
    }
  };

  const handleQuickLogin = (quickEmail: string, quickPass: string) => {
    setEmail(quickEmail);
    setPassword(quickPass);
    setError("");
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-1.5">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-[#0F766E] text-white shadow-sm font-bold text-xl">
            P
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            PharmaPulse ERP
          </h1>
          <p className="text-xs text-slate-500">
            Medical Store & Pharmacy Chain Management SaaS
          </p>
        </div>

        {/* Login Card */}
        <Card className="border border-slate-200 shadow-sm bg-white">
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Sign in to your pharmacy</CardTitle>
            <CardDescription className="text-xs">
              Enter your credentials to access your store inventory, billing & reports.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <div className="rounded-md bg-red-50 p-3 text-xs text-red-700 border border-red-200">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3.5">
              <Input
                label="Email Address"
                type="email"
                placeholder="you@pharmacy.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />

              <Input
                label="Password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />

              <Button
                type="submit"
                variant="primary"
                className="w-full mt-2"
                isLoading={loading}
              >
                Sign In
              </Button>
            </form>

            {/* Quick Demo Role Presets */}
            <div className="pt-4 border-t border-slate-100 space-y-2.5">
              <div className="flex items-center gap-1.5 text-slate-500 text-[11px] font-semibold uppercase tracking-wider">
                <Sparkles className="h-3 w-3 text-amber-500" />
                <span>Instant Demo Login Presets</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() =>
                    handleQuickLogin("owner@apexmedcare.com", "Pharmacy@12345")
                  }
                  className="flex items-center gap-2 p-2 rounded-md border border-slate-200 bg-slate-50/80 hover:bg-teal-50 hover:border-teal-200 hover:text-teal-900 text-left transition-colors cursor-pointer"
                >
                  <Building2 className="h-3.5 w-3.5 text-[#0F766E] shrink-0" />
                  <div className="truncate">
                    <p className="font-semibold text-slate-800">Pharmacy Owner</p>
                    <p className="text-[10px] text-slate-500 truncate">Dr. Rajesh Varma</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    handleQuickLogin("pharmacist@apexmedcare.com", "Pharmacy@12345")
                  }
                  className="flex items-center gap-2 p-2 rounded-md border border-slate-200 bg-slate-50/80 hover:bg-teal-50 hover:border-teal-200 hover:text-teal-900 text-left transition-colors cursor-pointer"
                >
                  <Shield className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                  <div className="truncate">
                    <p className="font-semibold text-slate-800">Pharmacist</p>
                    <p className="text-[10px] text-slate-500 truncate">Kiran Sharma</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    handleQuickLogin("cashier@apexmedcare.com", "Pharmacy@12345")
                  }
                  className="flex items-center gap-2 p-2 rounded-md border border-slate-200 bg-slate-50/80 hover:bg-teal-50 hover:border-teal-200 hover:text-teal-900 text-left transition-colors cursor-pointer"
                >
                  <Building2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                  <div className="truncate">
                    <p className="font-semibold text-slate-800">POS Cashier</p>
                    <p className="text-[10px] text-slate-500 truncate">Anil Reddy</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    handleQuickLogin("admin@pharmapulse.io", "Admin@12345")
                  }
                  className="flex items-center gap-2 p-2 rounded-md border border-slate-200 bg-slate-50/80 hover:bg-teal-50 hover:border-teal-200 hover:text-teal-900 text-left transition-colors cursor-pointer"
                >
                  <Shield className="h-3.5 w-3.5 text-purple-600 shrink-0" />
                  <div className="truncate">
                    <p className="font-semibold text-slate-800">Super Admin</p>
                    <p className="text-[10px] text-slate-500 truncate">Platform Lead</p>
                  </div>
                </button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Security & Localization Notice */}
        <p className="text-center text-[11px] text-slate-400">
          GST-ready • FEFO Batch Tracking • Multi-Branch Isolation
        </p>
      </div>
    </div>
  );
}
