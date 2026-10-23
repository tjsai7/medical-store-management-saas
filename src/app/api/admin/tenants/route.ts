import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthContext } from "@/lib/auth";
import { TenantStatus } from "@prisma/client";

export async function GET() {
  try {
    const auth = await getAuthContext();
    if (!auth || !auth.user.isPlatformAdmin) {
      return NextResponse.json({ error: "Unauthorized: Super Admin access required." }, { status: 403 });
    }

    const tenants = await prisma.tenant.findMany({
      include: {
        plan: true,
        _count: {
          select: { branches: true, users: true, medicines: true, salesInvoices: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const plans = await prisma.subscriptionPlan.findMany({
      orderBy: { priceInr: "asc" },
    });

    return NextResponse.json({ tenants, plans });
  } catch (error) {
    console.error("Fetch tenants error:", error);
    return NextResponse.json({ error: "Failed to fetch platform tenants" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const auth = await getAuthContext();
    if (!auth || !auth.user.isPlatformAdmin) {
      return NextResponse.json({ error: "Unauthorized: Super Admin access required." }, { status: 403 });
    }

    const { name, slug, legalName, gstin, planId } = await req.json();

    if (!name || !slug || !legalName) {
      return NextResponse.json(
        { error: "Tenant name, slug, and legal name are required." },
        { status: 400 }
      );
    }

    // Check slug uniqueness
    const existing = await prisma.tenant.findUnique({
      where: { slug: slug.trim().toLowerCase() },
    });

    if (existing) {
      return NextResponse.json(
        { error: `Tenant slug "${slug}" already exists.` },
        { status: 409 }
      );
    }

    const tenant = await prisma.tenant.create({
      data: {
        name: name.trim(),
        slug: slug.trim().toLowerCase(),
        legalName: legalName.trim(),
        gstin: gstin?.trim() || null,
        status: TenantStatus.ACTIVE,
        planId: planId || null,
      },
    });

    // Create default Main Branch for new tenant
    const branch = await prisma.branch.create({
      data: {
        tenantId: tenant.id,
        name: `${tenant.name} - Main Branch`,
        code: "MAIN",
        isMainBranch: true,
        isActive: true,
      },
    });

    await prisma.branchSettings.create({
      data: {
        branchId: branch.id,
        invoicePrefix: "INV-01-",
        nextInvoiceNum: 1001,
      },
    });

    return NextResponse.json({ success: true, tenant });
  } catch (error) {
    console.error("Create tenant error:", error);
    return NextResponse.json({ error: "Failed to create tenant" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const auth = await getAuthContext();
    if (!auth || !auth.user.isPlatformAdmin) {
      return NextResponse.json({ error: "Unauthorized: Super Admin access required." }, { status: 403 });
    }

    const { tenantId, status, planId } = await req.json();

    if (!tenantId) {
      return NextResponse.json({ error: "tenantId is required" }, { status: 400 });
    }

    const updated = await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        ...(status && { status: status as TenantStatus }),
        ...(planId && { planId }),
      },
    });

    return NextResponse.json({ success: true, tenant: updated });
  } catch (error) {
    console.error("Update tenant error:", error);
    return NextResponse.json({ error: "Failed to update tenant" }, { status: 500 });
  }
}
