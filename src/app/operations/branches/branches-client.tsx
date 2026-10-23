"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { GitBranch, Plus, Building, Phone, AlertCircle, CheckCircle2 } from "lucide-react";

interface BranchItem {
  id: string;
  name: string;
  code: string;
  address: string;
  city: string;
  state: string;
  phone: string;
  email: string;
  gstin: string;
  dlNumber: string;
  isMainBranch: boolean;
  staffCount: number;
  salesCount: number;
  isActive: boolean;
}

export function BranchesClient({
  initialBranches,
  planLimits,
}: {
  initialBranches: BranchItem[];
  planLimits: {
    planName: string;
    maxBranches: number;
    currentBranches: number;
  };
}) {
  const router = useRouter();
  const [branches, setBranches] = React.useState<BranchItem[]>(initialBranches);
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [formError, setFormError] = React.useState("");

  const [formData, setFormData] = React.useState({
    name: "",
    code: "",
    address: "",
    city: "Hyderabad",
    state: "Telangana",
    pincode: "500034",
    phone: "",
    email: "",
    gstin: "",
    dlNumber: "",
  });

  const isLimitReached = planLimits.currentBranches >= planLimits.maxBranches;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setSubmitting(true);

    try {
      const res = await fetch("/api/operations/branches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || "Failed to create branch");
        setSubmitting(false);
        return;
      }

      setIsModalOpen(false);
      router.refresh();
      setBranches([
        ...branches,
        {
          id: data.branch.id,
          name: formData.name,
          code: formData.code.toUpperCase(),
          address: formData.address,
          city: formData.city,
          state: formData.state,
          phone: formData.phone || "—",
          email: formData.email || "—",
          gstin: formData.gstin || "—",
          dlNumber: formData.dlNumber || "—",
          isMainBranch: false,
          staffCount: 1,
          salesCount: 0,
          isActive: true,
        },
      ]);
    } catch {
      setFormError("Network communication error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Branches & Store Locations
          </h1>
          <p className="text-xs text-slate-500">
            Manage physical pharmacy retail counters, branch GSTIN registrations, and operational staff assignments.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right text-xs">
            <span className="text-slate-500">Plan Quota: </span>
            <span className="font-bold text-slate-800">
              {branches.length} / {planLimits.maxBranches} Branches
            </span>
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsModalOpen(true)}
            disabled={isLimitReached}
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add Store Branch</span>
          </Button>
        </div>
      </div>

      {isLimitReached && (
        <div className="p-3 rounded-md bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
          <span>
            You have reached the maximum allowed branches ({planLimits.maxBranches}) for your{" "}
            <strong>{planLimits.planName}</strong> plan. Upgrade your subscription to add more store outlets.
          </span>
        </div>
      )}

      {/* Table */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Branch Name & Code</TableHead>
            <TableHead>Location / Address</TableHead>
            <TableHead>Contact</TableHead>
            <TableHead>GSTIN & Drug License</TableHead>
            <TableHead>Staff Assigned</TableHead>
            <TableHead>Transactions</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {branches.map((b) => (
            <TableRow key={b.id}>
              <TableCell className="font-semibold text-slate-900">
                <div className="flex items-center gap-2">
                  <Building className="h-4 w-4 text-[#0F766E] shrink-0" />
                  <div>
                    <p>{b.name}</p>
                    <p className="font-mono text-xs text-slate-400 font-normal">
                      Code: {b.code}
                    </p>
                  </div>
                </div>
              </TableCell>

              <TableCell className="text-xs text-slate-700">
                <p>{b.address}</p>
                <p className="text-slate-400">
                  {b.city}, {b.state}
                </p>
              </TableCell>

              <TableCell className="text-xs text-slate-600">
                <p className="flex items-center gap-1">
                  <Phone className="h-3 w-3 text-slate-400" />
                  <span>{b.phone}</span>
                </p>
              </TableCell>

              <TableCell className="font-mono text-xs">
                <p className="text-slate-800">{b.gstin}</p>
                <p className="text-[10px] text-slate-400">DL: {b.dlNumber}</p>
              </TableCell>

              <TableCell className="text-xs font-semibold text-slate-800">
                {b.staffCount} Staff Members
              </TableCell>

              <TableCell className="text-xs font-semibold text-slate-800">
                {b.salesCount} Bills Settled
              </TableCell>

              <TableCell>
                <Badge variant={b.isMainBranch ? "default" : "neutral"} size="sm">
                  {b.isMainBranch ? "Headquarters" : "Counter Outlet"}
                </Badge>
              </TableCell>

              <TableCell>
                <Badge variant={b.isActive ? "success" : "neutral"} size="sm">
                  {b.isActive ? "Operational" : "Inactive"}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Add Branch Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Add New Pharmacy Branch Location"
        description="Configure a new physical dispensing counter with isolated stock records and invoice series."
        maxWidth="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && (
            <div className="flex items-center gap-2 p-3 text-xs rounded bg-red-50 text-red-700 border border-red-200">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Branch Name *"
              placeholder="e.g. Apex MedCare - Banjara Hills"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
            <Input
              label="Branch Code (2-6 letters) *"
              placeholder="e.g. BH-03"
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value })}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Contact Phone"
              placeholder="+91 40 2345 9900"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            />
            <Input
              label="Branch Email"
              type="email"
              placeholder="bh03@apexmedcare.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
          </div>

          <Input
            label="Street Address"
            placeholder="Shop 4, Road No 12, Banjara Hills"
            value={formData.address}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
          />

          <div className="grid grid-cols-3 gap-3">
            <Input
              label="City"
              value={formData.city}
              onChange={(e) => setFormData({ ...formData, city: e.target.value })}
            />
            <Input
              label="State"
              value={formData.state}
              onChange={(e) => setFormData({ ...formData, state: e.target.value })}
            />
            <Input
              label="Pincode"
              value={formData.pincode}
              onChange={(e) => setFormData({ ...formData, pincode: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Branch GSTIN"
              placeholder="36AAACA1234A1Z5"
              value={formData.gstin}
              onChange={(e) => setFormData({ ...formData, gstin: e.target.value })}
            />
            <Input
              label="Branch Drug License (Form 20B/21B)"
              placeholder="TG/HYD/20B/11999"
              value={formData.dlNumber}
              onChange={(e) => setFormData({ ...formData, dlNumber: e.target.value })}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={submitting}>
              Create Branch
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
