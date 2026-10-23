import * as React from "react";
import Link from "next/link";
import { AppLayout } from "@/components/layout/app-layout";
import { requireAuthContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatINR } from "@/lib/utils";
import { Boxes, ArrowRight, Layers, AlertTriangle } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function StockBalancesPage() {
  const auth = await requireAuthContext();
  const tenantId = auth.tenant?.id;
  const branchId = auth.activeBranch?.id;

  if (!tenantId || !branchId) {
    return <AppLayout><div>Unauthorized</div></AppLayout>;
  }

  const medicines = await prisma.medicine.findMany({
    where: { tenantId, isActive: true },
    include: {
      category: true,
      batches: {
        where: { branchId },
        include: { inventoryBalances: { where: { branchId } } },
      },
    },
    orderBy: { name: "asc" },
  });

  return (
    <AppLayout>
      <div className="space-y-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Inventory & Stock Balances
          </h1>
          <p className="text-xs text-slate-500">
            Current on-hand stock balances, valuation, and batch distribution for{" "}
            <span className="font-semibold text-slate-700">{auth.activeBranch?.name}</span>.
          </p>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Medicine</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Batches</TableHead>
              <TableHead>Stock on Hand</TableHead>
              <TableHead>Stock Valuation</TableHead>
              <TableHead>Reorder Threshold</TableHead>
              <TableHead>Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {medicines.map((m) => {
              const totalStock = m.batches.reduce(
                (sum, b) =>
                  sum +
                  b.inventoryBalances.reduce(
                    (bSum, ib) => bSum + Number(ib.quantityOnHand),
                    0
                  ),
                0
              );
              const totalValuation = m.batches.reduce(
                (sum, b) =>
                  sum +
                  b.inventoryBalances.reduce(
                    (bSum, ib) =>
                      bSum + Number(ib.quantityOnHand) * Number(b.unitPurchaseCost),
                    0
                  ),
                0
              );
              const isLowStock = totalStock <= m.minStockAlert;

              return (
                <TableRow key={m.id}>
                  <TableCell className="font-semibold text-slate-900">
                    <p>{m.name}</p>
                    <p className="text-[11px] text-slate-400 font-normal">
                      {m.dosageForm} • {m.genericName || "—"}
                    </p>
                  </TableCell>

                  <TableCell className="font-mono text-xs">{m.sku}</TableCell>

                  <TableCell className="text-xs text-slate-600">
                    {m.category?.name || "General"}
                  </TableCell>

                  <TableCell>
                    <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                      <Layers className="h-3 w-3 text-slate-500" />
                      {m.batches.length} {m.batches.length === 1 ? "Batch" : "Batches"}
                    </span>
                  </TableCell>

                  <TableCell>
                    <span
                      className={`font-bold ${
                        isLowStock ? "text-red-600" : "text-emerald-700"
                      }`}
                    >
                      {totalStock} {m.dispenseUnit}s
                    </span>
                  </TableCell>

                  <TableCell className="font-bold text-slate-900">
                    {formatINR(totalValuation)}
                  </TableCell>

                  <TableCell className="text-xs text-slate-600">
                    {m.minStockAlert} {m.dispenseUnit}s
                  </TableCell>

                  <TableCell>
                    <Link
                      href={`/inventory/batches?medicineId=${m.id}`}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-[#0F766E] hover:underline"
                    >
                      <span>View Batches</span>
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </AppLayout>
  );
}
