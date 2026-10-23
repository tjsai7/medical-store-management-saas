"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { KPICard } from "@/components/ui/kpi-card";
import { formatDate, formatINR } from "@/lib/utils";
import {
  ShieldAlert,
  Building2,
  GitBranch,
  Users,
  Plus,
  Search,
  CheckCircle2,
  AlertCircle,
  Activity,
} from "lucide-react";

interface TenantItem {
  id: string;
  name: string;
  slug: string;
  legalName: string;
  gstin: string;
  status: string;
  planName: string;
  planId: string | null;
  branchesCount: number;
  usersCount: number;
  medicinesCount: number;
  salesCount: number;
  createdAt: string;
}

interface PlanOption {
  id: string;
  name: string;
  code: string;
  priceInr: number;
}

export function TenantsClient({
  initialTenants,
  plans,
}: {
  initialTenants: TenantItem[];
  plans: PlanOption[];
}) {
  const router = useRouter();
  const [tenants, setTenants] = React.useState<TenantItem[]>(initialTenants);
  const [search, setSearch] = React.useState("");
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [formError, setFormError] = React.useState("");

  const [formData, setFormData] = React.useState({
    name: "",
    slug: "",
    legalName: "",
    gstin: "",
    planId: plans[0]?.id || "",
  });

  const filteredTenants = React.useMemo(() => {
    return tenants.filter((t) => {
      const q = search.toLowerCase();
      return (
        search === "" ||
        t.name.toLowerCase().includes(q) ||
        t.slug.toLowerCase().includes(q) ||
        t.legalName.toLowerCase().includes(q)
      );
    });
  }, [tenants, search]);

  const totalBranches = tenants.reduce((sum, t) => sum + t.branchesCount, 0);
  const totalUsers = tenants.reduce((sum, t) => sum + t.usersCount, 0);

  const handleToggleStatus = async (tenantId: string, currentStatus: string) => {
    const newStatus = currentStatus === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
    try {
      const res = await fetch("/api/admin/tenants", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId, status: newStatus }),
      });

      if (res.ok) {
        setTenants(
          tenants.map((t) => (t.id === tenantId ? { ...t, status: newStatus } : t))
        );
        router.refresh();
      }
    } catch (e) {
      console.error("Failed to update status:", e);
    }
  };

  const handleCreateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setSubmitting(true);

    try {
      const res = await fetch("/api/admin/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || "Failed to onboard tenant");
        setSubmitting(false);
        return;
      }

      setIsModalOpen(false);
      router.refresh();
      setTenants([
        {
          id: data.tenant.id,
          name: formData.name,
          slug: formData.slug,
          legalName: formData.legalName,
          gstin: formData.gstin || "—",
          status: "ACTIVE",
          planName: plans.find((p) => p.id === formData.planId)?.name || "Plan",
          planId: formData.planId,
          branchesCount: 1,
          usersCount: 0,
          medicinesCount: 0,
          salesCount: 0,
          createdAt: new Date().toISOString(),
        },
        ...tenants,
      ]);
    } catch {
      setFormError("Network communication error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-teal-700" />
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              Platform Super Admin — Tenant Control Plane
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Global SaaS administration: tenant lifecycle, subscription plan tiers & cross-platform telemetry.
          </p>
        </div>
        <Button variant="primary" size="sm" onClick={() => setIsModalOpen(true)}>
          <Plus className="h-3.5 w-3.5" />
          <span>Onboard Pharmacy Tenant</span>
        </Button>
      </div>

      {/* Platform Telemetry Cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <KPICard
          title="Active SaaS Tenants"
          value={tenants.length}
          subtitle="Independent businesses"
          icon={Building2}
          variant="default"
        />
        <KPICard
          title="Store Branches Hosted"
          value={totalBranches}
          subtitle="Physical retail outlets"
          icon={GitBranch}
          variant="info"
        />
        <KPICard
          title="Platform Users"
          value={totalUsers}
          subtitle="Pharmacists, cashiers, owners"
          icon={Users}
          variant="success"
        />
        <KPICard
          title="Platform Health"
          value="100% Online"
          subtitle="All DB nodes healthy"
          icon={Activity}
          variant="success"
        />
      </div>

      {/* Search Bar */}
      <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-3 shadow-2xs">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search tenant by pharmacy name, slug, or legal entity..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 w-full rounded-md border border-slate-200 bg-slate-50 pl-8 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#0F766E] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#0F766E]"
          />
        </div>
      </div>

      {/* Tenants Table */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Tenant Name & Slug</TableHead>
            <TableHead>Legal Entity & GSTIN</TableHead>
            <TableHead>Subscription Plan</TableHead>
            <TableHead>Branches</TableHead>
            <TableHead>Staff</TableHead>
            <TableHead>SKUs / Bills</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredTenants.map((t) => (
            <TableRow key={t.id}>
              <TableCell className="font-semibold text-slate-900 text-xs">
                <p>{t.name}</p>
                <p className="font-mono text-[11px] text-teal-800 font-normal">
                  slug: {t.slug}
                </p>
              </TableCell>

              <TableCell className="text-xs text-slate-700">
                <p>{t.legalName}</p>
                <p className="font-mono text-[10px] text-slate-400">GSTIN: {t.gstin}</p>
              </TableCell>

              <TableCell className="text-xs">
                <span className="font-semibold text-slate-800">{t.planName}</span>
              </TableCell>

              <TableCell className="text-xs font-bold text-slate-900">
                {t.branchesCount} Branches
              </TableCell>

              <TableCell className="text-xs font-semibold text-slate-800">
                {t.usersCount} Staff
              </TableCell>

              <TableCell className="text-xs text-slate-600">
                <span>{t.medicinesCount} SKUs</span> • <span>{t.salesCount} Bills</span>
              </TableCell>

              <TableCell>
                <Badge
                  variant={
                    t.status === "ACTIVE"
                      ? "success"
                      : t.status === "TRIAL"
                      ? "warning"
                      : "danger"
                  }
                  size="sm"
                >
                  {t.status}
                </Badge>
              </TableCell>

              <TableCell>
                <Button
                  variant={t.status === "ACTIVE" ? "danger" : "success"}
                  size="sm"
                  onClick={() => handleToggleStatus(t.id, t.status)}
                >
                  {t.status === "ACTIVE" ? "Suspend" : "Activate"}
                </Button>
              </TableCell>
            </TableRow>
          ))}

          {filteredTenants.length === 0 && (
            <TableRow>
              <TableCell colSpan={8} className="text-center py-8 text-slate-400">
                No tenants found matching search.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {/* Onboard Tenant Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Onboard New Pharmacy Business (Tenant)"
        description="Creates a new multi-tenant partition with isolated database scope, initial main branch, and plan limits."
        maxWidth="md"
      >
        <form onSubmit={handleCreateTenant} className="space-y-4">
          {formError && (
            <div className="flex items-center gap-2 p-3 text-xs rounded bg-red-50 text-red-700 border border-red-200">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <Input
            label="Pharmacy Business Name *"
            placeholder="e.g. MedCare Pharma Group"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Tenant Slug (Unique URL identifier) *"
              placeholder="e.g. medcare-pharma"
              value={formData.slug}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
                })
              }
              required
            />

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Subscription Plan *
              </label>
              <select
                value={formData.planId}
                onChange={(e) => setFormData({ ...formData, planId: e.target.value })}
                className="w-full h-9 rounded-md border border-slate-300 bg-white px-3 text-xs text-slate-900 focus:border-[#0F766E] focus:outline-none"
                required
              >
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({formatINR(p.priceInr)}/mo)
                  </option>
                ))}
              </select>
            </div>
          </div>

          <Input
            label="Legal Registered Firm Name *"
            placeholder="e.g. MedCare Retail & Healthcare LLP"
            value={formData.legalName}
            onChange={(e) => setFormData({ ...formData, legalName: e.target.value })}
            required
          />

          <Input
            label="Corporate GSTIN"
            placeholder="36AABCM9876C1Z3"
            value={formData.gstin}
            onChange={(e) => setFormData({ ...formData, gstin: e.target.value })}
          />

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={submitting}>
              Provision Tenant
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
