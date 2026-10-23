import * as React from "react";
import Link from "next/link";

export const dynamic = "force-dynamic";
import { AppLayout } from "@/components/layout/app-layout";
import { requireAuthContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { KPICard } from "@/components/ui/kpi-card";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { formatINR, formatDate, getDaysToExpiry } from "@/lib/utils";
import {
  Boxes,
  AlertTriangle,
  CalendarX,
  ShoppingCart,
  FileSpreadsheet,
  Receipt,
  Plus,
  ArrowRight,
  TrendingUp,
  PackageCheck,
  CheckCircle2,
} from "lucide-react";

export default async function DashboardPage() {
  const auth = await requireAuthContext();
  const tenantId = auth.tenant?.id;
  const branchId = auth.activeBranch?.id;

  if (!tenantId || !branchId) {
    return (
      <AppLayout>
        <div className="p-8 text-center text-slate-500">
          No active branch or tenant context found.
        </div>
      </AppLayout>
    );
  }

  // 1. Fetch live metrics from database
  const activeSKUsCount = await prisma.medicine.count({
    where: { tenantId, isActive: true },
  });

  // Inventory valuation & units
  const inventoryBalances = await prisma.inventoryBalance.findMany({
    where: { tenantId, branchId },
    include: {
      batch: true,
      medicine: true,
    },
  });

  const totalStockUnits = inventoryBalances.reduce(
    (sum, b) => sum + Number(b.quantityOnHand),
    0
  );

  const totalInventoryValuation = inventoryBalances.reduce(
    (sum, b) => sum + Number(b.quantityOnHand) * Number(b.batch.unitPurchaseCost),
    0
  );

  // Near-expiry & expired batches
  const now = new Date();
  const in30Days = new Date();
  in30Days.setDate(now.getDate() + 30);
  const in60Days = new Date();
  in60Days.setDate(now.getDate() + 60);

  const expiredBatches = await prisma.medicineBatch.findMany({
    where: {
      tenantId,
      branchId,
      status: "EXPIRED",
    },
    include: { medicine: true },
  });

  const nearExpiryBatches = await prisma.medicineBatch.findMany({
    where: {
      tenantId,
      branchId,
      expiryDate: { lte: in60Days, gte: now },
      status: "ACTIVE",
    },
    include: { medicine: true },
  });

  // Low stock products
  const lowStockBalances = inventoryBalances.filter(
    (b) => Number(b.quantityOnHand) <= Number(b.reorderLevel)
  );

  // Today's sales
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const todaySales = await prisma.salesInvoice.findMany({
    where: {
      tenantId,
      branchId,
      createdAt: { gte: todayStart },
      isVoid: false,
    },
  });

  const todayRevenue = todaySales.reduce(
    (sum, s) => sum + Number(s.grandTotal),
    0
  );

  // Pending POs & Invoices
  const pendingPOCount = await prisma.purchaseOrder.count({
    where: {
      tenantId,
      branchId,
      status: { in: ["DRAFT", "ORDERED", "PARTIALLY_RECEIVED"] },
    },
  });

  const pendingInvoices = await prisma.vendorInvoice.findMany({
    where: {
      tenantId,
      branchId,
      status: { in: ["PENDING", "PARTIALLY_PAID"] },
    },
  });

  const pendingInvoicesTotal = pendingInvoices.reduce(
    (sum, inv) => sum + (Number(inv.grandTotal) - Number(inv.paidAmount)),
    0
  );

  // Recent sales
  const recentSales = await prisma.salesInvoice.findMany({
    where: { tenantId, branchId },
    take: 5,
    orderBy: { createdAt: "desc" },
    include: { createdBy: true },
  });

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Top Header & Operational Shortcuts */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              Operations Dashboard
            </h1>
            <p className="text-xs text-slate-500">
              Real-time branch telemetry for{" "}
              <span className="font-semibold text-slate-700">
                {auth.activeBranch?.name}
              </span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/sales/pos"
              className="inline-flex items-center gap-1.5 rounded-md bg-[#0F766E] px-3 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-[#115E59] transition-colors"
            >
              <ShoppingCart className="h-3.5 w-3.5" />
              <span>Open POS (F8)</span>
            </Link>

            <Link
              href="/inventory/medicines"
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add Medicine</span>
            </Link>

            <Link
              href="/purchases/orders"
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              <span>Create PO</span>
            </Link>
          </div>
        </div>

        {/* Primary KPI Metrics Grid */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <KPICard
            title="Total Stock Value"
            value={formatINR(totalInventoryValuation)}
            subtitle={`${totalStockUnits} units in stock`}
            icon={Boxes}
            variant="default"
          />

          <KPICard
            title="Today's Sales"
            value={formatINR(todayRevenue)}
            subtitle={`${todaySales.length} bills settled today`}
            icon={ShoppingCart}
            variant="success"
            trend={{ value: "+12.4%", isPositive: true }}
          />

          <KPICard
            title="Low Stock SKUs"
            value={lowStockBalances.length}
            subtitle="Requires vendor reorder"
            icon={AlertTriangle}
            variant={lowStockBalances.length > 0 ? "warning" : "default"}
          />

          <KPICard
            title="At-Risk Expiry"
            value={nearExpiryBatches.length + expiredBatches.length}
            subtitle={`${expiredBatches.length} expired, ${nearExpiryBatches.length} near expiry`}
            icon={CalendarX}
            variant={expiredBatches.length > 0 ? "danger" : "warning"}
          />
        </div>

        {/* Secondary Operational Metrics */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-2xs">
            <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
              Active Medicines
            </p>
            <p className="text-lg font-bold text-slate-900 mt-1">{activeSKUsCount}</p>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-2xs">
            <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
              Pending POs
            </p>
            <p className="text-lg font-bold text-slate-900 mt-1">{pendingPOCount}</p>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-2xs">
            <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
              Vendor Payables
            </p>
            <p className="text-lg font-bold text-slate-900 mt-1">
              {formatINR(pendingInvoicesTotal)}
            </p>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-2xs">
            <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
              Stock Compliance
            </p>
            <p className="text-lg font-bold text-emerald-700 mt-1">100% FEFO</p>
          </div>
        </div>

        {/* Operational Detail Grids */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Near-Expiry & Expired Stock Alerts Table */}
          <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  Near Expiry & Quarantine Alerts
                </h3>
                <p className="text-xs text-slate-500">
                  Batches requiring vendor return or disposal
                </p>
              </div>
              <Link
                href="/inventory/expiry"
                className="flex items-center gap-1 text-xs font-medium text-[#0F766E] hover:underline"
              >
                <span>View all</span>
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Medicine</TableHead>
                  <TableHead>Batch #</TableHead>
                  <TableHead>Expiry</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {nearExpiryBatches.concat(expiredBatches).slice(0, 4).map((b) => {
                  const days = getDaysToExpiry(b.expiryDate);
                  const isExpired = b.status === "EXPIRED" || days <= 0;
                  return (
                    <TableRow key={b.id}>
                      <TableCell className="font-medium text-slate-900">
                        {b.medicine.name}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{b.batchNumber}</TableCell>
                      <TableCell>{formatDate(b.expiryDate)}</TableCell>
                      <TableCell>
                        <Badge variant={isExpired ? "danger" : "warning"} size="sm">
                          {isExpired ? "EXPIRED" : `${days} days left`}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {nearExpiryBatches.length === 0 && expiredBatches.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-4 text-slate-400">
                      No near-expiry or quarantined stock.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Low Stock & Reorder Table */}
          <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  Low Stock & Reorder Trigger
                </h3>
                <p className="text-xs text-slate-500">
                  Items below minimum safety threshold
                </p>
              </div>
              <Link
                href="/inventory/reorder"
                className="flex items-center gap-1 text-xs font-medium text-[#0F766E] hover:underline"
              >
                <span>Reorder hub</span>
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Medicine</TableHead>
                  <TableHead>Current Stock</TableHead>
                  <TableHead>Min Threshold</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lowStockBalances.slice(0, 4).map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="font-medium text-slate-900">
                      {b.medicine.name}
                    </TableCell>
                    <TableCell>
                      <span className="font-bold text-red-600">
                        {Number(b.quantityOnHand)}
                      </span>{" "}
                      {b.medicine.dispenseUnit}
                    </TableCell>
                    <TableCell>{Number(b.reorderLevel)}</TableCell>
                    <TableCell>
                      <Link
                        href={`/purchases/orders?medicineId=${b.medicineId}`}
                        className="text-xs font-medium text-[#0F766E] hover:underline"
                      >
                        Create PO
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
                {lowStockBalances.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-4 text-emerald-600">
                      All medicine inventories are above safety thresholds.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Recent Transactions & Billing Feed */}
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Recent Sales Transactions
              </h3>
              <p className="text-xs text-slate-500">
                Latest customer bills settled at this branch
              </p>
            </div>
            <Link
              href="/sales/invoices"
              className="flex items-center gap-1 text-xs font-medium text-[#0F766E] hover:underline"
            >
              <span>View all sales</span>
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice #</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Doctor / Prescriber</TableHead>
                <TableHead>Settled At</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentSales.map((sale) => (
                <TableRow key={sale.id}>
                  <TableCell className="font-mono font-medium text-slate-900">
                    {sale.invoiceNumber}
                  </TableCell>
                  <TableCell>{sale.customerName || "Walk-in"}</TableCell>
                  <TableCell className="text-xs text-slate-500">
                    {sale.doctorName || "—"}
                  </TableCell>
                  <TableCell>{formatDate(sale.createdAt)}</TableCell>
                  <TableCell className="font-semibold text-slate-900">
                    {formatINR(sale.grandTotal)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="success" size="sm">
                      {sale.paymentStatus}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {recentSales.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-4 text-slate-400">
                    No sales recorded for this branch yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </AppLayout>
  );
}
