import * as React from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { requireAuthContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BatchesClient } from "./batches-client";

export const dynamic = "force-dynamic";

export default async function BatchesPage() {
  const auth = await requireAuthContext();
  const tenantId = auth.tenant?.id;
  const branchId = auth.activeBranch?.id;

  if (!tenantId || !branchId) {
    return <AppLayout><div>Unauthorized</div></AppLayout>;
  }

  const batches = await prisma.medicineBatch.findMany({
    where: { tenantId, branchId },
    include: {
      medicine: true,
      supplier: true,
      inventoryBalances: {
        where: { branchId },
      },
    },
    orderBy: { expiryDate: "asc" },
  });

  return (
    <AppLayout>
      <BatchesClient
        initialBatches={batches.map((b) => ({
          id: b.id,
          batchNumber: b.batchNumber,
          medicineName: b.medicine.name,
          medicineSku: b.medicine.sku,
          dispenseUnit: b.medicine.dispenseUnit,
          expiryDate: b.expiryDate.toISOString(),
          mrp: Number(b.mrp),
          unitSalePrice: Number(b.unitSalePrice),
          unitPurchaseCost: Number(b.unitPurchaseCost),
          status: b.status,
          supplierName: b.supplier?.name || "Direct Supplier",
          quantityAvailable: Number(b.inventoryBalances[0]?.quantityOnHand || 0),
        }))}
      />
    </AppLayout>
  );
}
