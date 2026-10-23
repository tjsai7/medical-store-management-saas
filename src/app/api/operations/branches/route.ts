import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthContext } from "@/lib/auth";

export async function GET() {
  try {
    const auth = await getAuthContext();
    if (!auth || !auth.tenant) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const branches = await prisma.branch.findMany({
      where: { tenantId: auth.tenant.id },
      include: {
        _count: {
          select: { userAccesses: true, inventoryBalances: true, salesInvoices: true },
        },
      },
      orderBy: { isMainBranch: "desc" },
    });

    return NextResponse.json({ branches });
  } catch (error) {
    console.error("Fetch branches error:", error);
    return NextResponse.json({ error: "Failed to fetch branches" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const auth = await getAuthContext();
    if (!auth || !auth.tenant) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const {
      name,
      code,
      address,
      city = "Hyderabad",
      state = "Telangana",
      pincode,
      phone,
      email,
      gstin,
      dlNumber,
    } = await req.json();

    if (!name || !code) {
      return NextResponse.json(
        { error: "Branch name and branch code are required." },
        { status: 400 }
      );
    }

    // Check subscription plan branch limit
    const tenantWithPlan = await prisma.tenant.findUnique({
      where: { id: auth.tenant.id },
      include: {
        plan: true,
        _count: { select: { branches: true } },
      },
    });

    const maxBranches = tenantWithPlan?.plan?.maxBranches || 5;
    if (tenantWithPlan && tenantWithPlan._count.branches >= maxBranches) {
      return NextResponse.json(
        {
          error: `Branch limit reached: Your subscription plan (${tenantWithPlan.plan?.name || "Standard"}) allows up to ${maxBranches} store branches. Please upgrade your subscription to add more locations.`,
        },
        { status: 403 }
      );
    }

    // Check duplicate code
    const existingCode = await prisma.branch.findUnique({
      where: {
        tenantId_code: {
          tenantId: auth.tenant.id,
          code: code.trim().toUpperCase(),
        },
      },
    });

    if (existingCode) {
      return NextResponse.json(
        { error: `Branch code "${code}" is already in use by another store location.` },
        { status: 409 }
      );
    }

    const branch = await prisma.branch.create({
      data: {
        tenantId: auth.tenant.id,
        name: name.trim(),
        code: code.trim().toUpperCase(),
        address: address?.trim(),
        city: city?.trim(),
        state: state?.trim(),
        pincode: pincode?.trim(),
        phone: phone?.trim(),
        email: email?.trim(),
        gstin: gstin?.trim() || auth.tenant.gstin,
        dlNumber: dlNumber?.trim(),
        isMainBranch: false,
        isActive: true,
      },
    });

    // Create default branch settings
    await prisma.branchSettings.create({
      data: {
        branchId: branch.id,
        invoicePrefix: `INV-${branch.code}-`,
        nextInvoiceNum: 1001,
        receiptHeader: `${branch.name}\nPh: ${branch.phone || "N/A"}`,
        receiptFooter: "Thank you for visiting! Get well soon.",
      },
    });

    // Automatically give the creating user access to this new branch
    const defaultRole = await prisma.role.findFirst({
      where: { tenantId: auth.tenant.id, code: "PHARMACY_OWNER" },
    });

    if (defaultRole) {
      await prisma.userBranchAccess.create({
        data: {
          userId: auth.user.id,
          branchId: branch.id,
          roleId: defaultRole.id,
        },
      });
    }

    // Audit log
    await prisma.auditLog.create({
      data: {
        tenantId: auth.tenant.id,
        userId: auth.user.id,
        action: "CREATE",
        entityType: "BRANCH",
        entityId: branch.id,
        details: JSON.stringify({ name: branch.name, code: branch.code }),
      },
    });

    return NextResponse.json({ success: true, branch });
  } catch (error) {
    console.error("Create branch error:", error);
    return NextResponse.json({ error: "Failed to create branch" }, { status: 500 });
  }
}
