import * as React from "react";
import Link from "next/link";
import { AppLayout } from "@/components/layout/app-layout";
import { requireAuthContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatINR } from "@/lib/utils";
import { AlertTriangle, Plus, FileSpreadsheet, CheckCircle2 } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ReorderPage() {
  const auth = await requireAuthContext();
  const tenantId = auth.tenant?.id;
  const branchId = auth.activeBranch?.id;

  if (!tenantId || !branchId) {
    return <AppLayout><div>Unauthorized</div></AppLayout>;
  }

  // Fetch balances where stock <= minStockAlert
  const balances = await prisma.inventoryBalance.findMany({
    where: { tenantId, branchId },
    include: {
      medicine: { include: { category: true } },
      batch: { include: { supplier: true } },
    },
  });

  // Aggregate by medicine
  const medicineMap = new Map<
    string,
    {
      medicineId: string;
      name: string;
      sku: string;
      category: string;
      dispenseUnit: string;
      totalStock: number;
      minStockAlert: number;
      suggestedReorderQty: number;
      purchaseCost: number;
      preferredSupplier: string;
      supplierId?: string;
    }
  >();

  for (const b of balances) {
    const existing = medicineMap.get(b.medicineId);
    const qty = Number(b.quantityOnHand);
    if (existing) {
      existing.totalStock += qty;
    } else {
      medicineMap.set(b.medicineId, {
        medicineId: b.medicine.id,
        name: b.medicine.name,
        sku: b.medicine.sku,
        category: b.medicine.category?.name || "General",
        dispenseUnit: b.medicine.dispenseUnit,
        totalStock: qty,
        minStockAlert: b.medicine.minStockAlert,
        suggestedReorderQty: b.medicine.reorderQty,
        purchaseCost: Number(b.medicine.purchasePrice),
        preferredSupplier: b.batch.supplier?.name || "Direct Supplier",
        supplierId: b.batch.supplierId || undefined,
      });
    }
  }

  const lowStockItems = Array.from(medicineMap.values()).filter(
    (item) => item.totalStock <= item.minStockAlert
  );

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              Low Stock & Reorder Workspace
            </h1>
            <p className="text-xs text-slate-500">
              Proactively identify depleting stock lines and create supplier replenishment purchase orders.
            </p>
          </div>
          <Link
            href="/purchases/orders"
            className="inline-flex items-center gap-1.5 rounded-md bg-[#0F766E] px-3.5 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-[#115E59] transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Create Purchase Order</span>
          </Link>
        </div>

        {/* Low Stock Items Table */}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Medicine</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Current Stock</TableHead>
              <TableHead>Safety Threshold</TableHead>
              <TableHead>Suggested Reorder</TableHead>
              <TableHead>Est. Order Value</TableHead>
              <TableHead>Preferred Vendor</TableHead>
              <TableHead>Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lowStockItems.map((item) => (
              <TableRow key={item.medicineId}>
                <TableCell className="font-semibold text-slate-900">
                  <p>{item.name}</p>
                  <p className="text-[11px] text-slate-400 font-normal">{item.category}</p>
                </TableCell>

                <TableCell className="font-mono text-xs text-slate-600">
                  {item.sku}
                </TableCell>

                <TableCell>
                  <span className="font-bold text-red-600">
                    {item.totalStock}
                  </span>{" "}
                  <span className="text-xs text-slate-500">{item.dispenseUnit}s</span>
                </TableCell>

                <TableCell className="text-xs font-medium text-slate-700">
                  {item.minStockAlert} {item.dispenseUnit}s
                </TableCell>

                <TableCell className="text-xs font-bold text-teal-800">
                  +{item.suggestedReorderQty} {item.dispenseUnit}s
                </TableCell>

                <TableCell className="text-xs font-semibold text-slate-900">
                  {formatINR(item.suggestedReorderQty * item.purchaseCost)}
                </TableCell>

                <TableCell className="text-xs text-slate-600 truncate max-w-[140px]">
                  {item.preferredSupplier}
                </TableCell>

                <TableCell>
                  <Link
                    href={`/purchases/orders?medicineId=${item.medicineId}&qty=${item.suggestedReorderQty}&vendorId=${item.supplierId || ""}`}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[#0F766E] hover:underline"
                  >
                    <FileSpreadsheet className="h-3.5 w-3.5" />
                    <span>Generate PO</span>
                  </Link>
                </TableCell>
              </TableRow>
            ))}

            {lowStockItems.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-12 text-slate-400">
                  <div className="flex flex-col items-center justify-center space-y-2">
                    <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                    <p className="font-semibold text-slate-700">All Stock Levels Healthy</p>
                    <p className="text-xs text-slate-400">
                      No medicines are currently below their minimum safety thresholds.
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </AppLayout>
  );
}
