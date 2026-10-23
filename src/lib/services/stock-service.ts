import { prisma } from "@/lib/prisma";
import { MovementType, BatchStatus, Prisma } from "@prisma/client";

export interface StockMovementInput {
  tenantId: string;
  branchId: string;
  medicineId: string;
  batchId: string;
  movementType: MovementType;
  quantityDelta: number; // positive for additions, negative for deductions
  costPerUnit: number;
  referenceType: string;
  referenceId?: string;
  notes?: string;
  userId?: string;
}

export class StockService {
  /**
   * Execute an atomic, transaction-safe stock update.
   * Updates InventoryBalance and logs an immutable StockLedgerEntry.
   * Throws an error if deduction results in negative stock and negative stock is disallowed.
   */
  static async recordStockMovement(input: StockMovementInput) {
    return await prisma.$transaction(async (tx) => {
      // 1. Fetch current inventory balance
      let balance = await tx.inventoryBalance.findUnique({
        where: {
          branchId_batchId: {
            branchId: input.branchId,
            batchId: input.batchId,
          },
        },
      });

      const currentQty = balance ? Number(balance.quantityOnHand) : 0;
      const newQty = currentQty + input.quantityDelta;

      // 2. Validate negative stock prevention
      if (newQty < 0) {
        throw new Error(
          `Insufficient stock: Batch has ${currentQty} units available, requested deduction is ${Math.abs(
            input.quantityDelta
          )} units.`
        );
      }

      // 3. Upsert balance
      if (balance) {
        balance = await tx.inventoryBalance.update({
          where: { id: balance.id },
          data: {
            quantityOnHand: new Prisma.Decimal(newQty),
            lastReconciledAt: new Date(),
          },
        });
      } else {
        balance = await tx.inventoryBalance.create({
          data: {
            tenantId: input.tenantId,
            branchId: input.branchId,
            medicineId: input.medicineId,
            batchId: input.batchId,
            quantityOnHand: new Prisma.Decimal(newQty),
            quantityReserved: new Prisma.Decimal(0),
          },
        });
      }

      // 4. Update batch status if depleted
      if (newQty === 0) {
        await tx.medicineBatch.update({
          where: { id: input.batchId },
          data: { status: BatchStatus.DEPLETED },
        });
      } else if (newQty > 0) {
        // If it was depleted but restocked
        const batch = await tx.medicineBatch.findUnique({
          where: { id: input.batchId },
        });
        if (batch && batch.status === BatchStatus.DEPLETED) {
          const isExpired = new Date(batch.expiryDate) < new Date();
          await tx.medicineBatch.update({
            where: { id: input.batchId },
            data: {
              status: isExpired ? BatchStatus.EXPIRED : BatchStatus.ACTIVE,
            },
          });
        }
      }

      // 5. Append immutable StockLedgerEntry
      const ledgerEntry = await tx.stockLedgerEntry.create({
        data: {
          tenantId: input.tenantId,
          branchId: input.branchId,
          medicineId: input.medicineId,
          batchId: input.batchId,
          movementType: input.movementType,
          quantityDelta: new Prisma.Decimal(input.quantityDelta),
          balanceAfter: new Prisma.Decimal(newQty),
          costPerUnit: new Prisma.Decimal(input.costPerUnit),
          referenceType: input.referenceType,
          referenceId: input.referenceId,
          notes: input.notes,
          createdByUserId: input.userId,
        },
      });

      return { balance, ledgerEntry };
    });
  }

  /**
   * FEFO (First Expiry, First Out) batch allocation algorithm.
   * Allocates batches sorted by earliest expiry date.
   * Strictly filters out EXPIRED, QUARANTINED, and DEPLETED batches.
   */
  static async allocateBatchesFEFO(
    tenantId: string,
    branchId: string,
    medicineId: string,
    requiredQty: number
  ) {
    const now = new Date();

    // Query active, non-expired batches sorted by earliest expiry
    const eligibleBatches = await prisma.medicineBatch.findMany({
      where: {
        tenantId,
        branchId,
        medicineId,
        status: BatchStatus.ACTIVE,
        expiryDate: { gt: now },
      },
      include: {
        inventoryBalances: {
          where: { branchId },
        },
      },
      orderBy: {
        expiryDate: "asc",
      },
    });

    const allocations: Array<{
      batchId: string;
      batchNumber: string;
      expiryDate: Date;
      allocatedQty: number;
      unitSalePrice: number;
      mrp: number;
      gstRate: number;
      unitPurchaseCost: number;
    }> = [];

    let remainingNeeded = requiredQty;

    for (const batch of eligibleBatches) {
      const balance = batch.inventoryBalances[0];
      const available = balance ? Number(balance.quantityOnHand) : 0;

      if (available <= 0) continue;

      const take = Math.min(available, remainingNeeded);
      allocations.push({
        batchId: batch.id,
        batchNumber: batch.batchNumber,
        expiryDate: batch.expiryDate,
        allocatedQty: take,
        unitSalePrice: Number(batch.unitSalePrice),
        mrp: Number(batch.mrp),
        gstRate: Number(batch.gstRate),
        unitPurchaseCost: Number(batch.unitPurchaseCost),
      });

      remainingNeeded -= take;
      if (remainingNeeded <= 0) break;
    }

    if (remainingNeeded > 0) {
      throw new Error(
        `Insufficient active stock: Requested ${requiredQty} units, but only ${
          requiredQty - remainingNeeded
        } units are available in non-expired, active batches.`
      );
    }

    return allocations;
  }
}
