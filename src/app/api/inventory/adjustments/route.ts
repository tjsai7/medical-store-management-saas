import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthContext } from "@/lib/auth";
import { StockService } from "@/lib/services/stock-service";
import { MovementType, Prisma } from "@prisma/client";

export async function POST(req: Request) {
  try {
    const auth = await getAuthContext();
    if (!auth || !auth.tenant || !auth.activeBranch) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const {
      batchId,
      reason, // EXPIRY_WRITEOFF, DAMAGED, PHYSICAL_COUNT_VARIANCE, THEFT
      adjustmentType, // "POSITIVE" or "NEGATIVE"
      quantity,
      notes,
    } = await req.json();

    if (!batchId || !reason || !quantity || Number(quantity) <= 0) {
      return NextResponse.json(
        { error: "Batch, reason, and valid quantity are required." },
        { status: 400 }
      );
    }

    const batch = await prisma.medicineBatch.findFirst({
      where: {
        id: batchId,
        tenantId: auth.tenant.id,
        branchId: auth.activeBranch.id,
      },
      include: { medicine: true },
    });

    if (!batch) {
      return NextResponse.json({ error: "Batch not found at this branch" }, { status: 404 });
    }

    const isPositive = adjustmentType === "POSITIVE";
    const delta = isPositive ? Number(quantity) : -Number(quantity);
    const movementType =
      reason === "EXPIRY_WRITEOFF"
        ? MovementType.DAMAGE_EXPIRY_WRITEOFF
        : isPositive
        ? MovementType.ADJUSTMENT_POSITIVE
        : MovementType.ADJUSTMENT_NEGATIVE;

    const adjustmentNumber = `ADJ-${Date.now().toString().slice(-6)}`;
    const costPerUnit = Number(batch.unitPurchaseCost);
    const totalAmount = Math.abs(delta) * costPerUnit;

    // Execute atomic stock movement via StockService
    const { ledgerEntry } = await StockService.recordStockMovement({
      tenantId: auth.tenant.id,
      branchId: auth.activeBranch.id,
      medicineId: batch.medicineId,
      batchId: batch.id,
      movementType,
      quantityDelta: delta,
      costPerUnit,
      referenceType: "STOCK_ADJUSTMENT",
      referenceId: adjustmentNumber,
      notes: notes || reason,
      userId: auth.user.id,
    });

    // Create adjustment header
    const adjustment = await prisma.stockAdjustment.create({
      data: {
        tenantId: auth.tenant.id,
        branchId: auth.activeBranch.id,
        adjustmentNumber,
        reason,
        totalAmount: new Prisma.Decimal(totalAmount),
        status: "APPROVED",
        createdById: auth.user.id,
      },
    });

    return NextResponse.json({ success: true, adjustment, ledgerEntry });
  } catch (error: unknown) {
    console.error("Stock adjustment error:", error);
    const msg = error instanceof Error ? error.message : "Failed to post adjustment";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
