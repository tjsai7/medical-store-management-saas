import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthContext } from "@/lib/auth";
import { InvoiceStatus, Prisma } from "@prisma/client";

export async function GET() {
  try {
    const auth = await getAuthContext();
    if (!auth || !auth.tenant) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const invoices = await prisma.vendorInvoice.findMany({
      where: {
        tenantId: auth.tenant.id,
        ...(auth.activeBranch && { branchId: auth.activeBranch.id }),
      },
      include: {
        vendor: true,
        purchaseOrder: true,
        goodsReceipt: true,
        payments: true,
        lines: { include: { medicine: true } },
      },
      orderBy: { invoiceDate: "desc" },
    });

    return NextResponse.json({ invoices });
  } catch (error) {
    console.error("Fetch invoices error:", error);
    return NextResponse.json({ error: "Failed to fetch invoices" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const auth = await getAuthContext();
    if (!auth || !auth.tenant || !auth.activeBranch) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const {
      vendorId,
      poId,
      grnId,
      invoiceNumber,
      invoiceDate,
      dueDate,
      subtotal,
      taxAmount,
      discountAmount = 0,
      roundOff = 0,
      grandTotal,
      notes,
      lines,
    } = await req.json();

    if (!vendorId || !invoiceNumber || !grandTotal) {
      return NextResponse.json(
        { error: "Vendor, invoice number, and grand total are required." },
        { status: 400 }
      );
    }

    // 1. Duplicate Invoice Number Detection
    const duplicate = await prisma.vendorInvoice.findUnique({
      where: {
        tenantId_vendorId_invoiceNumber: {
          tenantId: auth.tenant.id,
          vendorId,
          invoiceNumber: invoiceNumber.trim(),
        },
      },
    });

    if (duplicate) {
      return NextResponse.json(
        {
          error: `Duplicate Invoice: An invoice with number "${invoiceNumber}" has already been recorded for this vendor.`,
        },
        { status: 409 }
      );
    }

    const invoice = await prisma.vendorInvoice.create({
      data: {
        tenantId: auth.tenant.id,
        branchId: auth.activeBranch.id,
        vendorId,
        poId: poId || null,
        grnId: grnId || null,
        invoiceNumber: invoiceNumber.trim(),
        invoiceDate: invoiceDate ? new Date(invoiceDate) : new Date(),
        dueDate: dueDate ? new Date(dueDate) : new Date(Date.now() + 30 * 86400000),
        subtotal: new Prisma.Decimal(subtotal || grandTotal),
        taxAmount: new Prisma.Decimal(taxAmount || 0),
        discountAmount: new Prisma.Decimal(discountAmount || 0),
        roundOff: new Prisma.Decimal(roundOff || 0),
        grandTotal: new Prisma.Decimal(grandTotal),
        paidAmount: new Prisma.Decimal(0),
        status: InvoiceStatus.PENDING,
        notes,
      },
    });

    // Update vendor outstanding balance
    await prisma.vendor.update({
      where: { id: vendorId },
      data: {
        outstandingBalance: {
          increment: new Prisma.Decimal(grandTotal),
        },
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        tenantId: auth.tenant.id,
        userId: auth.user.id,
        action: "CREATE",
        entityType: "VENDOR_INVOICE",
        entityId: invoice.id,
        details: JSON.stringify({ invoiceNumber, grandTotal }),
      },
    });

    return NextResponse.json({ success: true, invoice });
  } catch (error) {
    console.error("Create vendor invoice error:", error);
    return NextResponse.json({ error: "Failed to create vendor invoice" }, { status: 500 });
  }
}
