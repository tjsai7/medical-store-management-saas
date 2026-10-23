"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { formatINR, formatDate } from "@/lib/utils";
import { Plus, Search, Trash2, PackageCheck, AlertCircle } from "lucide-react";

interface OrderLine {
  id?: string;
  medicineName?: string;
  quantity: number;
  unitCost: number;
  lineTotal: number;
}

interface OrderItem {
  id: string;
  poNumber: string;
  vendorId: string;
  vendorName: string;
  expectedDate: string | null;
  status: string;
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  grandTotal: number;
  notes: string;
  createdByName: string;
  createdAt: string;
  lineCount: number;
  lines: OrderLine[];
}

interface MedicineRef {
  id: string;
  name: string;
  sku: string;
  dispenseUnit: string;
  purchasePrice: number;
  gstRate: number;
}

export function OrdersClient({
  initialOrders,
  vendors,
  medicines,
}: {
  initialOrders: OrderItem[];
  vendors: { id: string; name: string; code: string }[];
  medicines: MedicineRef[];
}) {
  const router = useRouter();
  const [orders, setOrders] = React.useState<OrderItem[]>(initialOrders);
  const [search, setSearch] = React.useState("");
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [formError, setFormError] = React.useState("");

  // PO Form State
  const [vendorId, setVendorId] = React.useState(vendors[0]?.id || "");
  const [expectedDate, setExpectedDate] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [lines, setLines] = React.useState<
    Array<{
      medicineId: string;
      quantity: number;
      unitCost: number;
      gstRate: number;
      discountPercent: number;
    }>
  >([
    {
      medicineId: medicines[0]?.id || "",
      quantity: 50,
      unitCost: medicines[0]?.purchasePrice || 0,
      gstRate: medicines[0]?.gstRate || 12,
      discountPercent: 0,
    },
  ]);

  const filteredOrders = React.useMemo(() => {
    return orders.filter((o) => {
      const q = search.toLowerCase();
      return (
        search === "" ||
        o.poNumber.toLowerCase().includes(q) ||
        o.vendorName.toLowerCase().includes(q)
      );
    });
  }, [orders, search]);

  const handleAddLine = () => {
    if (medicines.length === 0) return;
    const med = medicines[0];
    setLines([
      ...lines,
      {
        medicineId: med.id,
        quantity: 20,
        unitCost: med.purchasePrice,
        gstRate: med.gstRate,
        discountPercent: 0,
      },
    ]);
  };

  const handleRemoveLine = (index: number) => {
    if (lines.length === 1) return;
    setLines(lines.filter((_, i) => i !== index));
  };

  const handleLineChange = (index: number, field: string, val: string | number) => {
    const updated = [...lines];
    if (field === "medicineId") {
      const med = medicines.find((m) => m.id === val);
      if (med) {
        updated[index] = {
          ...updated[index],
          medicineId: med.id,
          unitCost: med.purchasePrice,
          gstRate: med.gstRate,
        };
      }
    } else {
      updated[index] = { ...updated[index], [field]: val };
    }
    setLines(updated);
  };

  // Compute live totals
  const computedSubtotal = lines.reduce(
    (sum, l) => sum + Number(l.quantity) * Number(l.unitCost) * (1 - Number(l.discountPercent) / 100),
    0
  );
  const computedTax = lines.reduce(
    (sum, l) =>
      sum +
      Number(l.quantity) *
        Number(l.unitCost) *
        (1 - Number(l.discountPercent) / 100) *
        (Number(l.gstRate) / 100),
    0
  );
  const computedGrandTotal = computedSubtotal + computedTax;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setSubmitting(true);

    try {
      const res = await fetch("/api/purchases/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vendorId,
          expectedDate: expectedDate || null,
          notes,
          lines,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || "Failed to create PO");
        setSubmitting(false);
        return;
      }

      setIsModalOpen(false);
      router.refresh();
      setOrders([
        {
          id: data.order.id,
          poNumber: data.order.poNumber,
          vendorId,
          vendorName: vendors.find((v) => v.id === vendorId)?.name || "Vendor",
          expectedDate: expectedDate || null,
          status: "ORDERED",
          subtotal: computedSubtotal,
          taxAmount: computedTax,
          discountAmount: 0,
          grandTotal: computedGrandTotal,
          notes: notes || "—",
          createdByName: "You",
          createdAt: new Date().toISOString(),
          lineCount: lines.length,
          lines: [],
        },
        ...orders,
      ]);
    } catch {
      setFormError("Network communication error");
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
            Purchase Orders (PO)
          </h1>
          <p className="text-xs text-slate-500">
            Create, approve, and track pharmaceutical procurement orders against distributor catalogs.
          </p>
        </div>
        <Button variant="primary" size="sm" onClick={() => setIsModalOpen(true)}>
          <Plus className="h-3.5 w-3.5" />
          <span>New Purchase Order</span>
        </Button>
      </div>

      {/* Search Bar */}
      <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-3 shadow-2xs">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by PO number or vendor name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 w-full rounded-md border border-slate-200 bg-slate-50 pl-8 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#0F766E] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#0F766E]"
          />
        </div>
      </div>

      {/* Orders Table */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>PO Number</TableHead>
            <TableHead>Vendor</TableHead>
            <TableHead>Order Date</TableHead>
            <TableHead>Expected Delivery</TableHead>
            <TableHead>Items</TableHead>
            <TableHead>Taxable Amount</TableHead>
            <TableHead>Grand Total (GST)</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredOrders.map((o) => (
            <TableRow key={o.id}>
              <TableCell className="font-mono font-semibold text-slate-900">
                {o.poNumber}
              </TableCell>

              <TableCell className="font-medium text-slate-800 text-xs">
                {o.vendorName}
              </TableCell>

              <TableCell className="text-xs text-slate-600">
                {formatDate(o.createdAt)}
              </TableCell>

              <TableCell className="text-xs text-slate-600">
                {o.expectedDate ? formatDate(o.expectedDate) : "Standard Net"}
              </TableCell>

              <TableCell className="text-xs text-slate-600">
                {o.lineCount} Items
              </TableCell>

              <TableCell className="text-xs text-slate-600">
                {formatINR(o.subtotal)}
              </TableCell>

              <TableCell className="font-bold text-slate-900 text-xs">
                {formatINR(o.grandTotal)}
              </TableCell>

              <TableCell>
                <Badge
                  variant={
                    o.status === "COMPLETED"
                      ? "success"
                      : o.status === "ORDERED"
                      ? "info"
                      : "neutral"
                  }
                  size="sm"
                >
                  {o.status}
                </Badge>
              </TableCell>

              <TableCell>
                {o.status !== "COMPLETED" && (
                  <Link
                    href={`/purchases/receipts?poId=${o.id}&vendorId=${o.vendorId}`}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[#0F766E] hover:underline"
                  >
                    <PackageCheck className="h-3.5 w-3.5" />
                    <span>Receive Stock</span>
                  </Link>
                )}
                {o.status === "COMPLETED" && (
                  <span className="text-xs text-emerald-700 font-medium">Received in Full</span>
                )}
              </TableCell>
            </TableRow>
          ))}

          {filteredOrders.length === 0 && (
            <TableRow>
              <TableCell colSpan={9} className="text-center py-8 text-slate-400">
                No purchase orders found.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {/* Create PO Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Create Purchase Order (PO)"
        description="Draft a stock procurement order with line items, negotiated rates, and GST calculations."
        maxWidth="2xl"
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
                Select Vendor *
              </label>
              <select
                value={vendorId}
                onChange={(e) => setVendorId(e.target.value)}
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

            <Input
              label="Expected Delivery Date"
              type="date"
              value={expectedDate}
              onChange={(e) => setExpectedDate(e.target.value)}
            />
          </div>

          {/* Line Items */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-800">
                Order Line Items
              </label>
              <button
                type="button"
                onClick={handleAddLine}
                className="text-xs font-semibold text-[#0F766E] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Plus className="h-3 w-3" />
                <span>Add Item</span>
              </button>
            </div>

            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {lines.map((line, idx) => (
                <div
                  key={idx}
                  className="grid grid-cols-12 gap-2 p-2 rounded-md bg-slate-50 border border-slate-200 items-center text-xs"
                >
                  <div className="col-span-4">
                    <select
                      value={line.medicineId}
                      onChange={(e) => handleLineChange(idx, "medicineId", e.target.value)}
                      className="w-full h-8 rounded border border-slate-300 bg-white px-2 text-xs text-slate-900 focus:border-[#0F766E] focus:outline-none"
                    >
                      {medicines.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} ({m.sku})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="col-span-2">
                    <input
                      type="number"
                      placeholder="Qty"
                      min={1}
                      value={line.quantity}
                      onChange={(e) => handleLineChange(idx, "quantity", Number(e.target.value))}
                      className="w-full h-8 rounded border border-slate-300 bg-white px-2 text-xs"
                      title="Quantity"
                    />
                  </div>

                  <div className="col-span-2">
                    <input
                      type="number"
                      placeholder="Unit Rate"
                      step="0.01"
                      value={line.unitCost}
                      onChange={(e) => handleLineChange(idx, "unitCost", Number(e.target.value))}
                      className="w-full h-8 rounded border border-slate-300 bg-white px-2 text-xs"
                      title="Unit Cost"
                    />
                  </div>

                  <div className="col-span-2">
                    <select
                      value={line.gstRate}
                      onChange={(e) => handleLineChange(idx, "gstRate", Number(e.target.value))}
                      className="w-full h-8 rounded border border-slate-300 bg-white px-2 text-xs"
                    >
                      <option value={0}>0% GST</option>
                      <option value={5}>5% GST</option>
                      <option value={12}>12% GST</option>
                      <option value={18}>18% GST</option>
                    </select>
                  </div>

                  <div className="col-span-1 text-right font-bold text-slate-800 text-xs">
                    {formatINR(
                      line.quantity * line.unitCost * (1 + line.gstRate / 100)
                    )}
                  </div>

                  <div className="col-span-1 text-right">
                    {lines.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveLine(idx)}
                        className="text-red-500 hover:text-red-700 p-1"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Totals Summary */}
          <div className="flex justify-end p-3 rounded-md bg-slate-100/70 border border-slate-200">
            <div className="text-right space-y-1 text-xs">
              <p className="text-slate-600">
                Taxable Subtotal:{" "}
                <span className="font-semibold text-slate-900">{formatINR(computedSubtotal)}</span>
              </p>
              <p className="text-slate-600">
                Estimated GST:{" "}
                <span className="font-semibold text-slate-900">{formatINR(computedTax)}</span>
              </p>
              <p className="text-sm font-bold text-slate-900 border-t border-slate-200 pt-1">
                Total Order Value: {formatINR(computedGrandTotal)}
              </p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Instructions / Notes to Vendor
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Please deliver to Jubilee Hills main pharmacy gate before 5 PM."
              className="w-full rounded-md border border-slate-300 p-2 text-xs focus:border-[#0F766E] focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={submitting}>
              Submit Purchase Order
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
