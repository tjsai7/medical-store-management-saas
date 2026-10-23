import * as React from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { requireAuthContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { MedicinesClient } from "./medicines-client";

export const dynamic = "force-dynamic";

export default async function MedicinesPage() {
  const auth = await requireAuthContext();
  const tenantId = auth.tenant?.id;

  if (!tenantId) {
    return <AppLayout><div>Unauthorized</div></AppLayout>;
  }

  const [medicines, categories] = await Promise.all([
    prisma.medicine.findMany({
      where: { tenantId },
      include: {
        category: true,
        batches: {
          where: auth.activeBranch ? { branchId: auth.activeBranch.id } : undefined,
          include: { inventoryBalances: true },
        },
      },
      orderBy: { name: "asc" },
    }),
    prisma.medicineCategory.findMany({
      where: { tenantId },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <AppLayout>
      <MedicinesClient
        initialMedicines={medicines.map((m) => ({
          id: m.id,
          name: m.name,
          genericName: m.genericName,
          brand: m.brand,
          manufacturer: m.manufacturer,
          sku: m.sku,
          barcode: m.barcode,
          hsnCode: m.hsnCode,
          categoryName: m.category?.name || "Uncategorized",
          dosageForm: m.dosageForm,
          packUnit: m.packUnit,
          dispenseUnit: m.dispenseUnit,
          conversionFactor: m.conversionFactor,
          drugSchedule: m.drugSchedule,
          prescriptionRequired: m.prescriptionRequired,
          gstRate: Number(m.gstRate),
          mrp: Number(m.mrp),
          salePrice: Number(m.salePrice),
          purchasePrice: Number(m.purchasePrice),
          minStockAlert: m.minStockAlert,
          reorderQty: m.reorderQty,
          isActive: m.isActive,
          currentStock: m.batches.reduce(
            (sum, b) =>
              sum +
              b.inventoryBalances.reduce(
                (bSum, ib) => bSum + Number(ib.quantityOnHand),
                0
              ),
            0
          ),
        }))}
        categories={categories.map((c) => ({ id: c.id, name: c.name }))}
      />
    </AppLayout>
  );
}
