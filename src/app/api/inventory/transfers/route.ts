import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthContext } from "@/lib/auth";
import { MovementType, Prisma, TransferStatus, BatchStatus } from "@prisma/client";

export async function GET() {
  try {
    const auth = await getAuthContext();
    if (!auth || !auth.tenant) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const transfers = await prisma.stockTransfer.findMany({
      where: { tenantId: auth.tenant.id },
      include: {
        originBranch: true,
        destBranch: true,
        sentByUser: true,
        receivedByUser: true,
        lines: {
          include: { medicine: true, batch: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ transfers });
  } catch (error) {
    console.error("Fetch transfers error:", error);
    return NextResponse.json({ error: "Failed to fetch transfers" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const auth = await getAuthContext();
    if (!auth || !auth.tenant || !auth.activeBranch) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { destBranchId, notes, lines } = await req.json();

    if (!destBranchId || !lines || lines.length === 0) {
      return NextResponse.json(
        { error: "Destination branch and at least one item are required." },
        { status: 400 }
      );
    }

    if (destBranchId === auth.activeBranch.id) {
      return NextResponse.json(
        { error: "Destination branch cannot be the same as the origin branch." },
        { status: 400 }
      );
    }

    const transferNumber = `TRF-${Date.now().toString().slice(-6)}`;
    const originBranchId = auth.activeBranch.id;
    const tenantId = auth.tenant.id;

    // ACID transaction: Create transfer, deduct stock from origin, mark IN_TRANSIT
    const transfer = await prisma.$transaction(async (tx) => {
      // 1. Create StockTransfer header with IN_TRANSIT status
      const trf = await tx.stockTransfer.create({
        data: {
          tenantId,
          originBranchId,
          destBranchId,
          transferNumber,
          status: TransferStatus.IN_TRANSIT,
          notes,
          sentByUserId: auth.user.id,
          sentAt: new Date(),
        },
      });

      // 2. For each line, verify origin stock, deduct, and log TRANSFER_OUT
      for (const item of lines) {
        const qty = Number(item.quantity);
        const batch = await tx.medicineBatch.findUnique({
          where: { id: item.batchId },
        });

        if (!batch) {
          throw new Error(`Batch not found.`);
        }

        const balance = await tx.inventoryBalance.findUnique({
          where: {
            branchId_batchId: {
              branchId: originBranchId,
              batchId: item.batchId,
            },
          },
        });

        const currentQty = balance ? Number(balance.quantityOnHand) : 0;
        if (currentQty < qty) {
          throw new Error(
            `Insufficient stock to transfer for batch ${batch.batchNumber}: requested ${qty}, available ${currentQty}.`
          );
        }

        const newOriginQty = currentQty - qty;

        // Deduct from origin balance
        await tx.inventoryBalance.update({
          where: { id: balance!.id },
          data: {
            quantityOnHand: new Prisma.Decimal(newOriginQty),
            lastReconciledAt: new Date(),
          },
        });

        // Record TRANSFER_OUT on origin ledger
        await tx.stockLedgerEntry.create({
          data: {
            tenantId,
            branchId: originBranchId,
            medicineId: item.medicineId,
            batchId: item.batchId,
            movementType: MovementType.TRANSFER_OUT,
            quantityDelta: new Prisma.Decimal(-qty),
            balanceAfter: new Prisma.Decimal(newOriginQty),
            costPerUnit: batch.unitPurchaseCost,
            referenceType: "STOCK_TRANSFER",
            referenceId: trf.transferNumber,
            notes: `Dispatched in-transit to destination branch ${destBranchId}`,
            createdByUserId: auth.user.id,
          },
        });

        // Create line
        await tx.stockTransferLine.create({
          data: {
            stockTransferId: trf.id,
            medicineId: item.medicineId,
            batchId: item.batchId,
            quantity: new Prisma.Decimal(qty),
          },
        });
      }

      return trf;
    });

    // Record audit
    await prisma.auditLog.create({
      data: {
        tenantId,
        userId: auth.user.id,
        action: "POST",
        entityType: "STOCK_TRANSFER",
        entityId: transfer.id,
        details: JSON.stringify({ transferNumber, status: "IN_TRANSIT" }),
      },
    });

    return NextResponse.json({ success: true, transfer });
  } catch (error: unknown) {
    console.error("Create transfer error:", error);
    const msg = error instanceof Error ? error.message : "Failed to initiate transfer";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// Receive In-Transit Transfer at Destination Branch
export async function PATCH(req: Request) {
  try {
    const auth = await getAuthContext();
    if (!auth || !auth.tenant || !auth.activeBranch) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { transferId } = await req.json();

    const transfer = await prisma.stockTransfer.findFirst({
      where: {
        id: transferId,
        tenantId: auth.tenant.id,
        destBranchId: auth.activeBranch.id, // Must be receiving at destination
        status: TransferStatus.IN_TRANSIT,
      },
      include: {
        lines: { include: { batch: true, medicine: true } },
      },
    });

    if (!transfer) {
      return NextResponse.json(
        { error: "Transfer not found or not in transit for this branch" },
        { status: 404 }
      );
    }

    const destBranchId = auth.activeBranch.id;
    const tenantId = auth.tenant.id;

    // ACID transaction: Confirm receipt, create destination batch & balance, log TRANSFER_IN
    const result = await prisma.$transaction(async (tx) => {
      for (const line of transfer.lines) {
        const qty = Number(line.quantity);
        const originBatch = line.batch;

        // Upsert batch at destination branch
        const destBatch = await tx.medicineBatch.upsert({
          where: {
            tenantId_branchId_medicineId_batchNumber: {
              tenantId,
              branchId: destBranchId,
              medicineId: line.medicineId,
              batchNumber: originBatch.batchNumber,
            },
          },
          update: {
            expiryDate: originBatch.expiryDate,
            mrp: originBatch.mrp,
            unitSalePrice: originBatch.unitSalePrice,
            unitPurchaseCost: originBatch.unitPurchaseCost,
            status: originBatch.status,
          },
          create: {
            tenantId,
            branchId: destBranchId,
            medicineId: line.medicineId,
            batchNumber: originBatch.batchNumber,
            expiryDate: originBatch.expiryDate,
            mrp: originBatch.mrp,
            unitSalePrice: originBatch.unitSalePrice,
            unitPurchaseCost: originBatch.unitPurchaseCost,
            gstRate: originBatch.gstRate,
            status: originBatch.status,
            supplierId: originBatch.supplierId,
          },
        });

        // Upsert destination InventoryBalance
        const currentDestBalance = await tx.inventoryBalance.findUnique({
          where: {
            branchId_batchId: {
              branchId: destBranchId,
              batchId: destBatch.id,
            },
          },
        });

        const newDestQty = (currentDestBalance ? Number(currentDestBalance.quantityOnHand) : 0) + qty;

        await tx.inventoryBalance.upsert({
          where: {
            branchId_batchId: {
              branchId: destBranchId,
              batchId: destBatch.id,
            },
          },
          update: {
            quantityOnHand: new Prisma.Decimal(newDestQty),
            lastReconciledAt: new Date(),
          },
          create: {
            tenantId,
            branchId: destBranchId,
            medicineId: line.medicineId,
            batchId: destBatch.id,
            quantityOnHand: new Prisma.Decimal(newDestQty),
          },
        });

        // Record TRANSFER_IN on destination ledger
        await tx.stockLedgerEntry.create({
          data: {
            tenantId,
            branchId: destBranchId,
            medicineId: line.medicineId,
            batchId: destBatch.id,
            movementType: MovementType.TRANSFER_IN,
            quantityDelta: new Prisma.Decimal(qty),
            balanceAfter: new Prisma.Decimal(newDestQty),
            costPerUnit: originBatch.unitPurchaseCost,
            referenceType: "STOCK_TRANSFER",
            referenceId: transfer.transferNumber,
            notes: `Received stock transfer from origin branch ${transfer.originBranchId}`,
            createdByUserId: auth.user.id,
          },
        });
      }

      // Mark transfer as RECEIVED
      return await tx.stockTransfer.update({
        where: { id: transfer.id },
        data: {
          status: TransferStatus.RECEIVED,
          receivedByUserId: auth.user.id,
          receivedAt: new Date(),
        },
      });
    });

    return NextResponse.json({ success: true, transfer: result });
  } catch (error: unknown) {
    console.error("Receive transfer error:", error);
    const msg = error instanceof Error ? error.message : "Failed to receive transfer";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
