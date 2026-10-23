import * as React from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { requireAuthContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { VendorsClient } from "./vendors-client";

export const dynamic = "force-dynamic";

export default async function VendorsPage() {
  const auth = await requireAuthContext();
  const tenantId = auth.tenant?.id;

  if (!tenantId) {
    return <AppLayout><div>Unauthorized</div></AppLayout>;
  }

  const vendors = await prisma.vendor.findMany({
    where: { tenantId },
    include: {
      _count: { select: { purchaseOrders: true, vendorInvoices: true } },
    },
    orderBy: { name: "asc" },
  });

  return (
    <AppLayout>
      <VendorsClient
        initialVendors={vendors.map((v) => ({
          id: v.id,
          name: v.name,
          code: v.code,
          contactPerson: v.contactPerson || "—",
          phone: v.phone,
          email: v.email || "—",
          city: v.city || "Hyderabad",
          state: v.state || "Telangana",
          gstin: v.gstin || "—",
          dlNumber: v.dlNumber || "—",
          paymentTermsDays: v.paymentTermsDays,
          outstandingBalance: Number(v.outstandingBalance),
          poCount: v._count.purchaseOrders,
          invoiceCount: v._count.vendorInvoices,
          status: v.status,
        }))}
      />
    </AppLayout>
  );
}
