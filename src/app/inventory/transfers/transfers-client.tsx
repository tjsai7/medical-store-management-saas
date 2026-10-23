"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { formatDate } from "@/lib/utils";
import { ArrowLeftRight, Plus, CheckCircle2, AlertCircle, Truck, PackageCheck } from "lucide-react";

interface TransferItem {
  id: string;
  transferNumber: string;
  originBranchId: string;
  originBranchName: string;
  destBranchId: string;
  destBranchName: string;
  status: string;
  notes: string;
  sentByName: string;
  sentAt: string;
  receivedByName: string | null;
  receivedAt: string | null;
  lineCount: number;
  lines: { id: string; medicineName: string; batchNumber: string; quantity: number }[];
}

interface BatchOption {
  id: string;
  medicineId: string;
  medicineName: string;
  batchNumber: string;
  dispenseUnit: string;
  quantityOnHand: number;
}

export function TransfersClient({
  currentBranchId,
  initialTransfers,
  branches,
  originBatches,
}: {
  currentBranchId: string;
  initialTransfers: TransferItem[];
  branches: { id: string; name: string; code: string }[];
  originBatches: BatchOption[];
}) {
  const router = useRouter();
  const [transfers, setTransfers] = React.useState<TransferItem[]>(initialTransfers);
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [receivingId, setReceivingId] = React.useState<string | null>(null);
  const [formError, setFormError] = React.useState("");

  const destinationBranches = branches.filter((b) => b.id !== currentBranchId);
  const [destBranchId, setDestBranchId] = React.useState(destinationBranches[0]?.id || "");
  const [selectedBatchId, setSelectedBatchId] = React.useState(originBatches[0]?.id || "");
  const [transferQty, setTransferQty] = React.useState(10);
  const [notes, setNotes] = React.useState("");

  const selectedBatch = originBatches.find((b) => b.id === selectedBatchId);

  const handleCreateTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBatch) return;
    setFormError("");
    setSubmitting(true);

    try {
      const res = await fetch("/api/inventory/transfers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          destBranchId,
          notes,
          lines: [
            {
              medicineId: selectedBatch.medicineId,
              batchId: selectedBatch.id,
              quantity: transferQty,
            },
          ],
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || "Failed to initiate transfer");
        setSubmitting(false);
        return;
      }

      setIsModalOpen(false);
      router.refresh();
      const destName = branches.find((b) => b.id === destBranchId)?.name || "Destination";
      setTransfers([
        {
          id: data.transfer.id,
          transferNumber: data.transfer.transferNumber,
          originBranchId: currentBranchId,
          originBranchName: "This Branch",
          destBranchId,
          destBranchName: destName,
          status: "IN_TRANSIT",
          notes: notes || "—",
          sentByName: "You",
          sentAt: new Date().toISOString(),
          receivedByName: null,
          receivedAt: null,
          lineCount: 1,
          lines: [
            {
              id: "1",
              medicineName: selectedBatch.medicineName,
              batchNumber: selectedBatch.batchNumber,
              quantity: transferQty,
            },
          ],
        },
        ...transfers,
      ]);
    } catch {
      setFormError("Network communication error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReceiveTransfer = async (transferId: string) => {
    setReceivingId(transferId);
    try {
      const res = await fetch("/api/inventory/transfers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transferId }),
      });

      if (res.ok) {
        setTransfers(
          transfers.map((t) =>
            t.id === transferId
              ? { ...t, status: "RECEIVED", receivedByName: "You", receivedAt: new Date().toISOString() }
              : t
          )
        );
        router.refresh();
      }
    } catch (e) {
      console.error("Receive transfer error:", e);
    } finally {
      setReceivingId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Inter-Branch Stock Transfers
          </h1>
          <p className="text-xs text-slate-500">
            Dispatch and receive stock between pharmacy branches with transactional in-transit isolation.
          </p>
        </div>
        <Button
          variant="primary"
          size="sm"
          onClick={() => setIsModalOpen(true)}
          disabled={destinationBranches.length === 0 || originBatches.length === 0}
        >
          <Plus className="h-3.5 w-3.5" />
          <span>Dispatch Stock Transfer</span>
        </Button>
      </div>

      {destinationBranches.length === 0 && (
        <div className="p-3 rounded-md bg-slate-100 text-xs text-slate-600">
          Inter-branch transfers require at least 2 active branch locations. Create additional branches in{" "}
          <strong>Operations → Branches & Locations</strong>.
        </div>
      )}

      {/* Table */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Transfer #</TableHead>
            <TableHead>Origin Branch</TableHead>
            <TableHead>Destination Branch</TableHead>
            <TableHead>Items / Batches</TableHead>
            <TableHead>Dispatched At</TableHead>
            <TableHead>Received At</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {transfers.map((t) => {
            const isDestination = t.destBranchId === currentBranchId;
            const canReceive = isDestination && t.status === "IN_TRANSIT";

            return (
              <TableRow key={t.id}>
                <TableCell className="font-mono font-semibold text-slate-900">
                  {t.transferNumber}
                </TableCell>

                <TableCell className="text-xs font-medium text-slate-800">
                  {t.originBranchName}
                </TableCell>

                <TableCell className="text-xs font-medium text-slate-800">
                  {t.destBranchName}
                </TableCell>

                <TableCell className="text-xs">
                  {t.lines.map((l, i) => (
                    <p key={i} className="font-semibold text-slate-800">
                      {l.medicineName} (Batch: {l.batchNumber}) x{l.quantity}
                    </p>
                  ))}
                </TableCell>

                <TableCell className="text-xs text-slate-600">
                  {formatDate(t.sentAt)} by {t.sentByName}
                </TableCell>

                <TableCell className="text-xs text-slate-600">
                  {t.receivedAt ? `${formatDate(t.receivedAt)} by ${t.receivedByName}` : "In Transit"}
                </TableCell>

                <TableCell>
                  <Badge variant={t.status === "RECEIVED" ? "success" : "info"} size="sm">
                    {t.status === "IN_TRANSIT" ? "IN TRANSIT" : "RECEIVED"}
                  </Badge>
                </TableCell>

                <TableCell>
                  {canReceive && (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleReceiveTransfer(t.id)}
                      isLoading={receivingId === t.id}
                    >
                      <PackageCheck className="h-3.5 w-3.5 mr-1" />
                      <span>Confirm Receipt</span>
                    </Button>
                  )}
                  {!canReceive && t.status === "IN_TRANSIT" && (
                    <span className="text-xs text-slate-400">En route to destination</span>
                  )}
                  {t.status === "RECEIVED" && (
                    <span className="text-xs text-emerald-700 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      <span>Stock Reconciled</span>
                    </span>
                  )}
                </TableCell>
              </TableRow>
            );
          })}

          {transfers.length === 0 && (
            <TableRow>
              <TableCell colSpan={8} className="text-center py-8 text-slate-400">
                No stock transfers recorded.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {/* Dispatch Transfer Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Dispatch Inter-Branch Stock Transfer"
        description="Immediately locks and deducts stock from origin branch balance while en route."
        maxWidth="md"
      >
        <form onSubmit={handleCreateTransfer} className="space-y-4">
          {formError && (
            <div className="flex items-center gap-2 p-3 text-xs rounded bg-red-50 text-red-700 border border-red-200">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Destination Store Branch *
            </label>
            <select
              value={destBranchId}
              onChange={(e) => setDestBranchId(e.target.value)}
              className="w-full h-9 rounded-md border border-slate-300 bg-white px-3 text-xs text-slate-900 focus:border-[#0F766E] focus:outline-none"
              required
            >
              {destinationBranches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.code})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Select Medicine Batch from Origin Stock *
            </label>
            <select
              value={selectedBatchId}
              onChange={(e) => setSelectedBatchId(e.target.value)}
              className="w-full h-9 rounded-md border border-slate-300 bg-white px-3 text-xs text-slate-900 focus:border-[#0F766E] focus:outline-none"
              required
            >
              {originBatches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.medicineName} — Batch: {b.batchNumber} ({b.quantityOnHand} {b.dispenseUnit}s available)
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Transfer Quantity ({selectedBatch?.dispenseUnit || "Unit"}s) *
            </label>
            <input
              type="number"
              min={1}
              max={selectedBatch?.quantityOnHand || 9999}
              value={transferQty}
              onChange={(e) => setTransferQty(Number(e.target.value))}
              className="w-full h-9 rounded-md border border-slate-300 px-3 text-sm focus:border-[#0F766E] focus:outline-none"
              required
            />
            {selectedBatch && (
              <p className="text-[11px] text-slate-500 mt-1">
                Available at origin: {selectedBatch.quantityOnHand} units.
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Transfer Dispatch Notes
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Stock replenishment dispatched via internal runner."
              className="w-full rounded-md border border-slate-300 p-2 text-xs focus:border-[#0F766E] focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={submitting}>
              Dispatch Stock
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
