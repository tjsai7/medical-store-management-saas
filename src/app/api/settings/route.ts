import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthContext } from "@/lib/auth";

export async function GET() {
  try {
    const auth = await getAuthContext();
    if (!auth || !auth.tenant) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [businessSettings, branchSettings] = await Promise.all([
      prisma.businessSettings.findUnique({
        where: { tenantId: auth.tenant.id },
      }),
      auth.activeBranch
        ? prisma.branchSettings.findUnique({
            where: { branchId: auth.activeBranch.id },
          })
        : null,
    ]);

    return NextResponse.json({ businessSettings, branchSettings });
  } catch (error) {
    console.error("Fetch settings error:", error);
    return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const auth = await getAuthContext();
    if (!auth || !auth.tenant) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const {
      legalName,
      tradeName,
      contactPhone,
      contactEmail,
      address,
      state,
      gstin,
      drugLicense20B,
      drugLicense21B,
      nearExpiryDays = 60,
      invoicePrefix,
      receiptHeader,
      receiptFooter,
    } = await req.json();

    // Update BusinessSettings
    const updatedBusiness = await prisma.businessSettings.upsert({
      where: { tenantId: auth.tenant.id },
      update: {
        legalName,
        tradeName,
        contactPhone,
        contactEmail,
        address,
        state,
        gstin,
        drugLicense20B,
        drugLicense21B,
        nearExpiryDays: Number(nearExpiryDays),
      },
      create: {
        tenantId: auth.tenant.id,
        legalName: legalName || auth.tenant.legalName,
        tradeName: tradeName || auth.tenant.name,
        contactPhone: contactPhone || "+91 40 2345 6789",
        contactEmail,
        address,
        state: state || "Telangana",
        gstin,
        drugLicense20B,
        drugLicense21B,
        nearExpiryDays: Number(nearExpiryDays),
      },
    });

    // Update BranchSettings if active branch exists
    if (auth.activeBranch && (invoicePrefix || receiptHeader || receiptFooter)) {
      await prisma.branchSettings.upsert({
        where: { branchId: auth.activeBranch.id },
        update: {
          invoicePrefix,
          receiptHeader,
          receiptFooter,
        },
        create: {
          branchId: auth.activeBranch.id,
          invoicePrefix: invoicePrefix || "INV-",
          receiptHeader,
          receiptFooter,
        },
      });
    }

    // Record audit
    await prisma.auditLog.create({
      data: {
        tenantId: auth.tenant.id,
        userId: auth.user.id,
        action: "UPDATE",
        entityType: "SETTINGS",
        entityId: updatedBusiness.id,
        details: JSON.stringify({ legalName, tradeName }),
      },
    });

    return NextResponse.json({ success: true, settings: updatedBusiness });
  } catch (error) {
    console.error("Update settings error:", error);
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
  }
}
