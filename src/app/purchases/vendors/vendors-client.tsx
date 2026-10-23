"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { formatINR } from "@/lib/utils";
import { Building2, Plus, Search, AlertCircle, Phone, Mail, FileSpreadsheet } from "lucide-react";

interface VendorItem {
  id: string;
  name: string;
  code: string;
  contactPerson: string;
  phone: string;
  email: string;
  city: string;
  state: string;
  gstin: string;
  dlNumber: string;
  paymentTermsDays: number;
  outstandingBalance: number;
  poCount: number;
  invoiceCount: number;
  status: string;
}

export function VendorsClient({ initialVendors }: { initialVendors: VendorItem[] }) {
  const router = useRouter();
  const [vendors, setVendors] = React.useState<VendorItem[]>(initialVendors);
  const [search, setSearch] = React.useState("");
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [formError, setFormError] = React.useState("");

  const [formData, setFormData] = React.useState({
    name: "",
    code: "",
    contactPerson: "",
    phone: "",
    email: "",
    address: "",
    city: "Hyderabad",
    state: "Telangana",
    pincode: "500001",
    gstin: "",
    dlNumber: "",
    paymentTermsDays: 30,
    creditLimit: 100000,
  });

  const filteredVendors = React.useMemo(() => {
    return vendors.filter((v) => {
      const q = search.toLowerCase();
      return (
        search === "" ||
        v.name.toLowerCase().includes(q) ||
        v.code.toLowerCase().includes(q) ||
        v.contactPerson.toLowerCase().includes(q) ||
        v.gstin.toLowerCase().includes(q)
      );
    });
  }, [vendors, search]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setSubmitting(true);

    try {
      const res = await fetch("/api/purchases/vendors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || "Failed to create vendor");
        setSubmitting(false);
        return;
      }

      setIsModalOpen(false);
      router.refresh();
      setVendors([
        ...vendors,
        {
          id: data.vendor.id,
          name: formData.name,
          code: formData.code,
          contactPerson: formData.contactPerson || "—",
          phone: formData.phone,
          email: formData.email || "—",
          city: formData.city,
          state: formData.state,
          gstin: formData.gstin || "—",
          dlNumber: formData.dlNumber || "—",
          paymentTermsDays: Number(formData.paymentTermsDays),
          outstandingBalance: 0,
          poCount: 0,
          invoiceCount: 0,
          status: "ACTIVE",
        },
      ]);
    } catch {
      setFormError("Network error occurred");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Vendor Directory
          </h1>
          <p className="text-xs text-slate-500">
            Manage pharmaceutical distributors, drug license compliance, credit limits, and purchase histories.
          </p>
        </div>
        <Button variant="primary" size="sm" onClick={() => setIsModalOpen(true)}>
          <Plus className="h-3.5 w-3.5" />
          <span>Add New Vendor</span>
        </Button>
      </div>

      {/* Search Bar */}
      <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-3 shadow-2xs">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by vendor name, supplier code, contact person or GSTIN..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 w-full rounded-md border border-slate-200 bg-slate-50 pl-8 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#0F766E] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#0F766E]"
          />
        </div>
      </div>

      {/* Vendors Table */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Vendor Name & Code</TableHead>
            <TableHead>Contact Person</TableHead>
            <TableHead>Contact Info</TableHead>
            <TableHead>GSTIN & Drug License</TableHead>
            <TableHead>Payment Terms</TableHead>
            <TableHead>Outstanding Balance</TableHead>
            <TableHead>Procurement Activity</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredVendors.map((v) => (
            <TableRow key={v.id}>
              <TableCell className="font-semibold text-slate-900">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-[#0F766E] shrink-0" />
                  <div>
                    <p>{v.name}</p>
                    <p className="text-[11px] font-mono font-normal text-slate-400">
                      Code: {v.code}
                    </p>
                  </div>
                </div>
              </TableCell>

              <TableCell className="text-xs font-medium text-slate-700">
                {v.contactPerson}
              </TableCell>

              <TableCell className="text-xs text-slate-600">
                <div className="space-y-0.5">
                  <p className="flex items-center gap-1">
                    <Phone className="h-3 w-3 text-slate-400" />
                    <span>{v.phone}</span>
                  </p>
                  {v.email !== "—" && (
                    <p className="flex items-center gap-1 text-[11px] text-slate-500">
                      <Mail className="h-3 w-3 text-slate-400" />
                      <span>{v.email}</span>
                    </p>
                  )}
                </div>
              </TableCell>

              <TableCell className="font-mono text-xs">
                <p className="text-slate-800">{v.gstin}</p>
                <p className="text-[10px] text-slate-400">DL: {v.dlNumber}</p>
              </TableCell>

              <TableCell className="text-xs text-slate-600">
                {v.paymentTermsDays} Days Net
              </TableCell>

              <TableCell className="font-bold text-slate-900 text-xs">
                <span className={v.outstandingBalance > 0 ? "text-amber-800" : "text-emerald-700"}>
                  {formatINR(v.outstandingBalance)}
                </span>
              </TableCell>

              <TableCell className="text-xs text-slate-600">
                <span className="font-medium text-slate-800">{v.poCount} POs</span> •{" "}
                <span>{v.invoiceCount} Invoices</span>
              </TableCell>

              <TableCell>
                <Badge variant={v.status === "ACTIVE" ? "success" : "neutral"} size="sm">
                  {v.status}
                </Badge>
              </TableCell>
            </TableRow>
          ))}

          {filteredVendors.length === 0 && (
            <TableRow>
              <TableCell colSpan={8} className="text-center py-8 text-slate-400">
                No vendors found.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {/* Add Vendor Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Add Vendor / Pharmaceutical Distributor"
        description="Register a new supplier with statutory GSTIN, Drug License numbers, and credit terms."
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
              label="Distributor / Firm Name *"
              placeholder="e.g. Alkem Life Sciences Logistics"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
            <Input
              label="Vendor Code *"
              placeholder="e.g. VEND-ALKEM"
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value })}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Contact Person Name"
              placeholder="e.g. Rakesh Nair"
              value={formData.contactPerson}
              onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
            />
            <Input
              label="Phone Number *"
              placeholder="+91 9876543210"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Email Address"
              type="email"
              placeholder="orders@alkemlogistics.in"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
            <Input
              label="Credit Period (Days)"
              type="number"
              value={formData.paymentTermsDays}
              onChange={(e) => setFormData({ ...formData, paymentTermsDays: Number(e.target.value) })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="GSTIN (15 Digits)"
              placeholder="36AAACA1234A1Z5"
              value={formData.gstin}
              onChange={(e) => setFormData({ ...formData, gstin: e.target.value })}
            />
            <Input
              label="Drug License (Form 20B / 21B)"
              placeholder="TG/HYD/20B/12345"
              value={formData.dlNumber}
              onChange={(e) => setFormData({ ...formData, dlNumber: e.target.value })}
            />
          </div>

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

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={submitting}>
              Save Vendor
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
