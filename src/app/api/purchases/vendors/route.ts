import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthContext } from "@/lib/auth";
import { Prisma } from "@prisma/client";

export async function GET() {
  try {
    const auth = await getAuthContext();
    if (!auth || !auth.tenant) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const vendors = await prisma.vendor.findMany({
      where: { tenantId: auth.tenant.id },
      include: {
        _count: {
          select: { purchaseOrders: true, vendorInvoices: true },
        },
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ vendors });
  } catch (error) {
    console.error("Fetch vendors error:", error);
    return NextResponse.json({ error: "Failed to fetch vendors" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const auth = await getAuthContext();
    if (!auth || !auth.tenant) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const {
      name,
      code,
      contactPerson,
      phone,
      email,
      address,
      city,
      state = "Telangana",
      pincode,
      gstin,
      dlNumber,
      paymentTermsDays = 30,
      creditLimit = 0,
      bankName,
      bankAccountNumber,
      bankIfsc,
    } = body;

    if (!name || !code || !phone) {
      return NextResponse.json(
        { error: "Vendor name, code, and phone number are required." },
        { status: 400 }
      );
    }

    // Check duplicate code
    const existing = await prisma.vendor.findUnique({
      where: {
        tenantId_code: {
          tenantId: auth.tenant.id,
          code: code.trim(),
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: `Vendor with code "${code}" already exists.` },
        { status: 409 }
      );
    }

    const vendor = await prisma.vendor.create({
      data: {
        tenantId: auth.tenant.id,
        name: name.trim(),
        code: code.trim(),
        contactPerson: contactPerson?.trim(),
        phone: phone.trim(),
        email: email?.trim(),
        address: address?.trim(),
        city: city?.trim(),
        state: state?.trim(),
        pincode: pincode?.trim(),
        gstin: gstin?.trim(),
        dlNumber: dlNumber?.trim(),
        paymentTermsDays: Number(paymentTermsDays) || 30,
        creditLimit: new Prisma.Decimal(creditLimit || 0),
        bankName: bankName?.trim(),
        bankAccountNumber: bankAccountNumber?.trim(),
        bankIfsc: bankIfsc?.trim(),
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        tenantId: auth.tenant.id,
        userId: auth.user.id,
        action: "CREATE",
        entityType: "VENDOR",
        entityId: vendor.id,
        details: JSON.stringify({ name: vendor.name, code: vendor.code }),
      },
    });

    return NextResponse.json({ success: true, vendor });
  } catch (error) {
    console.error("Create vendor error:", error);
    return NextResponse.json({ error: "Failed to create vendor" }, { status: 500 });
  }
}
