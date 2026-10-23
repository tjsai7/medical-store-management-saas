import * as React from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { requireAuthContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AdjustmentsClient } from "./adjustments-client";

export const dynamic = "force-dynamic";

export default async function AdjustmentsPage() {
  const auth = await requireAuthContext();
  const tenantId = auth.tenant?.id;
  const branchId = auth.activeBranch?.id;

  if (!tenantId || !branchId) {
    return <AppLayout><div>Unauthorized</div></AppLayout>;
  }

  const [adjustments, ledgerEntries, activeBatches] = await Promise.all([
    prisma.stockAdjustment.findMany({
      where: { tenantId, branchId },
      include: { createdBy: true },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.stockLedgerEntry.findMany({
      where: {
        tenantId,
        branchId,
        movementType: { in: ["ADJUSTMENT_POSITIVE", "ADJUSTMENT_NEGATIVE", "DAMAGE_EXPIRY_WRITEOFF"] },
      },
      include: {
        medicine: true,
        batch: true,
        createdByUser: true,
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.medicineBatch.findMany({
      where: { tenantId, branchId, status: { not: "DEPLETED" } },
      include: {
        medicine: true,
        inventoryBalances: { where: { branchId } },
      },
      orderBy: { medicine: { name: "asc" } },
    }),
  ]);

  return (
    <AppLayout>
      <AdjustmentsClient
        initialAdjustments={adjustments.map((a) => ({
          id: a.id,
          adjustmentNumber: a.adjustmentNumber,
          adjustmentDate: a.adjustmentDate.toISOString(),
          reason: a.reason,
          totalAmount: Number(a.totalAmount),
          createdByName: a.createdBy.fullName,
        }))}
        initialLedgerEntries={ledgerEntries.map((l) => ({
          id: l.id,
          medicineName: l.medicine.name,
          batchNumber: l.batch.batchNumber,
          movementType: l.movementType,
          quantityDelta: Number(l.quantityDelta),
          balanceAfter: Number(l.balanceAfter),
          costPerUnit: Number(l.costPerUnit),
          referenceId: l.referenceId || "—",
          notes: l.notes || "—",
          createdByName: l.createdByUser?.fullName || "System",
          createdAt: l.createdAt.toISOString(),
        }))}
        batches={activeBatches.map((b) => ({
          id: b.id,
          batchNumber: b.batchNumber,
          medicineName: b.medicine.name,
          dispenseUnit: b.medicine.dispenseUnit,
          unitCost: Number(b.unitPurchaseCost),
          quantityOnHand: Number(b.inventoryBalances[0]?.quantityOnHand || 0),
        }))}
      />
    </AppLayout>
  );
}
