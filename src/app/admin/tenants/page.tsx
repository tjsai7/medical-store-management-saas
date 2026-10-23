import * as React from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { requireAuthContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TenantsClient } from "./tenants-client";

export const dynamic = "force-dynamic";

export default async function AdminTenantsPage() {
  const auth = await requireAuthContext();

  if (!auth.user.isPlatformAdmin) {
    return (
      <AppLayout>
        <div className="p-8 text-center text-red-600 font-bold">
          403 Forbidden: Platform Super Admin credentials required.
        </div>
      </AppLayout>
    );
  }

  const [tenants, plans] = await Promise.all([
    prisma.tenant.findMany({
      include: {
        plan: true,
        _count: {
          select: { branches: true, users: true, medicines: true, salesInvoices: true },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.subscriptionPlan.findMany({
      orderBy: { priceInr: "asc" },
    }),
  ]);

  return (
    <AppLayout>
      <TenantsClient
        initialTenants={tenants.map((t) => ({
          id: t.id,
          name: t.name,
          slug: t.slug,
          legalName: t.legalName,
          gstin: t.gstin || "—",
          status: t.status,
          planName: t.plan?.name || "Free Trial",
          planId: t.planId,
          branchesCount: t._count.branches,
          usersCount: t._count.users,
          medicinesCount: t._count.medicines,
          salesCount: t._count.salesInvoices,
          createdAt: t.createdAt.toISOString(),
        }))}
        plans={plans.map((p) => ({
          id: p.id,
          name: p.name,
          code: p.code,
          priceInr: Number(p.priceInr),
        }))}
      />
    </AppLayout>
  );
}
