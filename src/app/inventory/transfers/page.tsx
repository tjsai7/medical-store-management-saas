import * as React from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { requireAuthContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TransfersClient } from "./transfers-client";

export const dynamic = "force-dynamic";

export default async function TransfersPage() {
  const auth = await requireAuthContext();
  const tenantId = auth.tenant?.id;
  const currentBranchId = auth.activeBranch?.id;

  if (!tenantId || !currentBranchId) {
    return <AppLayout><div>Unauthorized</div></AppLayout>;
  }

  const [transfers, allBranches, originBatches] = await Promise.all([
    prisma.stockTransfer.findMany({
      where: {
        tenantId,
        OR: [{ originBranchId: currentBranchId }, { destBranchId: currentBranchId }],
      },
      include: {
        originBranch: true,
        destBranch: true,
        sentByUser: true,
        receivedByUser: true,
        lines: { include: { medicine: true, batch: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.branch.findMany({
      where: { tenantId, isActive: true },
      orderBy: { name: "asc" },
    }),
    prisma.medicineBatch.findMany({
      where: {
        tenantId,
        branchId: currentBranchId,
        status: "ACTIVE",
      },
      include: {
        medicine: true,
        inventoryBalances: { where: { branchId: currentBranchId } },
      },
      orderBy: { medicine: { name: "asc" } },
    }),
  ]);

  return (
    <AppLayout>
      <TransfersClient
        currentBranchId={currentBranchId}
        initialTransfers={transfers.map((t) => ({
          id: t.id,
          transferNumber: t.transferNumber,
          originBranchId: t.originBranchId,
          originBranchName: t.originBranch.name,
          destBranchId: t.destBranchId,
          destBranchName: t.destBranch.name,
          status: t.status,
          notes: t.notes || "—",
          sentByName: t.sentByUser?.fullName || "System",
          sentAt: t.sentAt ? t.sentAt.toISOString() : t.createdAt.toISOString(),
          receivedByName: t.receivedByUser?.fullName || null,
          receivedAt: t.receivedAt ? t.receivedAt.toISOString() : null,
          lineCount: t.lines.length,
          lines: t.lines.map((l) => ({
            id: l.id,
            medicineName: l.medicine.name,
            batchNumber: l.batch.batchNumber,
            quantity: Number(l.quantity),
          })),
        }))}
        branches={allBranches.map((b) => ({ id: b.id, name: b.name, code: b.code }))}
        originBatches={originBatches
          .filter((b) => Number(b.inventoryBalances[0]?.quantityOnHand || 0) > 0)
          .map((b) => ({
            id: b.id,
            medicineId: b.medicineId,
            medicineName: b.medicine.name,
            batchNumber: b.batchNumber,
            dispenseUnit: b.medicine.dispenseUnit,
            quantityOnHand: Number(b.inventoryBalances[0]?.quantityOnHand || 0),
          }))}
      />
    </AppLayout>
  );
}
