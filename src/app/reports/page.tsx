import * as React from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { requireAuthContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ReportsClient } from "./reports-client";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const auth = await requireAuthContext();
  const tenantId = auth.tenant?.id;
  const branchId = auth.activeBranch?.id;

  if (!tenantId || !branchId) {
    return <AppLayout><div>Unauthorized</div></AppLayout>;
  }

  // 1. Stock Valuation Data
  const inventoryBalances = await prisma.inventoryBalance.findMany({
    where: { tenantId, branchId },
    include: {
      medicine: { include: { category: true } },
      batch: true,
    },
    orderBy: { medicine: { name: "asc" } },
  });

  // 2. Sales & Margin Data
  const salesInvoices = await prisma.salesInvoice.findMany({
    where: { tenantId, branchId, isVoid: false },
    include: {
      lines: {
        include: {
          medicine: true,
          batch: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // 3. Stock Movement Ledger Data
  const ledgerEntries = await prisma.stockLedgerEntry.findMany({
    where: { tenantId, branchId },
    include: {
      medicine: true,
      batch: true,
      createdByUser: true,
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  // 4. Vendor Outstanding Balances
  const vendors = await prisma.vendor.findMany({
    where: { tenantId },
    orderBy: { outstandingBalance: "desc" },
  });

  return (
    <AppLayout>
      <ReportsClient
        branchName={auth.activeBranch?.name || "Current Branch"}
        stockBalances={inventoryBalances.map((ib) => ({
          medicineName: ib.medicine.name,
          sku: ib.medicine.sku,
          categoryName: ib.medicine.category?.name || "General",
          batchNumber: ib.batch.batchNumber,
          expiryDate: ib.batch.expiryDate.toISOString(),
          quantityOnHand: Number(ib.quantityOnHand),
          unitPurchaseCost: Number(ib.batch.unitPurchaseCost),
          mrp: Number(ib.batch.mrp),
          totalCost: Number(ib.quantityOnHand) * Number(ib.batch.unitPurchaseCost),
          totalRetailValue: Number(ib.quantityOnHand) * Number(ib.batch.mrp),
        }))}
        salesRecords={salesInvoices.map((inv) => {
          const revenue = Number(inv.grandTotal);
          const totalCost = inv.lines.reduce(
            (sum, l) => sum + Number(l.quantity) * Number(l.batch.unitPurchaseCost),
            0
          );
          const grossMargin = revenue - totalCost;
          const marginPercent = revenue > 0 ? (grossMargin / revenue) * 100 : 0;

          return {
            invoiceNumber: inv.invoiceNumber,
            date: inv.createdAt.toISOString(),
            customerName: inv.customerName || "Walk-in",
            taxableAmount: Number(inv.taxableAmount),
            cgstAmount: Number(inv.cgstAmount),
            sgstAmount: Number(inv.sgstAmount),
            revenue,
            totalCost,
            grossMargin,
            marginPercent,
          };
        })}
        ledgerEntries={ledgerEntries.map((l) => ({
          timestamp: l.createdAt.toISOString(),
          medicineName: l.medicine.name,
          batchNumber: l.batch.batchNumber,
          movementType: l.movementType,
          quantityDelta: Number(l.quantityDelta),
          balanceAfter: Number(l.balanceAfter),
          costPerUnit: Number(l.costPerUnit),
          referenceType: l.referenceType,
          referenceId: l.referenceId || "—",
          notes: l.notes || "—",
          actorName: l.createdByUser?.fullName || "System",
        }))}
        vendors={vendors.map((v) => ({
          id: v.id,
          name: v.name,
          code: v.code,
          phone: v.phone,
          gstin: v.gstin || "—",
          paymentTermsDays: v.paymentTermsDays,
          outstandingBalance: Number(v.outstandingBalance),
          status: v.status,
        }))}
      />
    </AppLayout>
  );
}
