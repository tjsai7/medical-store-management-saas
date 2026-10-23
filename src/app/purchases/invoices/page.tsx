import * as React from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { requireAuthContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { InvoicesClient } from "./invoices-client";

export const dynamic = "force-dynamic";

export default async function VendorInvoicesPage() {
  const auth = await requireAuthContext();
  const tenantId = auth.tenant?.id;
  const branchId = auth.activeBranch?.id;

  if (!tenantId || !branchId) {
    return <AppLayout><div>Unauthorized</div></AppLayout>;
  }

  const [invoices, vendors, pendingGRNs] = await Promise.all([
    prisma.vendorInvoice.findMany({
      where: { tenantId, branchId },
      include: {
        vendor: true,
        goodsReceipt: true,
        purchaseOrder: true,
      },
      orderBy: { invoiceDate: "desc" },
    }),
    prisma.vendor.findMany({
      where: { tenantId, status: "ACTIVE" },
      orderBy: { name: "asc" },
    }),
    prisma.goodsReceipt.findMany({
      where: { tenantId, branchId },
      include: { vendor: true },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  return (
    <AppLayout>
      <InvoicesClient
        initialInvoices={invoices.map((inv) => ({
          id: inv.id,
          invoiceNumber: inv.invoiceNumber,
          vendorName: inv.vendor.name,
          vendorCode: inv.vendor.code,
          poNumber: inv.purchaseOrder?.poNumber || "—",
          grnNumber: inv.goodsReceipt?.grnNumber || "—",
          invoiceDate: inv.invoiceDate.toISOString(),
          dueDate: inv.dueDate.toISOString(),
          subtotal: Number(inv.subtotal),
          taxAmount: Number(inv.taxAmount),
          grandTotal: Number(inv.grandTotal),
          paidAmount: Number(inv.paidAmount),
          status: inv.status,
        }))}
        vendors={vendors.map((v) => ({ id: v.id, name: v.name, code: v.code }))}
        pendingGRNs={pendingGRNs.map((g) => ({
          id: g.id,
          grnNumber: g.grnNumber,
          vendorId: g.vendorId,
          vendorName: g.vendor.name,
        }))}
      />
    </AppLayout>
  );
}
