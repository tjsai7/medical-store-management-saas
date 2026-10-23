import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthContext } from "@/lib/auth";
import { POStatus, Prisma } from "@prisma/client";

export async function GET(req: Request) {
  try {
    const auth = await getAuthContext();
    if (!auth || !auth.tenant) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const vendorId = searchParams.get("vendorId");

    const orders = await prisma.purchaseOrder.findMany({
      where: {
        tenantId: auth.tenant.id,
        ...(auth.activeBranch && { branchId: auth.activeBranch.id }),
        ...(vendorId && { vendorId }),
      },
      include: {
        vendor: true,
        createdBy: true,
        lines: { include: { medicine: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ orders });
  } catch (error) {
    console.error("Fetch orders error:", error);
    return NextResponse.json({ error: "Failed to fetch orders" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const auth = await getAuthContext();
    if (!auth || !auth.tenant || !auth.activeBranch) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { vendorId, expectedDate, notes, lines } = await req.json();

    if (!vendorId || !lines || lines.length === 0) {
      return NextResponse.json(
        { error: "Vendor and at least one line item are required." },
        { status: 400 }
      );
    }

    const poNumber = `PO-${Date.now().toString().slice(-6)}`;

    // Calculate subtotal, tax, grand total
    let subtotal = 0;
    let taxAmount = 0;
    let discountAmount = 0;

    const formattedLines = lines.map(
      (line: {
        medicineId: string;
        quantity: number;
        unitCost: number;
        discountPercent?: number;
        gstRate?: number;
      }) => {
        const qty = Number(line.quantity);
        const cost = Number(line.unitCost);
        const discPercent = Number(line.discountPercent || 0);
        const gst = Number(line.gstRate || 12);

        const baseLine = qty * cost;
        const disc = baseLine * (discPercent / 100);
        const taxable = baseLine - disc;
        const tax = taxable * (gst / 100);
        const lineTotal = taxable + tax;

        subtotal += taxable;
        taxAmount += tax;
        discountAmount += disc;

        return {
          medicineId: line.medicineId,
          quantity: new Prisma.Decimal(qty),
          unitCost: new Prisma.Decimal(cost),
          discountPercent: new Prisma.Decimal(discPercent),
          gstRate: new Prisma.Decimal(gst),
          lineTotal: new Prisma.Decimal(lineTotal),
        };
      }
    );

    const grandTotal = subtotal + taxAmount;

    const order = await prisma.purchaseOrder.create({
      data: {
        tenantId: auth.tenant.id,
        branchId: auth.activeBranch.id,
        vendorId,
        poNumber,
        expectedDate: expectedDate ? new Date(expectedDate) : null,
        status: POStatus.ORDERED,
        subtotal: new Prisma.Decimal(subtotal),
        taxAmount: new Prisma.Decimal(taxAmount),
        discountAmount: new Prisma.Decimal(discountAmount),
        grandTotal: new Prisma.Decimal(grandTotal),
        notes,
        createdById: auth.user.id,
        lines: {
          create: formattedLines,
        },
      },
      include: {
        vendor: true,
        lines: { include: { medicine: true } },
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        tenantId: auth.tenant.id,
        userId: auth.user.id,
        action: "CREATE",
        entityType: "PURCHASE_ORDER",
        entityId: order.id,
        details: JSON.stringify({ poNumber: order.poNumber, total: grandTotal }),
      },
    });

    return NextResponse.json({ success: true, order });
  } catch (error) {
    console.error("Create PO error:", error);
    return NextResponse.json({ error: "Failed to create purchase order" }, { status: 500 });
  }
}
