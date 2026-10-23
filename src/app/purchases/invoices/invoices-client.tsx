"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { formatINR, formatDate } from "@/lib/utils";
import { Plus, Search, AlertCircle } from "lucide-react";

interface InvoiceItem {
  id: string;
  invoiceNumber: string;
  vendorName: string;
  vendorCode: string;
  poNumber: string;
  grnNumber: string;
  invoiceDate: string;
  dueDate: string;
  subtotal: number;
  taxAmount: number;
  grandTotal: number;
  paidAmount: number;
  status: string;
}

export function InvoicesClient({
  initialInvoices,
  vendors,
  pendingGRNs,
}: {
  initialInvoices: InvoiceItem[];
  vendors: { id: string; name: string; code: string }[];
  pendingGRNs: { id: string; grnNumber: string; vendorId: string; vendorName: string }[];
}) {
  const router = useRouter();
  const [invoices, setInvoices] = React.useState<InvoiceItem[]>(initialInvoices);
  const [search, setSearch] = React.useState("");
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [formError, setFormError] = React.useState("");

  const [formData, setFormData] = React.useState({
    vendorId: vendors[0]?.id || "",
    grnId: "",
    invoiceNumber: "",
    invoiceDate: "2026-10-23",
    dueDate: "2026-11-22",
    subtotal: "",
    taxAmount: "",
    grandTotal: "",
    notes: "",
  });

  const filteredInvoices = React.useMemo(() => {
    return invoices.filter((inv) => {
      const q = search.toLowerCase();
      return (
        search === "" ||
        inv.invoiceNumber.toLowerCase().includes(q) ||
        inv.vendorName.toLowerCase().includes(q)
      );
    });
  }, [invoices, search]);

  const handleSubtotalChange = (sub: string) => {
    const s = Number(sub) || 0;
    const tax = Math.round(s * 0.12 * 100) / 100; // standard 12% GST
    const total = Math.round((s + tax) * 100) / 100;
    setFormData({
      ...formData,
      subtotal: sub,
      taxAmount: tax.toString(),
      grandTotal: total.toString(),
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setSubmitting(true);

    try {
      const res = await fetch("/api/purchases/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || "Failed to record invoice");
        setSubmitting(false);
        return;
      }

      setIsModalOpen(false);
      router.refresh();
      setInvoices([
        {
          id: data.invoice.id,
          invoiceNumber: formData.invoiceNumber,
          vendorName: vendors.find((v) => v.id === formData.vendorId)?.name || "Vendor",
          vendorCode: vendors.find((v) => v.id === formData.vendorId)?.code || "VEND",
          poNumber: "—",
          grnNumber: pendingGRNs.find((g) => g.id === formData.grnId)?.grnNumber || "—",
          invoiceDate: formData.invoiceDate,
          dueDate: formData.dueDate,
          subtotal: Number(formData.subtotal),
          taxAmount: Number(formData.taxAmount),
          grandTotal: Number(formData.grandTotal),
          paidAmount: 0,
          status: "PENDING",
        },
        ...invoices,
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
            Vendor Invoices & 3-Way Match
          </h1>
          <p className="text-xs text-slate-500">
            Match supplier bills against purchase orders & goods receipts, verify input tax credit (ITC), and track accounts payable.
          </p>
        </div>
        <Button variant="primary" size="sm" onClick={() => setIsModalOpen(true)}>
          <Plus className="h-3.5 w-3.5" />
          <span>Record Vendor Invoice</span>
        </Button>
      </div>

      {/* Search Bar */}
      <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-3 shadow-2xs">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by vendor invoice # or distributor name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 w-full rounded-md border border-slate-200 bg-slate-50 pl-8 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#0F766E] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#0F766E]"
          />
        </div>
      </div>

      {/* Table */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Invoice #</TableHead>
            <TableHead>Distributor</TableHead>
            <TableHead>GRN Linked</TableHead>
            <TableHead>Invoice Date</TableHead>
            <TableHead>Due Date</TableHead>
            <TableHead>Taxable (₹)</TableHead>
            <TableHead>Total (₹)</TableHead>
            <TableHead>Balance Due</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredInvoices.map((inv) => {
            const balanceDue = inv.grandTotal - inv.paidAmount;
            return (
              <TableRow key={inv.id}>
                <TableCell className="font-mono font-bold text-slate-900">
                  {inv.invoiceNumber}
                </TableCell>

                <TableCell className="font-medium text-slate-800 text-xs">
                  {inv.vendorName}
                </TableCell>

                <TableCell className="font-mono text-xs text-slate-600">
                  {inv.grnNumber}
                </TableCell>

                <TableCell className="text-xs text-slate-600">
                  {formatDate(inv.invoiceDate)}
                </TableCell>

                <TableCell className="text-xs text-slate-600">
                  {formatDate(inv.dueDate)}
                </TableCell>

                <TableCell className="text-xs text-slate-600">
                  {formatINR(inv.subtotal)}
                </TableCell>

                <TableCell className="font-bold text-slate-900 text-xs">
                  {formatINR(inv.grandTotal)}
                </TableCell>

                <TableCell className="font-semibold text-xs text-red-600">
                  {formatINR(balanceDue)}
                </TableCell>

                <TableCell>
                  <Badge
                    variant={
                      inv.status === "PAID"
                        ? "success"
                        : inv.status === "PENDING"
                        ? "warning"
                        : "neutral"
                    }
                    size="sm"
                  >
                    {inv.status}
                  </Badge>
                </TableCell>
              </TableRow>
            );
          })}

          {filteredInvoices.length === 0 && (
            <TableRow>
              <TableCell colSpan={9} className="text-center py-8 text-slate-400">
                No vendor invoices recorded yet.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {/* Record Invoice Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Record Supplier / Vendor Invoice"
        description="Enforces duplicate invoice validation, links to Goods Receipts, and updates vendor accounts payable."
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
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Vendor *
              </label>
              <select
                value={formData.vendorId}
                onChange={(e) => setFormData({ ...formData, vendorId: e.target.value })}
                className="w-full h-9 rounded-md border border-slate-300 bg-white px-3 text-xs text-slate-900 focus:border-[#0F766E] focus:outline-none"
                required
              >
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} ({v.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Link to GRN (Optional)
              </label>
              <select
                value={formData.grnId}
                onChange={(e) => setFormData({ ...formData, grnId: e.target.value })}
                className="w-full h-9 rounded-md border border-slate-300 bg-white px-3 text-xs text-slate-900 focus:border-[#0F766E] focus:outline-none"
              >
                <option value="">-- Direct Invoice --</option>
                {pendingGRNs.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.grnNumber} — {g.vendorName}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Input
              label="Supplier Invoice # *"
              placeholder="e.g. SUN-INV-9824"
              value={formData.invoiceNumber}
              onChange={(e) => setFormData({ ...formData, invoiceNumber: e.target.value })}
              required
            />
            <Input
              label="Invoice Date *"
              type="date"
              value={formData.invoiceDate}
              onChange={(e) => setFormData({ ...formData, invoiceDate: e.target.value })}
              required
            />
            <Input
              label="Due Date *"
              type="date"
              value={formData.dueDate}
              onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
              required
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Input
              label="Taxable Subtotal (₹) *"
              type="number"
              step="0.01"
              placeholder="10000.00"
              value={formData.subtotal}
              onChange={(e) => handleSubtotalChange(e.target.value)}
              required
            />
            <Input
              label="GST Tax Amount (₹)"
              type="number"
              step="0.01"
              value={formData.taxAmount}
              onChange={(e) => setFormData({ ...formData, taxAmount: e.target.value })}
              required
            />
            <Input
              label="Grand Total (₹) *"
              type="number"
              step="0.01"
              value={formData.grandTotal}
              onChange={(e) => setFormData({ ...formData, grandTotal: e.target.value })}
              required
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={submitting}>
              Post Vendor Invoice
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
