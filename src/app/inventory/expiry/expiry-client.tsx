"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { KPICard } from "@/components/ui/kpi-card";
import { formatINR, formatDate, getDaysToExpiry } from "@/lib/utils";
import {
  CalendarX,
  AlertTriangle,
  Download,
  ShieldAlert,
  Trash2,
  CheckCircle,
} from "lucide-react";

interface ExpiryItem {
  id: string;
  batchNumber: string;
  medicineId: string;
  medicineName: string;
  categoryName: string;
  dispenseUnit: string;
  expiryDate: string;
  unitPurchaseCost: number;
  mrp: number;
  status: string;
  supplierName: string;
  quantityAvailable: number;
}

export function ExpiryClient({ initialBatches }: { initialBatches: ExpiryItem[] }) {
  const router = useRouter();
  const [batches, setBatches] = React.useState<ExpiryItem[]>(initialBatches);
  const [selectedWindow, setSelectedWindow] = React.useState<"ALL" | "EXPIRED" | "30" | "60" | "90">("60");
  const [disposalModalBatch, setDisposalModalBatch] = React.useState<ExpiryItem | null>(null);
  const [disposalQty, setDisposalQty] = React.useState(0);
  const [disposalNotes, setDisposalNotes] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Filter based on window
  const filteredBatches = React.useMemo(() => {
    return batches.filter((b) => {
      if (b.quantityAvailable <= 0) return false;
      const days = getDaysToExpiry(b.expiryDate);
      if (selectedWindow === "EXPIRED") return days <= 0 || b.status === "EXPIRED";
      if (selectedWindow === "30") return days > 0 && days <= 30;
      if (selectedWindow === "60") return days > 0 && days <= 60;
      if (selectedWindow === "90") return days > 0 && days <= 90;
      return true;
    });
  }, [batches, selectedWindow]);

  // Aggregate Metrics
  const expiredBatches = batches.filter(
    (b) => (getDaysToExpiry(b.expiryDate) <= 0 || b.status === "EXPIRED") && b.quantityAvailable > 0
  );
  const nearExpiryBatches = batches.filter(
    (b) => getDaysToExpiry(b.expiryDate) > 0 && getDaysToExpiry(b.expiryDate) <= 60 && b.quantityAvailable > 0
  );

  const totalAtRiskValuation = nearExpiryBatches.concat(expiredBatches).reduce(
    (sum, b) => sum + b.quantityAvailable * b.unitPurchaseCost,
    0
  );

  const handleWriteOff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!disposalModalBatch || disposalQty <= 0) return;
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/inventory/adjustments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          batchId: disposalModalBatch.id,
          reason: "EXPIRY_WRITEOFF",
          adjustmentType: "NEGATIVE",
          quantity: disposalQty,
          notes: disposalNotes || "Approved expired medicine disposal",
        }),
      });

      if (res.ok) {
        setBatches(
          batches.map((b) =>
            b.id === disposalModalBatch.id
              ? { ...b, quantityAvailable: b.quantityAvailable - disposalQty }
              : b
          )
        );
        setDisposalModalBatch(null);
        router.refresh();
      }
    } catch (e) {
      console.error("Write off error:", e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const exportCSV = () => {
    const headers = [
      "Medicine",
      "Batch Number",
      "Category",
      "Expiry Date",
      "Days Remaining",
      "Available Qty",
      "Unit Cost",
      "Total Risk Value",
      "Vendor",
      "Status",
    ];
    const rows = filteredBatches.map((b) => [
      `"${b.medicineName}"`,
      `"${b.batchNumber}"`,
      `"${b.categoryName}"`,
      formatDate(b.expiryDate),
      getDaysToExpiry(b.expiryDate),
      b.quantityAvailable,
      b.unitPurchaseCost,
      (b.quantityAvailable * b.unitPurchaseCost).toFixed(2),
      `"${b.supplierName}"`,
      b.status,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `expiry_risk_report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Expiry Date Management Workspace
          </h1>
          <p className="text-xs text-slate-500">
            Mitigate medicine wastage through early vendor returns, dynamic discounting & authorized write-offs.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={exportCSV}>
          <Download className="h-3.5 w-3.5" />
          <span>Export Expiry Ledger</span>
        </Button>
      </div>

      {/* KPI Overview */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <KPICard
          title="Total Financial Exposure"
          value={formatINR(totalAtRiskValuation)}
          subtitle="Inventory cost of expired and near-expiry stock"
          icon={AlertTriangle}
          variant="danger"
        />
        <KPICard
          title="Expired Batches (Quarantined)"
          value={expiredBatches.length}
          subtitle="Must be written off or claimed from supplier"
          icon={CalendarX}
          variant="danger"
        />
        <KPICard
          title="Expiring Within 60 Days"
          value={nearExpiryBatches.length}
          subtitle="High velocity liquidation recommended"
          icon={AlertTriangle}
          variant="warning"
        />
      </div>

      {/* Window Tabs */}
      <div className="flex items-center gap-1.5 border-b border-slate-200 pb-2">
        {(
          [
            { id: "60", label: "Expiring in 60 Days", count: nearExpiryBatches.length },
            { id: "30", label: "Critical (<30 Days)", count: batches.filter((b) => getDaysToExpiry(b.expiryDate) > 0 && getDaysToExpiry(b.expiryDate) <= 30 && b.quantityAvailable > 0).length },
            { id: "90", label: "Next 90 Days", count: batches.filter((b) => getDaysToExpiry(b.expiryDate) > 0 && getDaysToExpiry(b.expiryDate) <= 90 && b.quantityAvailable > 0).length },
            { id: "EXPIRED", label: "Already Expired", count: expiredBatches.length },
            { id: "ALL", label: "All Active Batches", count: batches.filter((b) => b.quantityAvailable > 0).length },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setSelectedWindow(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
              selectedWindow === tab.id
                ? "bg-teal-50 text-[#0F766E] border border-teal-200"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            <span>{tab.label}</span>
            <span
              className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                selectedWindow === tab.id
                  ? "bg-[#0F766E] text-white"
                  : "bg-slate-200 text-slate-700"
              }`}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Expiry Data Table */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Medicine</TableHead>
            <TableHead>Batch #</TableHead>
            <TableHead>Expiry Date</TableHead>
            <TableHead>Days Remaining</TableHead>
            <TableHead>Stock at Risk</TableHead>
            <TableHead>Valuation Exposure</TableHead>
            <TableHead>Preferred Vendor</TableHead>
            <TableHead>Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredBatches.map((b) => {
            const days = getDaysToExpiry(b.expiryDate);
            const isExpired = days <= 0 || b.status === "EXPIRED";

            return (
              <TableRow key={b.id}>
                <TableCell className="font-semibold text-slate-900">
                  <p>{b.medicineName}</p>
                  <p className="text-[11px] text-slate-400 font-normal">{b.categoryName}</p>
                </TableCell>

                <TableCell className="font-mono text-xs">{b.batchNumber}</TableCell>

                <TableCell className="text-xs">{formatDate(b.expiryDate)}</TableCell>

                <TableCell>
                  <Badge variant={isExpired ? "danger" : days <= 30 ? "danger" : "warning"} size="sm">
                    {isExpired ? "EXPIRED" : `${days} days`}
                  </Badge>
                </TableCell>

                <TableCell className="font-bold text-slate-900">
                  {b.quantityAvailable} {b.dispenseUnit}s
                </TableCell>

                <TableCell className="text-xs font-semibold text-slate-900">
                  {formatINR(b.quantityAvailable * b.unitPurchaseCost)}
                </TableCell>

                <TableCell className="text-xs text-slate-600 truncate max-w-[140px]">
                  {b.supplierName}
                </TableCell>

                <TableCell>
                  <div className="flex items-center gap-1.5">
                    {isExpired ? (
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => {
                          setDisposalModalBatch(b);
                          setDisposalQty(b.quantityAvailable);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>Write Off</span>
                      </Button>
                    ) : (
                      <span className="text-xs font-medium text-amber-700">
                        Prioritize in POS (FEFO)
                      </span>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}

          {filteredBatches.length === 0 && (
            <TableRow>
              <TableCell colSpan={8} className="text-center py-8 text-slate-400">
                No items match this expiry window filter.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {/* Disposal & Write-off Confirmation Modal */}
      {disposalModalBatch && (
        <Modal
          isOpen={!!disposalModalBatch}
          onClose={() => setDisposalModalBatch(null)}
          title="Record Expired Stock Disposal / Write-Off"
          description="This action posts a verified disposal to the immutable Stock Ledger and deducts quantity from inventory."
          maxWidth="md"
        >
          <form onSubmit={handleWriteOff} className="space-y-4">
            <div className="rounded-md bg-red-50 p-3 text-xs text-red-800 border border-red-200">
              <p className="font-semibold">Confirming Disposal for:</p>
              <p className="mt-1">
                {disposalModalBatch.medicineName} (Batch: {disposalModalBatch.batchNumber})
              </p>
              <p className="text-[11px] text-red-600 mt-0.5">
                Acquisition Cost: {formatINR(disposalModalBatch.unitPurchaseCost)} per unit
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Quantity to Write Off ({disposalModalBatch.dispenseUnit}s)
              </label>
              <input
                type="number"
                max={disposalModalBatch.quantityAvailable}
                min={1}
                value={disposalQty}
                onChange={(e) => setDisposalQty(Number(e.target.value))}
                className="w-full h-9 rounded-md border border-slate-300 px-3 text-sm focus:border-red-500 focus:outline-none"
                required
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Total financial loss write-off:{" "}
                <span className="font-bold text-red-600">
                  {formatINR(disposalQty * disposalModalBatch.unitPurchaseCost)}
                </span>
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Disposal Reason / Incineration Protocol Notes
              </label>
              <textarea
                rows={2}
                value={disposalNotes}
                onChange={(e) => setDisposalNotes(e.target.value)}
                placeholder="e.g. Quarantined stock incinerated per biomedical waste compliance guidelines."
                className="w-full rounded-md border border-slate-300 p-2 text-xs focus:border-[#0F766E] focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDisposalModalBatch(null)}
              >
                Cancel
              </Button>
              <Button type="submit" variant="danger" isLoading={isSubmitting}>
                Authorize Write-Off
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
