"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatINR } from "@/lib/utils";
import { CheckCircle2, AlertCircle } from "lucide-react";

interface SettingsData {
  legalName: string;
  tradeName: string;
  contactPhone: string;
  contactEmail: string;
  address: string;
  state: string;
  gstin: string;
  drugLicense20B: string;
  drugLicense21B: string;
  nearExpiryDays: number;
  invoicePrefix: string;
  receiptHeader: string;
  receiptFooter: string;
}

export function SettingsClient({
  initialSettings,
  subscription,
}: {
  initialSettings: SettingsData;
  subscription: {
    planName: string;
    branchCount: number;
    maxBranches: number;
    userCount: number;
    maxUsers: number;
    priceInr: number;
  };
}) {
  const [formData, setFormData] = React.useState<SettingsData>(initialSettings);
  const [activeTab, setActiveTab] = React.useState<"PROFILE" | "BRANCH" | "INVENTORY" | "SUBSCRIPTION">("PROFILE");
  const [saving, setSaving] = React.useState(false);
  const [savedSuccess, setSavedSuccess] = React.useState(false);
  const [saveError, setSaveError] = React.useState("");

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSavedSuccess(false);
    setSaveError("");

    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (!res.ok) {
        setSaveError(data.error || "Failed to update settings");
        setSaving(false);
        return;
      }

      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch {
      setSaveError("Network communication error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">
          Pharmacy & SaaS Configuration
        </h1>
        <p className="text-xs text-slate-500">
          Configure business legal entity details, branch thermal receipt formats, drug licenses, and subscription tier.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200">
        {[
          { id: "PROFILE", label: "Business Legal Profile" },
          { id: "BRANCH", label: "Receipt & Branch Billing" },
          { id: "INVENTORY", label: "Inventory & Expiry Rules" },
          { id: "SUBSCRIPTION", label: "SaaS Subscription" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as "PROFILE" | "BRANCH" | "INVENTORY" | "SUBSCRIPTION")}
            className={`px-3.5 py-2 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
              activeTab === tab.id
                ? "border-[#0F766E] text-[#0F766E]"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {savedSuccess && (
        <div className="p-3 rounded-md bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>Settings saved and applied successfully across active branches.</span>
        </div>
      )}

      {saveError && (
        <div className="p-3 rounded-md bg-red-50 border border-red-200 text-xs text-red-800 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
          <span>{saveError}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Tab 1: Profile */}
        {activeTab === "PROFILE" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Business Registration & Licenses</CardTitle>
              <CardDescription className="text-xs">
                Statutory registration details printed on tax invoices and drug inspection reports.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Legal Company Name *"
                  value={formData.legalName}
                  onChange={(e) => setFormData({ ...formData, legalName: e.target.value })}
                  required
                />
                <Input
                  label="Trade / Store Name *"
                  value={formData.tradeName}
                  onChange={(e) => setFormData({ ...formData, tradeName: e.target.value })}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="GSTIN (Goods & Services Tax ID) *"
                  value={formData.gstin}
                  onChange={(e) => setFormData({ ...formData, gstin: e.target.value })}
                  required
                />
                <Input
                  label="State Jurisdiction"
                  value={formData.state}
                  onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Drug License Form 20B (Allopathic Wholesale/Retail) *"
                  value={formData.drugLicense20B}
                  onChange={(e) => setFormData({ ...formData, drugLicense20B: e.target.value })}
                  required
                />
                <Input
                  label="Drug License Form 21B (Specified Schedule C/C1) *"
                  value={formData.drugLicense21B}
                  onChange={(e) => setFormData({ ...formData, drugLicense21B: e.target.value })}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Primary Phone"
                  value={formData.contactPhone}
                  onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                />
                <Input
                  label="Support Email"
                  value={formData.contactEmail}
                  onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                />
              </div>

              <Input
                label="Registered Headquarters Address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              />
            </CardContent>
          </Card>
        )}

        {/* Tab 2: Branch & Thermal */}
        {activeTab === "BRANCH" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">POS Billing & Receipt Customization</CardTitle>
              <CardDescription className="text-xs">
                Formatting parameters for 80mm and 58mm thermal receipt printers.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Sequential Invoice Prefix"
                  value={formData.invoicePrefix}
                  onChange={(e) => setFormData({ ...formData, invoicePrefix: e.target.value })}
                  required
                />
                <Input
                  label="Default Printer Width"
                  value="80mm Thermal (Standard)"
                  disabled
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Thermal Receipt Header (Store Name, Phone, Operating Hours)
                </label>
                <textarea
                  rows={3}
                  value={formData.receiptHeader}
                  onChange={(e) => setFormData({ ...formData, receiptHeader: e.target.value })}
                  className="w-full rounded-md border border-slate-300 p-2 text-xs font-mono focus:border-[#0F766E] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Thermal Receipt Footer Note (Doctor consultation notice, return policy)
                </label>
                <textarea
                  rows={2}
                  value={formData.receiptFooter}
                  onChange={(e) => setFormData({ ...formData, receiptFooter: e.target.value })}
                  className="w-full rounded-md border border-slate-300 p-2 text-xs font-mono focus:border-[#0F766E] focus:outline-none"
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tab 3: Inventory Rules */}
        {activeTab === "INVENTORY" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Inventory Safety & Expiry Thresholds</CardTitle>
              <CardDescription className="text-xs">
                System automation policies for FEFO allocation and near-expiry risk warnings.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Near-Expiry Alert Warning Period (Days)"
                  type="number"
                  value={formData.nearExpiryDays}
                  onChange={(e) => setFormData({ ...formData, nearExpiryDays: Number(e.target.value) })}
                  helperText="Batches expiring within this window will trigger alerts on the dashboard and in-app notifications."
                />
                <Input
                  label="Default Batch Allocation Rule"
                  value="FEFO (First Expiry, First Out)"
                  disabled
                />
              </div>

              <div className="rounded-md bg-slate-50 p-3 border border-slate-200 text-xs text-slate-700 space-y-1">
                <p className="font-semibold text-slate-900">Negative Stock Prevention Policy:</p>
                <p>
                  Active for this tenant. POS checkout and inter-branch transfers strictly prevent deductions that would cause inventory balances to drop below zero.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tab 4: Subscription */}
        {activeTab === "SUBSCRIPTION" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Multi-Tenant SaaS Plan & Limits</CardTitle>
              <CardDescription className="text-xs">
                Your current organization tier and active branch quotas.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-lg bg-teal-50 border border-teal-200">
                <div>
                  <Badge variant="default" size="sm">
                    Active Subscription
                  </Badge>
                  <h3 className="text-lg font-bold text-teal-950 mt-1">
                    {subscription.planName}
                  </h3>
                  <p className="text-xs text-teal-800">
                    Billed at {formatINR(subscription.priceInr)} / month
                  </p>
                </div>
                <div className="text-right space-y-1 text-xs">
                  <p className="font-semibold text-slate-700">
                    Branch Usage:{" "}
                    <span className="font-bold text-slate-900">
                      {subscription.branchCount} / {subscription.maxBranches}
                    </span>
                  </p>
                  <p className="font-semibold text-slate-700">
                    Staff Usage:{" "}
                    <span className="font-bold text-slate-900">
                      {subscription.userCount} / {subscription.maxUsers}
                    </span>
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex justify-end">
          <Button type="submit" variant="primary" isLoading={saving}>
            Save All Settings
          </Button>
        </div>
      </form>
    </div>
  );
}
