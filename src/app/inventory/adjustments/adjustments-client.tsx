"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { formatINR, formatDateTime } from "@/lib/utils";
import { SlidersHorizontal, Plus, AlertCircle, FileText } from "lucide-react";

interface AdjustmentRecord {
  id: string;
  adjustmentNumber: string;
  adjustmentDate: string;
  reason: string;
  totalAmount: number;
  createdByName: string;
}

interface LedgerRecord {
  id: string;
  medicineName: string;
  batchNumber: string;
  movementType: string;
  quantityDelta: number;
  balanceAfter: number;
  costPerUnit: number;
  referenceId: string;
  notes: string;
  createdByName: string;
  createdAt: string;
}

interface BatchOption {
  id: string;
  batchNumber: string;
  medicineName: string;
  dispenseUnit: string;
  unitCost: number;
  quantityOnHand: number;
}

export function AdjustmentsClient({
  initialAdjustments,
  initialLedgerEntries,
  batches,
}: {
  initialAdjustments: AdjustmentRecord[];
  initialLedgerEntries: LedgerRecord[];
  batches: BatchOption[];
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = React.useState<"ADJUSTMENTS" | "LEDGER">("ADJUSTMENTS");
  const [adjustments, setAdjustments] = React.useState<AdjustmentRecord[]>(initialAdjustments);
  const [ledger, setLedger] = React.useState<LedgerRecord[]>(initialLedgerEntries);
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [formError, setFormError] = React.useState("");

  // Adjustment form state
  const [selectedBatchId, setSelectedBatchId] = React.useState(batches[0]?.id || "");
  const [adjustmentType, setAdjustmentType] = React.useState<"NEGATIVE" | "POSITIVE">("NEGATIVE");
  const [reason, setReason] = React.useState("PHYSICAL_COUNT_VARIANCE");
  const [quantity, setQuantity] = React.useState(1);
  const [notes, setNotes] = React.useState("");

  const selectedBatch = batches.find((b) => b.id === selectedBatchId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setSubmitting(true);

    try {
      const res = await fetch("/api/inventory/adjustments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          batchId: selectedBatchId,
          adjustmentType,
          reason,
          quantity: Number(quantity),
          notes,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || "Failed to post stock adjustment");
        setSubmitting(false);
        return;
      }

      setIsModalOpen(false);
      router.refresh();
      // Optimistic update
      setAdjustments([
        {
          id: data.adjustment.id,
          adjustmentNumber: data.adjustment.adjustmentNumber,
          adjustmentDate: new Date().toISOString(),
          reason,
          totalAmount: Number(data.adjustment.totalAmount),
          createdByName: "You",
        },
        ...adjustments,
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
            Stock Adjustments & Reconciliation
          </h1>
          <p className="text-xs text-slate-500">
            Controlled physical inventory corrections, breakage write-offs, and immutable stock ledger entries.
          </p>
        </div>
        <Button variant="primary" size="sm" onClick={() => setIsModalOpen(true)}>
          <Plus className="h-3.5 w-3.5" />
          <span>New Stock Adjustment</span>
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200">
        <button
          onClick={() => setActiveTab("ADJUSTMENTS")}
          className={`px-3.5 py-2 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
            activeTab === "ADJUSTMENTS"
              ? "border-[#0F766E] text-[#0F766E]"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          Adjustment Sessions ({adjustments.length})
        </button>
        <button
          onClick={() => setActiveTab("LEDGER")}
          className={`px-3.5 py-2 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
            activeTab === "LEDGER"
              ? "border-[#0F766E] text-[#0F766E]"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          Immutable Stock Ledger Trail ({ledger.length})
        </button>
      </div>

      {/* Tab 1: Adjustment Sessions */}
      {activeTab === "ADJUSTMENTS" && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Adjustment #</TableHead>
              <TableHead>Date & Time</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Total Valuation Impact</TableHead>
              <TableHead>Authorized By</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {adjustments.map((a) => (
              <TableRow key={a.id}>
                <TableCell className="font-mono font-semibold text-slate-900">
                  {a.adjustmentNumber}
                </TableCell>
                <TableCell className="text-xs">{formatDateTime(a.adjustmentDate)}</TableCell>
                <TableCell>
                  <Badge variant="neutral" size="sm">
                    {a.reason.replace(/_/g, " ")}
                  </Badge>
                </TableCell>
                <TableCell className="font-bold text-slate-900">
                  {formatINR(a.totalAmount)}
                </TableCell>
                <TableCell className="text-xs text-slate-700">{a.createdByName}</TableCell>
                <TableCell>
                  <Badge variant="success" size="sm">
                    POSTED
                  </Badge>
                </TableCell>
              </TableRow>
            ))}

            {adjustments.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-slate-400">
                  No stock adjustments recorded yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}

      {/* Tab 2: Stock Ledger Movements */}
      {activeTab === "LEDGER" && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Timestamp</TableHead>
              <TableHead>Medicine</TableHead>
              <TableHead>Batch #</TableHead>
              <TableHead>Movement Type</TableHead>
              <TableHead>Quantity Delta</TableHead>
              <TableHead>Balance After</TableHead>
              <TableHead>Cost / Unit</TableHead>
              <TableHead>Reference / Notes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ledger.map((l) => {
              const isPositive = l.quantityDelta > 0;
              return (
                <TableRow key={l.id}>
                  <TableCell className="text-xs text-slate-500 font-mono">
                    {formatDateTime(l.createdAt)}
                  </TableCell>
                  <TableCell className="font-semibold text-slate-900 text-xs">
                    {l.medicineName}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{l.batchNumber}</TableCell>
                  <TableCell>
                    <Badge variant={isPositive ? "success" : "danger"} size="sm">
                      {l.movementType.replace(/_/g, " ")}
                    </Badge>
                  </TableCell>
                  <TableCell className={`font-bold ${isPositive ? "text-emerald-700" : "text-red-600"}`}>
                    {isPositive ? `+${l.quantityDelta}` : l.quantityDelta}
                  </TableCell>
                  <TableCell className="font-bold text-slate-900 text-xs">
                    {l.balanceAfter}
                  </TableCell>
                  <TableCell className="text-xs">{formatINR(l.costPerUnit)}</TableCell>
                  <TableCell className="text-xs text-slate-500 max-w-[180px] truncate">
                    {l.notes} ({l.referenceId})
                  </TableCell>
                </TableRow>
              );
            })}

            {ledger.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-slate-400">
                  No adjustment ledger movements recorded.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}

      {/* New Adjustment Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Post Controlled Stock Adjustment"
        description="Every adjustment is cryptographically validated and logged to the permanent audit ledger."
        maxWidth="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && (
            <div className="flex items-center gap-2 p-3 text-xs rounded bg-red-50 text-red-700 border border-red-200">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Select Batch & Medicine *
            </label>
            <select
              value={selectedBatchId}
              onChange={(e) => setSelectedBatchId(e.target.value)}
              className="w-full h-9 rounded-md border border-slate-300 bg-white px-3 text-xs text-slate-900 focus:border-[#0F766E] focus:outline-none"
              required
            >
              {batches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.medicineName} — Batch: {b.batchNumber} (Avail: {b.quantityOnHand} {b.dispenseUnit}s)
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Adjustment Type
              </label>
              <select
                value={adjustmentType}
                onChange={(e) => setAdjustmentType(e.target.value as "NEGATIVE" | "POSITIVE")}
                className="w-full h-9 rounded-md border border-slate-300 bg-white px-3 text-xs text-slate-900 focus:border-[#0F766E] focus:outline-none"
              >
                <option value="NEGATIVE">Stock Deduction (- Decrease)</option>
                <option value="POSITIVE">Stock Addition (+ Increase)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Reason *
              </label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full h-9 rounded-md border border-slate-300 bg-white px-3 text-xs text-slate-900 focus:border-[#0F766E] focus:outline-none"
              >
                <option value="PHYSICAL_COUNT_VARIANCE">Physical Count Variance</option>
                <option value="DAMAGED">Damaged / Broken in Store</option>
                <option value="EXPIRY_WRITEOFF">Expiry Write-Off</option>
                <option value="THEFT">Unaccounted Discrepancy / Theft</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Quantity ({selectedBatch?.dispenseUnit || "Unit"}s) *
            </label>
            <input
              type="number"
              min={1}
              max={adjustmentType === "NEGATIVE" ? selectedBatch?.quantityOnHand || 999999 : undefined}
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              className="w-full h-9 rounded-md border border-slate-300 px-3 text-sm focus:border-[#0F766E] focus:outline-none"
              required
            />
            {selectedBatch && (
              <p className="text-[11px] text-slate-500 mt-1">
                Current on-hand: <span className="font-semibold">{selectedBatch.quantityOnHand}</span> units. Cost: {formatINR(selectedBatch.unitCost)}/unit. Estimated value:{" "}
                <span className="font-bold text-slate-900">
                  {formatINR(quantity * selectedBatch.unitCost)}
                </span>
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Audit Notes / Verification Reference
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Verified by Store Manager during quarterly inventory audit."
              className="w-full rounded-md border border-slate-300 p-2 text-xs focus:border-[#0F766E] focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={submitting}>
              Post Adjustment
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
