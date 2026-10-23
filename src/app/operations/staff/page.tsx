import * as React from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { requireAuthContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { StaffClient } from "./staff-client";

export const dynamic = "force-dynamic";

export default async function StaffPage() {
  const auth = await requireAuthContext();
  const tenantId = auth.tenant?.id;

  if (!tenantId) {
    return <AppLayout><div>Unauthorized</div></AppLayout>;
  }

  const [staff, branches, roles] = await Promise.all([
    prisma.user.findMany({
      where: { tenantId },
      include: {
        branchAccesses: {
          include: { branch: true, role: true },
        },
      },
      orderBy: { fullName: "asc" },
    }),
    prisma.branch.findMany({
      where: { tenantId, isActive: true },
      orderBy: { name: "asc" },
    }),
    prisma.role.findMany({
      where: { tenantId },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <AppLayout>
      <StaffClient
        initialStaff={staff.map((u) => ({
          id: u.id,
          fullName: u.fullName,
          email: u.email,
          phone: u.phone || "—",
          status: u.status,
          createdAt: u.createdAt.toISOString(),
          assignments: u.branchAccesses.map((ba) => ({
            branchName: ba.branch.name,
            branchCode: ba.branch.code,
            roleName: ba.role.name,
            roleCode: ba.role.code,
          })),
        }))}
        branches={branches.map((b) => ({ id: b.id, name: b.name, code: b.code }))}
        roles={roles.map((r) => ({ id: r.id, name: r.name, code: r.code }))}
      />
    </AppLayout>
  );
}
