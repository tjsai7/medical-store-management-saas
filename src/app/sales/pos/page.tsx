import * as React from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { requireAuthContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PosClient } from "./pos-client";

export const dynamic = "force-dynamic";

export default async function PosPage() {
  const auth = await requireAuthContext();
  const tenantId = auth.tenant?.id;
  const branchId = auth.activeBranch?.id;

  if (!tenantId || !branchId) {
    return <AppLayout><div>Unauthorized</div></AppLayout>;
  }

  // Fetch medicines and their eligible batches for this branch
  const medicines = await prisma.medicine.findMany({
    where: { tenantId, isActive: true },
    include: {
      category: true,
      batches: {
        where: {
          branchId,
          status: { in: ["ACTIVE", "EXPIRED", "QUARANTINED"] },
        },
        include: {
          inventoryBalances: { where: { branchId } },
        },
        orderBy: { expiryDate: "asc" },
      },
    },
    orderBy: { name: "asc" },
  });

  const branchSettings = await prisma.branchSettings.findUnique({
    where: { branchId },
  });

  return (
    <AppLayout>
      <PosClient
        medicines={medicines.map((m) => ({
          id: m.id,
          name: m.name,
          genericName: m.genericName,
          sku: m.sku,
          barcode: m.barcode,
          hsnCode: m.hsnCode,
          dispenseUnit: m.dispenseUnit,
          dosageForm: m.dosageForm,
          drugSchedule: m.drugSchedule,
          prescriptionRequired: m.prescriptionRequired,
          gstRate: Number(m.gstRate),
          salePrice: Number(m.salePrice),
          mrp: Number(m.mrp),
          batches: m.batches.map((b) => ({
            id: b.id,
            batchNumber: b.batchNumber,
            expiryDate: b.expiryDate.toISOString(),
            status: b.status,
            mrp: Number(b.mrp),
            unitSalePrice: Number(b.unitSalePrice),
            quantityOnHand: Number(b.inventoryBalances[0]?.quantityOnHand || 0),
          })),
        }))}
        branchDetails={{
          name: auth.activeBranch?.name || "Main Store",
          code: auth.activeBranch?.code || "BR-01",
          gstin: auth.tenant?.gstin || "36AAACA1234A1Z5",
          receiptHeader: branchSettings?.receiptHeader || "PharmaPulse Pharmacy\nPh: 040-23456789",
          receiptFooter: branchSettings?.receiptFooter || "Thank you! Get well soon.",
        }}
      />
    </AppLayout>
  );
}
