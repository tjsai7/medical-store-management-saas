import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthContext } from "@/lib/auth";
import { StockService } from "@/lib/services/stock-service";
import { MovementType, PaymentStatus, Prisma } from "@prisma/client";

export async function POST(req: Request) {
  try {
    const auth = await getAuthContext();
    if (!auth || !auth.tenant || !auth.activeBranch) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const {
      customerName = "Walk-in Customer",
      customerPhone,
      doctorName,
      doctorRegNumber,
      prescriptionId,
      items, // array of { medicineId, batchId, quantity, unitSalePrice, mrp, discountPercent, gstRate }
      paymentMethod = "CASH",
      paymentReference,
    } = await req.json();

    if (!items || items.length === 0) {
      return NextResponse.json({ error: "Cart is empty" }, { status: 400 });
    }

    const branchId = auth.activeBranch.id;
    const tenantId = auth.tenant.id;

    // Execute atomic sale, sequential invoice generation, stock deduction, and ledger logging
    const invoice = await prisma.$transaction(async (tx) => {
      // 1. Get next sequential invoice number
      const branchSettings = await tx.branchSettings.findUnique({
        where: { branchId },
      });

      const prefix = branchSettings?.invoicePrefix || "INV-";
      const nextNum = branchSettings?.nextInvoiceNum || 1001;
      const invoiceNumber = `${prefix}${nextNum}`;

      // Increment next invoice number
      await tx.branchSettings.upsert({
        where: { branchId },
        update: { nextInvoiceNum: nextNum + 1 },
        create: {
          branchId,
          invoicePrefix: prefix,
          nextInvoiceNum: nextNum + 1,
        },
      });

      // 2. Validate batches and compute totals
      let subtotal = 0;
      let totalTaxable = 0;
      let totalCgst = 0;
      let totalSgst = 0;
      let totalDiscount = 0;

      for (const item of items) {
        // Verify batch is valid, not expired, not quarantined
        const batch = await tx.medicineBatch.findUnique({
          where: { id: item.batchId },
          include: { medicine: true },
        });

        if (!batch) {
          throw new Error(`Batch ID ${item.batchId} not found.`);
        }

        if (batch.status === "EXPIRED" || new Date(batch.expiryDate) < new Date()) {
          throw new Error(
            `Sale blocked: Medicine "${batch.medicine.name}" (Batch ${batch.batchNumber}) is EXPIRED.`
          );
        }

        if (batch.status === "QUARANTINED") {
          throw new Error(
            `Sale blocked: Medicine "${batch.medicine.name}" (Batch ${batch.batchNumber}) is currently QUARANTINED.`
          );
        }

        const qty = Number(item.quantity);
        const unitPrice = Number(item.unitSalePrice);
        const discPercent = Number(item.discountPercent || 0);
        const gstRate = Number(item.gstRate || batch.gstRate || 12);

        const gross = qty * unitPrice;
        const discAmount = gross * (discPercent / 100);
        const netTotal = gross - discAmount;

        // Indian retail tax-inclusive calculation: Taxable = Net / (1 + GST / 100)
        const taxable = netTotal / (1 + gstRate / 100);
        const tax = netTotal - taxable;
        const halfTax = tax / 2; // Intrastate: CGST 50%, SGST 50%

        subtotal += gross;
        totalDiscount += discAmount;
        totalTaxable += taxable;
        totalCgst += halfTax;
        totalSgst += halfTax;
      }

      const totalTax = totalCgst + totalSgst;
      const netPayable = totalTaxable + totalTax;
      const roundedTotal = Math.round(netPayable);
      const roundOff = Math.round((roundedTotal - netPayable) * 100) / 100;

      // 3. Create SalesInvoice Header
      const salesInvoice = await tx.salesInvoice.create({
        data: {
          tenantId,
          branchId,
          invoiceNumber,
          customerName: customerName.trim(),
          customerPhone: customerPhone?.trim() || null,
          doctorName: doctorName?.trim() || null,
          doctorRegNumber: doctorRegNumber?.trim() || null,
          prescriptionId: prescriptionId || null,
          subtotal: new Prisma.Decimal(subtotal),
          discountAmount: new Prisma.Decimal(totalDiscount),
          taxableAmount: new Prisma.Decimal(totalTaxable),
          cgstAmount: new Prisma.Decimal(totalCgst),
          sgstAmount: new Prisma.Decimal(totalSgst),
          igstAmount: new Prisma.Decimal(0),
          roundOff: new Prisma.Decimal(roundOff),
          grandTotal: new Prisma.Decimal(roundedTotal),
          paidAmount: new Prisma.Decimal(roundedTotal),
          paymentStatus: PaymentStatus.PAID,
          createdById: auth.user.id,
        },
      });

      // 4. Create Lines & deduct inventory via StockService
      for (const item of items) {
        const batch = await tx.medicineBatch.findUnique({
          where: { id: item.batchId },
        });

        const qty = Number(item.quantity);
        const unitPrice = Number(item.unitSalePrice);
        const discPercent = Number(item.discountPercent || 0);
        const gstRate = Number(item.gstRate || 12);

        const gross = qty * unitPrice;
        const discAmount = gross * (discPercent / 100);
        const netTotal = gross - discAmount;
        const taxable = netTotal / (1 + gstRate / 100);
        const tax = netTotal - taxable;
        const halfTax = tax / 2;

        await tx.salesInvoiceLine.create({
          data: {
            salesInvoiceId: salesInvoice.id,
            medicineId: item.medicineId,
            batchId: item.batchId,
            quantity: new Prisma.Decimal(qty),
            unitSalePrice: new Prisma.Decimal(unitPrice),
            mrp: new Prisma.Decimal(item.mrp),
            discountPercent: new Prisma.Decimal(discPercent),
            discountAmount: new Prisma.Decimal(discAmount),
            gstRate: new Prisma.Decimal(gstRate),
            taxableAmount: new Prisma.Decimal(taxable),
            cgstAmount: new Prisma.Decimal(halfTax),
            sgstAmount: new Prisma.Decimal(halfTax),
            igstAmount: new Prisma.Decimal(0),
            total: new Prisma.Decimal(netTotal),
          },
        });

        // Deduct inventory balance
        const balance = await tx.inventoryBalance.findUnique({
          where: {
            branchId_batchId: {
              branchId,
              batchId: item.batchId,
            },
          },
        });

        const currentQty = balance ? Number(balance.quantityOnHand) : 0;
        if (currentQty < qty) {
          throw new Error(
            `Insufficient stock for batch ${batch?.batchNumber}: requested ${qty}, available ${currentQty}.`
          );
        }

        const newQty = currentQty - qty;

        await tx.inventoryBalance.update({
          where: { id: balance!.id },
          data: {
            quantityOnHand: new Prisma.Decimal(newQty),
            lastReconciledAt: new Date(),
          },
        });

        // Update batch if depleted
        if (newQty === 0) {
          await tx.medicineBatch.update({
            where: { id: item.batchId },
            data: { status: "DEPLETED" },
          });
        }

        // Append immutable StockLedgerEntry
        await tx.stockLedgerEntry.create({
          data: {
            tenantId,
            branchId,
            medicineId: item.medicineId,
            batchId: item.batchId,
            movementType: MovementType.SALE,
            quantityDelta: new Prisma.Decimal(-qty),
            balanceAfter: new Prisma.Decimal(newQty),
            costPerUnit: batch!.unitPurchaseCost,
            referenceType: "SALES_INVOICE",
            referenceId: salesInvoice.invoiceNumber,
            notes: `POS Retail Sale to ${customerName}`,
            createdByUserId: auth.user.id,
          },
        });
      }

      // 5. Create Payment record
      await tx.salesPayment.create({
        data: {
          salesInvoiceId: salesInvoice.id,
          method: paymentMethod,
          amount: new Prisma.Decimal(roundedTotal),
          referenceNo: paymentReference || null,
        },
      });

      return salesInvoice;
    });

    // Record audit
    await prisma.auditLog.create({
      data: {
        tenantId,
        userId: auth.user.id,
        action: "CREATE",
        entityType: "SALES_INVOICE",
        entityId: invoice.id,
        details: JSON.stringify({
          invoiceNumber: invoice.invoiceNumber,
          total: invoice.grandTotal,
          paymentMethod,
        }),
      },
    });

    return NextResponse.json({ success: true, invoice });
  } catch (error: unknown) {
    console.error("POS Checkout error:", error);
    const msg = error instanceof Error ? error.message : "Checkout transaction failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
