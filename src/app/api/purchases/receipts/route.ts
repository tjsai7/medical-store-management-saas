import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthContext } from "@/lib/auth";
import { StockService } from "@/lib/services/stock-service";
import { GRNStatus, MovementType, POStatus, Prisma, BatchStatus } from "@prisma/client";

export async function GET() {
  try {
    const auth = await getAuthContext();
    if (!auth || !auth.tenant) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const receipts = await prisma.goodsReceipt.findMany({
      where: {
        tenantId: auth.tenant.id,
        ...(auth.activeBranch && { branchId: auth.activeBranch.id }),
      },
      include: {
        vendor: true,
        receivedBy: true,
        lines: { include: { medicine: true, batch: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ receipts });
  } catch (error) {
    console.error("Fetch GRN error:", error);
    return NextResponse.json({ error: "Failed to fetch goods receipts" }, { status: 500 });
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
      supplierChallan,
      notes,
      lines, // array of { medicineId, batchNumber, expiryDate, quantity, freeQuantity, unitPurchaseCost, mrp, gstRate }
    } = await req.json();

    if (!vendorId || !lines || lines.length === 0) {
      return NextResponse.json(
        { error: "Vendor and at least one received item are required." },
        { status: 400 }
      );
    }

    const grnNumber = `GRN-${Date.now().toString().slice(-6)}`;
    const tenantId = auth.tenant.id;
    const branchId = auth.activeBranch.id;

    // Execute atomic GRN receipt, batch creation, inventory increment, and ledger logging
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create GoodsReceipt Header
      const grn = await tx.goodsReceipt.create({
        data: {
          tenantId,
          branchId,
          vendorId,
          poId: poId || null,
          grnNumber,
          receiptDate: new Date(),
          status: GRNStatus.POSTED,
          supplierChallan: supplierChallan?.trim() || null,
          notes,
          receivedById: auth.user.id,
        },
      });

      // 2. Process each received line item
      for (const item of lines) {
        const qty = Number(item.quantity);
        const freeQty = Number(item.freeQuantity || 0);
        const totalReceivedUnits = qty + freeQty;
        const cost = Number(item.unitPurchaseCost);
        const mrp = Number(item.mrp);
        const gst = Number(item.gstRate || 12);
        const expiry = new Date(item.expiryDate);

        // A. Upsert MedicineBatch
        const batch = await tx.medicineBatch.upsert({
          where: {
            tenantId_branchId_medicineId_batchNumber: {
              tenantId,
              branchId,
              medicineId: item.medicineId,
              batchNumber: item.batchNumber.trim().toUpperCase(),
            },
          },
          update: {
            expiryDate: expiry,
            mrp: new Prisma.Decimal(mrp),
            unitPurchaseCost: new Prisma.Decimal(cost),
            status: expiry < new Date() ? BatchStatus.EXPIRED : BatchStatus.ACTIVE,
          },
          create: {
            tenantId,
            branchId,
            medicineId: item.medicineId,
            batchNumber: item.batchNumber.trim().toUpperCase(),
            expiryDate: expiry,
            mrp: new Prisma.Decimal(mrp),
            unitSalePrice: new Prisma.Decimal(mrp * 0.95), // Default retail sale price
            unitPurchaseCost: new Prisma.Decimal(cost),
            gstRate: new Prisma.Decimal(gst),
            status: expiry < new Date() ? BatchStatus.EXPIRED : BatchStatus.ACTIVE,
            supplierId: vendorId,
          },
        });

        // B. Upsert InventoryBalance
        const currentBalance = await tx.inventoryBalance.findUnique({
          where: {
            branchId_batchId: {
              branchId,
              batchId: batch.id,
            },
          },
        });

        const newOnHand = (currentBalance ? Number(currentBalance.quantityOnHand) : 0) + totalReceivedUnits;

        await tx.inventoryBalance.upsert({
          where: {
            branchId_batchId: {
              branchId,
              batchId: batch.id,
            },
          },
          update: {
            quantityOnHand: new Prisma.Decimal(newOnHand),
            lastReconciledAt: new Date(),
          },
          create: {
            tenantId,
            branchId,
            medicineId: item.medicineId,
            batchId: batch.id,
            quantityOnHand: new Prisma.Decimal(newOnHand),
            quantityReserved: new Prisma.Decimal(0),
          },
        });

        // C. Append immutable StockLedgerEntry
        await tx.stockLedgerEntry.create({
          data: {
            tenantId,
            branchId,
            medicineId: item.medicineId,
            batchId: batch.id,
            movementType: MovementType.PURCHASE_RECEIPT,
            quantityDelta: new Prisma.Decimal(totalReceivedUnits),
            balanceAfter: new Prisma.Decimal(newOnHand),
            costPerUnit: new Prisma.Decimal(cost),
            referenceType: "GOODS_RECEIPT",
            referenceId: grn.grnNumber,
            notes: `Received from vendor ${grn.vendorId}${freeQty > 0 ? ` (Includes ${freeQty} free units)` : ""}`,
            createdByUserId: auth.user.id,
          },
        });

        // D. Create GoodsReceiptLine
        await tx.goodsReceiptLine.create({
          data: {
            goodsReceiptId: grn.id,
            medicineId: item.medicineId,
            batchId: batch.id,
            batchNumber: batch.batchNumber,
            expiryDate: expiry,
            quantity: new Prisma.Decimal(qty),
            freeQuantity: new Prisma.Decimal(freeQty),
            unitPurchaseCost: new Prisma.Decimal(cost),
            mrp: new Prisma.Decimal(mrp),
            gstRate: new Prisma.Decimal(gst),
          },
        });
      }

      // 3. Update PO status if linked
      if (poId) {
        await tx.purchaseOrder.update({
          where: { id: poId },
          data: { status: POStatus.COMPLETED },
        });
      }

      return grn;
    });

    // Record audit
    await prisma.auditLog.create({
      data: {
        tenantId: auth.tenant.id,
        userId: auth.user.id,
        action: "POST",
        entityType: "GOODS_RECEIPT",
        entityId: result.id,
        details: JSON.stringify({ grnNumber: result.grnNumber, lineCount: lines.length }),
      },
    });

    return NextResponse.json({ success: true, goodsReceipt: result });
  } catch (error: unknown) {
    console.error("Post GRN error:", error);
    const msg = error instanceof Error ? error.message : "Failed to post goods receipt";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
