import * as React from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { requireAuthContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BranchesClient } from "./branches-client";

export const dynamic = "force-dynamic";

export default async function BranchesPage() {
  const auth = await requireAuthContext();
  const tenantId = auth.tenant?.id;

  if (!tenantId) {
    return <AppLayout><div>Unauthorized</div></AppLayout>;
  }

  const [branches, tenantWithPlan] = await Promise.all([
    prisma.branch.findMany({
      where: { tenantId },
      include: {
        _count: {
          select: { userAccesses: true, inventoryBalances: true, salesInvoices: true },
        },
      },
      orderBy: { isMainBranch: "desc" },
    }),
    prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { plan: true },
    }),
  ]);

  return (
    <AppLayout>
      <BranchesClient
        initialBranches={branches.map((b) => ({
          id: b.id,
          name: b.name,
          code: b.code,
          address: b.address || "—",
          city: b.city || "Hyderabad",
          state: b.state || "Telangana",
          phone: b.phone || "—",
          email: b.email || "—",
          gstin: b.gstin || "—",
          dlNumber: b.dlNumber || "—",
          isMainBranch: b.isMainBranch,
          staffCount: b._count.userAccesses,
          salesCount: b._count.salesInvoices,
          isActive: b.isActive,
        }))}
        planLimits={{
          planName: tenantWithPlan?.plan?.name || "Pro Plan",
          maxBranches: tenantWithPlan?.plan?.maxBranches || 5,
          currentBranches: branches.length,
        }}
      />
    </AppLayout>
  );
}
