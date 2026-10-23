"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { formatDate } from "@/lib/utils";
import { Users, Plus, Search, Shield, Building, AlertCircle } from "lucide-react";

interface StaffMember {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  status: string;
  createdAt: string;
  assignments: {
    branchName: string;
    branchCode: string;
    roleName: string;
    roleCode: string;
  }[];
}

export function StaffClient({
  initialStaff,
  branches,
  roles,
}: {
  initialStaff: StaffMember[];
  branches: { id: string; name: string; code: string }[];
  roles: { id: string; name: string; code: string }[];
}) {
  const router = useRouter();
  const [staff, setStaff] = React.useState<StaffMember[]>(initialStaff);
  const [search, setSearch] = React.useState("");
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [formError, setFormError] = React.useState("");

  const [formData, setFormData] = React.useState({
    fullName: "",
    email: "",
    phone: "",
    password: "Pharmacy@12345",
    branchId: branches[0]?.id || "",
    roleId: roles.find((r) => r.code === "PHARMACIST")?.id || roles[0]?.id || "",
  });

  const filteredStaff = React.useMemo(() => {
    return staff.filter((s) => {
      const q = search.toLowerCase();
      return (
        search === "" ||
        s.fullName.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q)
      );
    });
  }, [staff, search]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setSubmitting(true);

    try {
      const res = await fetch("/api/operations/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || "Failed to invite staff member");
        setSubmitting(false);
        return;
      }

      setIsModalOpen(false);
      router.refresh();
      const branchObj = branches.find((b) => b.id === formData.branchId);
      const roleObj = roles.find((r) => r.id === formData.roleId);

      setStaff([
        ...staff,
        {
          id: data.user.id,
          fullName: formData.fullName,
          email: formData.email,
          phone: formData.phone || "—",
          status: "ACTIVE",
          createdAt: new Date().toISOString(),
          assignments: [
            {
              branchName: branchObj?.name || "Branch",
              branchCode: branchObj?.code || "BR",
              roleName: roleObj?.name || "Staff",
              roleCode: roleObj?.code || "STAFF",
            },
          ],
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
            Staff & Role Permissions
          </h1>
          <p className="text-xs text-slate-500">
            Manage pharmacy employees, branch access assignments, and least-privilege role permissions.
          </p>
        </div>
        <Button variant="primary" size="sm" onClick={() => setIsModalOpen(true)}>
          <Plus className="h-3.5 w-3.5" />
          <span>Invite Staff Member</span>
        </Button>
      </div>

      {/* Search Bar */}
      <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-3 shadow-2xs">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by staff name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 w-full rounded-md border border-slate-200 bg-slate-50 pl-8 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#0F766E] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#0F766E]"
          />
        </div>
      </div>

      {/* Staff Table */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Staff Member</TableHead>
            <TableHead>Email Address</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>Assigned Branch & Role</TableHead>
            <TableHead>Member Since</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredStaff.map((s) => (
            <TableRow key={s.id}>
              <TableCell className="font-semibold text-slate-900 text-xs">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-[#0F766E] font-bold text-xs border border-slate-200">
                    {s.fullName.charAt(0)}
                  </div>
                  <span>{s.fullName}</span>
                </div>
              </TableCell>

              <TableCell className="text-xs text-slate-600 font-mono">
                {s.email}
              </TableCell>

              <TableCell className="text-xs text-slate-600">
                {s.phone}
              </TableCell>

              <TableCell>
                <div className="flex flex-wrap gap-1.5">
                  {s.assignments.map((a, i) => (
                    <div key={i} className="flex items-center gap-1">
                      <Badge variant="default" size="sm">
                        {a.roleName}
                      </Badge>
                      <span className="text-[10px] text-slate-400">
                        ({a.branchCode})
                      </span>
                    </div>
                  ))}
                  {s.assignments.length === 0 && (
                    <span className="text-xs text-slate-400">No branch assigned</span>
                  )}
                </div>
              </TableCell>

              <TableCell className="text-xs text-slate-600">
                {formatDate(s.createdAt)}
              </TableCell>

              <TableCell>
                <Badge variant={s.status === "ACTIVE" ? "success" : "neutral"} size="sm">
                  {s.status}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Invite Staff Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Invite New Pharmacy Staff"
        description="Create credentials and grant branch-level operational permissions."
        maxWidth="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && (
            <div className="flex items-center gap-2 p-3 text-xs rounded bg-red-50 text-red-700 border border-red-200">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <Input
            label="Full Name *"
            placeholder="e.g. Priya Sharma, B.Pharm"
            value={formData.fullName}
            onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
            required
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Email Address *"
              type="email"
              placeholder="priya@apexmedcare.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
            />
            <Input
              label="Contact Phone"
              placeholder="+91 98765..."
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Assign Branch *
              </label>
              <select
                value={formData.branchId}
                onChange={(e) => setFormData({ ...formData, branchId: e.target.value })}
                className="w-full h-9 rounded-md border border-slate-300 bg-white px-3 text-xs text-slate-900 focus:border-[#0F766E] focus:outline-none"
                required
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Assign Job Role *
              </label>
              <select
                value={formData.roleId}
                onChange={(e) => setFormData({ ...formData, roleId: e.target.value })}
                className="w-full h-9 rounded-md border border-slate-300 bg-white px-3 text-xs text-slate-900 focus:border-[#0F766E] focus:outline-none"
                required
              >
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <Input
            label="Initial Account Password"
            type="password"
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            required
          />

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={submitting}>
              Invite Member
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
