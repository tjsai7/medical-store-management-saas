"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { formatDate } from "@/lib/utils";
import { Plus, Search, Trash2, AlertCircle } from "lucide-react";

interface GRNLine {
  id?: string;
  medicineName?: string;
  batchNumber: string;
  expiryDate: string;
  quantity: number;
  freeQuantity: number;
  unitPurchaseCost: number;
  mrp: number;
}

interface GRNItem {
  id: string;
  grnNumber: string;
  vendorName: string;
  poNumber: string;
  supplierChallan: string;
  receiptDate: string;
  receivedByName: string;
  status: string;
  lines: GRNLine[];
}

interface MedicineRef {
  id: string;
  name: string;
  sku: string;
  dispenseUnit: string;
  purchasePrice: number;
  mrp: number;
  gstRate: number;
}

interface PendingPO {
  id: string;
  poNumber: string;
  vendorId: string;
  vendorName: string;
  lines: {
    medicineId: string;
    medicineName: string;
    quantity: number;
    unitCost: number;
    gstRate: number;
  }[];
}

export function ReceiptsClient({
  initialReceipts,
  vendors,
  medicines,
  pendingPOs,
}: {
  initialReceipts: GRNItem[];
  vendors: { id: string; name: string; code: string }[];
  medicines: MedicineRef[];
  pendingPOs: PendingPO[];
}) {
  const router = useRouter();
  const [receipts, setReceipts] = React.useState<GRNItem[]>(initialReceipts);
  const [search, setSearch] = React.useState("");
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [formError, setFormError] = React.useState("");

  // Form State
  const [vendorId, setVendorId] = React.useState(vendors[0]?.id || "");
  const [selectedPOId, setSelectedPOId] = React.useState("");
  const [supplierChallan, setSupplierChallan] = React.useState("");
  const [notes] = React.useState("");

  const [lines, setLines] = React.useState<
    Array<{
      medicineId: string;
      batchNumber: string;
      expiryDate: string;
      quantity: number;
      freeQuantity: number;
      unitPurchaseCost: number;
      mrp: number;
      gstRate: number;
    }>
  >([
    {
      medicineId: medicines[0]?.id || "",
      batchNumber: "BN26-001",
      expiryDate: "2027-12-31",
      quantity: 50,
      freeQuantity: 0,
      unitPurchaseCost: medicines[0]?.purchasePrice || 0,
      mrp: medicines[0]?.mrp || 0,
      gstRate: medicines[0]?.gstRate || 12,
    },
  ]);

  const filteredReceipts = React.useMemo(() => {
    return receipts.filter((r) => {
      const q = search.toLowerCase();
      return (
        search === "" ||
        r.grnNumber.toLowerCase().includes(q) ||
        r.vendorName.toLowerCase().includes(q) ||
        r.poNumber.toLowerCase().includes(q)
      );
    });
  }, [receipts, search]);

  const handleSelectPO = (poId: string) => {
    setSelectedPOId(poId);
    if (!poId) return;

    const po = pendingPOs.find((p) => p.id === poId);
    if (po) {
      setVendorId(po.vendorId);
      setLines(
        po.lines.map((l, idx) => {
          const med = medicines.find((m) => m.id === l.medicineId);
          return {
            medicineId: l.medicineId,
            batchNumber: `BN-${Date.now().toString().slice(-4)}-${idx + 1}`,
            expiryDate: "2027-12-31",
            quantity: l.quantity,
            freeQuantity: 0,
            unitPurchaseCost: l.unitCost,
            mrp: med ? med.mrp : l.unitCost * 1.3,
            gstRate: l.gstRate,
          };
        })
      );
    }
  };

  const handleAddLine = () => {
    if (medicines.length === 0) return;
    const med = medicines[0];
    setLines([
      ...lines,
      {
        medicineId: med.id,
        batchNumber: `BN-${Date.now().toString().slice(-4)}`,
        expiryDate: "2027-12-31",
        quantity: 20,
        freeQuantity: 0,
        unitPurchaseCost: med.purchasePrice,
        mrp: med.mrp,
        gstRate: med.gstRate,
      },
    ]);
  };

  const handleRemoveLine = (idx: number) => {
    if (lines.length === 1) return;
    setLines(lines.filter((_, i) => i !== idx));
  };

  const handleLineChange = (index: number, field: string, val: string | number) => {
    const updated = [...lines];
    if (field === "medicineId") {
      const med = medicines.find((m) => m.id === val);
      if (med) {
        updated[index] = {
          ...updated[index],
          medicineId: med.id,
          unitPurchaseCost: med.purchasePrice,
          mrp: med.mrp,
          gstRate: med.gstRate,
        };
      }
    } else {
      updated[index] = { ...updated[index], [field]: val };
    }
    setLines(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setSubmitting(true);

    try {
      const res = await fetch("/api/purchases/receipts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vendorId,
          poId: selectedPOId || null,
          supplierChallan,
          notes,
          lines,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || "Failed to post goods receipt");
        setSubmitting(false);
        return;
      }

      setIsModalOpen(false);
      router.refresh();
      // Add newly created GRN
      setReceipts([
        {
          id: data.goodsReceipt.id,
          grnNumber: data.goodsReceipt.grnNumber,
          vendorName: vendors.find((v) => v.id === vendorId)?.name || "Vendor",
          poNumber: selectedPOId
            ? pendingPOs.find((p) => p.id === selectedPOId)?.poNumber || "PO"
            : "Direct Receipt",
          supplierChallan: supplierChallan || "—",
          receiptDate: new Date().toISOString(),
          receivedByName: "You",
          status: "POSTED",
          lines: lines.map((l) => ({
            batchNumber: l.batchNumber,
            expiryDate: l.expiryDate,
            quantity: l.quantity,
            freeQuantity: l.freeQuantity,
            unitPurchaseCost: l.unitPurchaseCost,
            mrp: l.mrp,
          })),
        },
        ...receipts,
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
            Goods Received Notes (GRN)
          </h1>
          <p className="text-xs text-slate-500">
            Receive incoming medicine shipments, record batch numbers, manufacturer expiries, and post directly to the stock ledger.
          </p>
        </div>
        <Button variant="primary" size="sm" onClick={() => setIsModalOpen(true)}>
          <Plus className="h-3.5 w-3.5" />
          <span>Receive Shipment (GRN)</span>
        </Button>
      </div>

      {/* Search Bar */}
      <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-3 shadow-2xs">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by GRN number, vendor, or PO..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 w-full rounded-md border border-slate-200 bg-slate-50 pl-8 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#0F766E] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#0F766E]"
          />
        </div>
      </div>

      {/* Receipts Table */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>GRN Number</TableHead>
            <TableHead>Vendor</TableHead>
            <TableHead>PO Reference</TableHead>
            <TableHead>Challan #</TableHead>
            <TableHead>Receipt Date</TableHead>
            <TableHead>Received By</TableHead>
            <TableHead>Batches Received</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredReceipts.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="font-mono font-semibold text-slate-900">
                {r.grnNumber}
              </TableCell>

              <TableCell className="font-medium text-slate-800 text-xs">
                {r.vendorName}
              </TableCell>

              <TableCell className="font-mono text-xs text-slate-600">
                {r.poNumber}
              </TableCell>

              <TableCell className="text-xs text-slate-600">
                {r.supplierChallan}
              </TableCell>

              <TableCell className="text-xs text-slate-600">
                {formatDate(r.receiptDate)}
              </TableCell>

              <TableCell className="text-xs text-slate-600">
                {r.receivedByName}
              </TableCell>

              <TableCell className="text-xs">
                <span className="font-semibold text-teal-800">
                  {r.lines.length} {r.lines.length === 1 ? "Batch" : "Batches"}
                </span>
              </TableCell>

              <TableCell>
                <Badge variant="success" size="sm">
                  POSTED
                </Badge>
              </TableCell>
            </TableRow>
          ))}

          {filteredReceipts.length === 0 && (
            <TableRow>
              <TableCell colSpan={8} className="text-center py-8 text-slate-400">
                No goods receipt records found.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {/* Receive Shipment Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Post Goods Receipt Note (GRN)"
        description="Captures batch numbers and expiries, automatically generating inventory batches and posting ledger receipts."
        maxWidth="2xl"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && (
            <div className="flex items-center gap-2 p-3 text-xs rounded bg-red-50 text-red-700 border border-red-200">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {/* Pending PO Linking */}
          {pendingPOs.length > 0 && (
            <div className="p-2.5 rounded-md bg-teal-50 border border-teal-200 text-xs">
              <label className="block font-semibold text-teal-900 mb-1">
                Link to an Approved Purchase Order (Optional):
              </label>
              <select
                value={selectedPOId}
                onChange={(e) => handleSelectPO(e.target.value)}
                className="w-full h-8 rounded border border-teal-300 bg-white px-2 text-xs text-slate-900 focus:outline-none"
              >
                <option value="">-- Direct Receipt without PO --</option>
                {pendingPOs.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.poNumber} — {p.vendorName} ({p.lines.length} items)
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Vendor / Distributor *
              </label>
              <select
                value={vendorId}
                onChange={(e) => setVendorId(e.target.value)}
                disabled={!!selectedPOId}
                className="w-full h-9 rounded-md border border-slate-300 bg-white px-3 text-xs text-slate-900 focus:border-[#0F766E] focus:outline-none disabled:bg-slate-100"
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
              label="Supplier Challan / Delivery Note #"
              placeholder="e.g. DC-98421"
              value={supplierChallan}
              onChange={(e) => setSupplierChallan(e.target.value)}
            />
          </div>

          {/* Received Line Items */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-800">
                Received Medicine Items & Batch Details
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

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {lines.map((line, idx) => (
                <div
                  key={idx}
                  className="grid grid-cols-12 gap-2 p-2 rounded-md bg-slate-50 border border-slate-200 items-center text-xs"
                >
                  <div className="col-span-3">
                    <label className="block text-[10px] text-slate-500">Medicine</label>
                    <select
                      value={line.medicineId}
                      onChange={(e) => handleLineChange(idx, "medicineId", e.target.value)}
                      className="w-full h-8 rounded border border-slate-300 bg-white px-1.5 text-xs text-slate-900"
                    >
                      {medicines.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="col-span-2">
                    <label className="block text-[10px] text-slate-500">Batch # *</label>
                    <input
                      type="text"
                      placeholder="Batch #"
                      value={line.batchNumber}
                      onChange={(e) => handleLineChange(idx, "batchNumber", e.target.value)}
                      className="w-full h-8 rounded border border-slate-300 bg-white px-2 text-xs font-mono uppercase"
                      required
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-[10px] text-slate-500">Expiry Date *</label>
                    <input
                      type="date"
                      value={line.expiryDate}
                      onChange={(e) => handleLineChange(idx, "expiryDate", e.target.value)}
                      className="w-full h-8 rounded border border-slate-300 bg-white px-1.5 text-xs"
                      required
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-[10px] text-slate-500">Qty (Dispense)</label>
                    <input
                      type="number"
                      min={1}
                      value={line.quantity}
                      onChange={(e) => handleLineChange(idx, "quantity", Number(e.target.value))}
                      className="w-full h-8 rounded border border-slate-300 bg-white px-2 text-xs"
                      required
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-[10px] text-slate-500">Cost (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={line.unitPurchaseCost}
                      onChange={(e) =>
                        handleLineChange(idx, "unitPurchaseCost", Number(e.target.value))
                      }
                      className="w-full h-8 rounded border border-slate-300 bg-white px-2 text-xs"
                      required
                    />
                  </div>

                  <div className="col-span-1 text-right pt-3">
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

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={submitting}>
              Post to Inventory & Ledger
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
