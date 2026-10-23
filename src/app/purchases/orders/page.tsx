import * as React from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { requireAuthContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { OrdersClient } from "./orders-client";

export const dynamic = "force-dynamic";

export default async function PurchaseOrdersPage() {
  const auth = await requireAuthContext();
  const tenantId = auth.tenant?.id;
  const branchId = auth.activeBranch?.id;

  if (!tenantId || !branchId) {
    return <AppLayout><div>Unauthorized</div></AppLayout>;
  }

  const [orders, vendors, medicines] = await Promise.all([
    prisma.purchaseOrder.findMany({
      where: { tenantId, branchId },
      include: {
        vendor: true,
        createdBy: true,
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
  ]);

  return (
    <AppLayout>
      <OrdersClient
        initialOrders={orders.map((o) => ({
          id: o.id,
          poNumber: o.poNumber,
          vendorId: o.vendor.id,
          vendorName: o.vendor.name,
          expectedDate: o.expectedDate ? o.expectedDate.toISOString() : null,
          status: o.status,
          subtotal: Number(o.subtotal),
          taxAmount: Number(o.taxAmount),
          discountAmount: Number(o.discountAmount),
          grandTotal: Number(o.grandTotal),
          notes: o.notes || "—",
          createdByName: o.createdBy.fullName,
          createdAt: o.createdAt.toISOString(),
          lineCount: o.lines.length,
          lines: o.lines.map((l) => ({
            id: l.id,
            medicineName: l.medicine.name,
            quantity: Number(l.quantity),
            unitCost: Number(l.unitCost),
            lineTotal: Number(l.lineTotal),
          })),
        }))}
        vendors={vendors.map((v) => ({ id: v.id, name: v.name, code: v.code }))}
        medicines={medicines.map((m) => ({
          id: m.id,
          name: m.name,
          sku: m.sku,
          dispenseUnit: m.dispenseUnit,
          purchasePrice: Number(m.purchasePrice),
          gstRate: Number(m.gstRate),
        }))}
      />
    </AppLayout>
  );
}
