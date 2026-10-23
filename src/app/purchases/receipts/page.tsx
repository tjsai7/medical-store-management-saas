import * as React from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { requireAuthContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ReceiptsClient } from "./receipts-client";

export const dynamic = "force-dynamic";

export default async function GoodsReceiptsPage() {
  const auth = await requireAuthContext();
  const tenantId = auth.tenant?.id;
  const branchId = auth.activeBranch?.id;

  if (!tenantId || !branchId) {
    return <AppLayout><div>Unauthorized</div></AppLayout>;
  }

  const [receipts, vendors, medicines, pendingPOs] = await Promise.all([
    prisma.goodsReceipt.findMany({
      where: { tenantId, branchId },
      include: {
        vendor: true,
        receivedBy: true,
        purchaseOrder: true,
        lines: { include: { medicine: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.vendor.findMany({
      where: { tenantId, status: "ACTIVE" },
      orderBy: { name: "asc" },
    }),
    prisma.medicine.findMany({
      where: { tenantId, isActive: true },
      orderBy: { name: "asc" },
    }),
    prisma.purchaseOrder.findMany({
      where: {
        tenantId,
        branchId,
        status: { in: ["ORDERED", "PARTIALLY_RECEIVED"] },
      },
      include: { vendor: true, lines: { include: { medicine: true } } },
    }),
  ]);

  return (
    <AppLayout>
      <ReceiptsClient
        initialReceipts={receipts.map((r) => ({
          id: r.id,
          grnNumber: r.grnNumber,
          vendorName: r.vendor.name,
          poNumber: r.purchaseOrder?.poNumber || "Direct Receipt",
          supplierChallan: r.supplierChallan || "—",
          receiptDate: r.receiptDate.toISOString(),
          receivedByName: r.receivedBy.fullName,
          status: r.status,
          lines: r.lines.map((l) => ({
            id: l.id,
            medicineName: l.medicine.name,
            batchNumber: l.batchNumber,
            expiryDate: l.expiryDate.toISOString(),
            quantity: Number(l.quantity),
            freeQuantity: Number(l.freeQuantity),
            unitPurchaseCost: Number(l.unitPurchaseCost),
            mrp: Number(l.mrp),
          })),
        }))}
        vendors={vendors.map((v) => ({ id: v.id, name: v.name, code: v.code }))}
        medicines={medicines.map((m) => ({
          id: m.id,
          name: m.name,
          sku: m.sku,
          dispenseUnit: m.dispenseUnit,
          purchasePrice: Number(m.purchasePrice),
          mrp: Number(m.mrp),
          gstRate: Number(m.gstRate),
        }))}
        pendingPOs={pendingPOs.map((p) => ({
          id: p.id,
          poNumber: p.poNumber,
          vendorId: p.vendorId,
          vendorName: p.vendor.name,
          lines: p.lines.map((l) => ({
            medicineId: l.medicineId,
            medicineName: l.medicine.name,
            quantity: Number(l.quantity),
            unitCost: Number(l.unitCost),
            gstRate: Number(l.gstRate),
          })),
        }))}
      />
    </AppLayout>
  );
}
