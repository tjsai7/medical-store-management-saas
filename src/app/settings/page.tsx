import * as React from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { requireAuthContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SettingsClient } from "./settings-client";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const auth = await requireAuthContext();
  const tenantId = auth.tenant?.id;
  const branchId = auth.activeBranch?.id;

  if (!tenantId) {
    return <AppLayout><div>Unauthorized</div></AppLayout>;
  }

  const [businessSettings, branchSettings, tenant] = await Promise.all([
    prisma.businessSettings.findUnique({
      where: { tenantId },
    }),
    branchId
      ? prisma.branchSettings.findUnique({
          where: { branchId },
        })
      : null,
    prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        plan: true,
        _count: { select: { branches: true, users: true } },
      },
    }),
  ]);

  return (
    <AppLayout>
      <SettingsClient
        initialSettings={{
          legalName: businessSettings?.legalName || tenant?.legalName || "Apex MedCare Retail & Healthcare Pvt Ltd",
          tradeName: businessSettings?.tradeName || tenant?.name || "Apex MedCare Pharmacy",
          contactPhone: businessSettings?.contactPhone || "+91 40 2345 6789",
          contactEmail: businessSettings?.contactEmail || "contact@apexmedcare.com",
          address: businessSettings?.address || "Plot 42, Road No 36, Jubilee Hills",
          state: businessSettings?.state || "Telangana",
          gstin: businessSettings?.gstin || tenant?.gstin || "36AAACA1234A1Z5",
          drugLicense20B: businessSettings?.drugLicense20B || "TG/HYD/20B/10492",
          drugLicense21B: businessSettings?.drugLicense21B || "TG/HYD/21B/10493",
          nearExpiryDays: businessSettings?.nearExpiryDays || 60,
          invoicePrefix: branchSettings?.invoicePrefix || "INV-JH-",
          receiptHeader: branchSettings?.receiptHeader || "Apex MedCare Pharmacy\nPh: 040-23456789",
          receiptFooter: branchSettings?.receiptFooter || "Thank you! Please consult your doctor for dosage.",
        }}
        subscription={{
          planName: tenant?.plan?.name || "Pharmacy Chain Pro",
          branchCount: tenant?._count.branches || 2,
          maxBranches: tenant?.plan?.maxBranches || 5,
          userCount: tenant?._count.users || 3,
          maxUsers: tenant?.plan?.maxUsers || 15,
          priceInr: Number(tenant?.plan?.priceInr || 4999),
        }}
      />
    </AppLayout>
  );
}
