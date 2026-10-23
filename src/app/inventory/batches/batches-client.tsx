"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatINR, formatDate, getDaysToExpiry } from "@/lib/utils";
import { Search, ShieldAlert, CheckCircle, ShieldCheck } from "lucide-react";

interface BatchItem {
  id: string;
  batchNumber: string;
  medicineName: string;
  medicineSku: string;
  dispenseUnit: string;
  expiryDate: string;
  mrp: number;
  unitSalePrice: number;
  unitPurchaseCost: number;
  status: string; // ACTIVE, QUARANTINED, EXPIRED, DEPLETED
  supplierName: string;
  quantityAvailable: number;
}

export function BatchesClient({ initialBatches }: { initialBatches: BatchItem[] }) {
  const router = useRouter();
  const [batches, setBatches] = React.useState<BatchItem[]>(initialBatches);
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("ALL");

  const filteredBatches = React.useMemo(() => {
    return batches.filter((b) => {
      const matchSearch =
        search === "" ||
        b.batchNumber.toLowerCase().includes(search.toLowerCase()) ||
        b.medicineName.toLowerCase().includes(search.toLowerCase()) ||
        b.medicineSku.toLowerCase().includes(search.toLowerCase());

      const matchStatus = statusFilter === "ALL" || b.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [batches, search, statusFilter]);

  const handleToggleQuarantine = async (batchId: string, currentStatus: string) => {
    const newStatus = currentStatus === "QUARANTINED" ? "ACTIVE" : "QUARANTINED";
    try {
      const res = await fetch("/api/inventory/batches", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batchId, status: newStatus }),
      });
      if (res.ok) {
        setBatches(
          batches.map((b) => (b.id === batchId ? { ...b, status: newStatus } : b))
        );
        router.refresh();
      }
    } catch (e) {
      console.error("Failed to toggle quarantine:", e);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Batch-Level Inventory
          </h1>
          <p className="text-xs text-slate-500">
            Precise tracking of batch numbers, manufacturer expiries, acquisition costs & quarantine controls.
          </p>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center justify-between rounded-lg border border-slate-200 bg-white p-3 shadow-2xs">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by batch number, medicine, or SKU..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 w-full rounded-md border border-slate-200 bg-slate-50 pl-8 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#0F766E] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#0F766E]"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-8 rounded-md border border-slate-200 bg-slate-50 px-2.5 text-xs text-slate-800 focus:border-[#0F766E] focus:outline-none"
          >
            <option value="ALL">All Batches</option>
            <option value="ACTIVE">Active (Saleable)</option>
            <option value="QUARANTINED">Quarantined (Locked)</option>
            <option value="EXPIRED">Expired</option>
            <option value="DEPLETED">Depleted (0 Qty)</option>
          </select>
        </div>
      </div>

      {/* Batches Table */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Batch Number</TableHead>
            <TableHead>Medicine</TableHead>
            <TableHead>Expiry Date</TableHead>
            <TableHead>Available Units</TableHead>
            <TableHead>Cost / Sale / MRP</TableHead>
            <TableHead>Supplier</TableHead>
            <TableHead>Stock Status</TableHead>
            <TableHead>Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredBatches.map((b) => {
            const days = getDaysToExpiry(b.expiryDate);
            const isExpired = b.status === "EXPIRED" || days <= 0;
            const isQuarantined = b.status === "QUARANTINED";

            return (
              <TableRow key={b.id}>
                <TableCell className="font-mono font-bold text-slate-900">
                  {b.batchNumber}
                </TableCell>

                <TableCell className="text-xs">
                  <p className="font-semibold text-slate-900">{b.medicineName}</p>
                  <p className="text-slate-400 font-mono text-[11px]">{b.medicineSku}</p>
                </TableCell>

                <TableCell className="text-xs">
                  <p className="font-medium text-slate-800">{formatDate(b.expiryDate)}</p>
                  <p
                    className={`text-[10px] font-semibold ${
                      isExpired
                        ? "text-red-600"
                        : days <= 60
                        ? "text-amber-700"
                        : "text-slate-400"
                    }`}
                  >
                    {isExpired ? "EXPIRED" : `${days} days left`}
                  </p>
                </TableCell>

                <TableCell>
                  <span className="font-bold text-slate-900">
                    {b.quantityAvailable}
                  </span>{" "}
                  <span className="text-xs text-slate-500">{b.dispenseUnit}s</span>
                </TableCell>

                <TableCell className="text-xs">
                  <div className="space-y-0.5">
                    <p className="text-slate-500">Cost: {formatINR(b.unitPurchaseCost)}</p>
                    <p className="font-semibold text-slate-800">
                      Sale: {formatINR(b.unitSalePrice)}
                    </p>
                    <p className="text-[10px] text-slate-400">MRP: {formatINR(b.mrp)}</p>
                  </div>
                </TableCell>

                <TableCell className="text-xs text-slate-600 max-w-[140px] truncate">
                  {b.supplierName}
                </TableCell>

                <TableCell>
                  <Badge
                    variant={
                      isQuarantined
                        ? "danger"
                        : isExpired
                        ? "danger"
                        : b.status === "DEPLETED"
                        ? "neutral"
                        : "success"
                    }
                    size="sm"
                  >
                    {b.status}
                  </Badge>
                </TableCell>

                <TableCell>
                  {b.status !== "EXPIRED" && b.status !== "DEPLETED" && (
                    <Button
                      variant={isQuarantined ? "outline" : "ghost"}
                      size="sm"
                      onClick={() => handleToggleQuarantine(b.id, b.status)}
                      className={isQuarantined ? "text-emerald-700 border-emerald-300" : "text-amber-700"}
                    >
                      {isQuarantined ? (
                        <>
                          <ShieldCheck className="h-3.5 w-3.5 mr-1" />
                          <span>Release</span>
                        </>
                      ) : (
                        <>
                          <ShieldAlert className="h-3.5 w-3.5 mr-1" />
                          <span>Quarantine</span>
                        </>
                      )}
                    </Button>
                  )}
                  {isExpired && (
                    <span className="text-xs text-red-600 font-medium">Locked (Expired)</span>
                  )}
                </TableCell>
              </TableRow>
            );
          })}

          {filteredBatches.length === 0 && (
            <TableRow>
              <TableCell colSpan={8} className="text-center py-8 text-slate-400">
                No batches found matching the criteria.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
