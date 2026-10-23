import * as React from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { requireAuthContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ExpiryClient } from "./expiry-client";

export const dynamic = "force-dynamic";

export default async function ExpiryPage() {
  const auth = await requireAuthContext();
  const tenantId = auth.tenant?.id;
  const branchId = auth.activeBranch?.id;

  if (!tenantId || !branchId) {
    return <AppLayout><div>Unauthorized</div></AppLayout>;
  }

  const batches = await prisma.medicineBatch.findMany({
    where: { tenantId, branchId },
    include: {
      medicine: { include: { category: true } },
      supplier: true,
      inventoryBalances: {
        where: { branchId },
      },
    },
    orderBy: { expiryDate: "asc" },
  });

  return (
    <AppLayout>
      <ExpiryClient
        initialBatches={batches.map((b) => ({
          id: b.id,
          batchNumber: b.batchNumber,
          medicineId: b.medicine.id,
          medicineName: b.medicine.name,
          categoryName: b.medicine.category?.name || "General",
          dispenseUnit: b.medicine.dispenseUnit,
          expiryDate: b.expiryDate.toISOString(),
          unitPurchaseCost: Number(b.unitPurchaseCost),
          mrp: Number(b.mrp),
          status: b.status,
          supplierName: b.supplier?.name || "Direct Supplier",
          quantityAvailable: Number(b.inventoryBalances[0]?.quantityOnHand || 0),
        }))}
      />
    </AppLayout>
  );
}
