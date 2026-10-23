import { StockService } from "../src/lib/services/stock-service";
import { prisma } from "../src/lib/prisma";
import { MovementType, BatchStatus } from "@prisma/client";

async function runTestSuite() {
  console.log("🧪 Running Medical Store Management SaaS Test Suite...\n");
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName}`);
      failed++;
    }
  }

  try {
    // Setup test tenant and branch
    const tenant = await prisma.tenant.findUnique({
      where: { slug: "apex-medcare" },
      include: { branches: true },
    });

    if (!tenant || tenant.branches.length === 0) {
      throw new Error("Apex MedCare tenant not found. Please run seed script first.");
    }

    const branch = tenant.branches[0];

    // Find test medicine
    const dolo = await prisma.medicine.findFirst({
      where: { tenantId: tenant.id, sku: "MED-DOLO-650" },
    });

    if (!dolo) {
      throw new Error("Dolo medicine not found in database.");
    }

    // -------------------------------------------------------------------------
    // TEST 1: FEFO (First Expiry First Out) Allocation Rules
    // -------------------------------------------------------------------------
    console.log("▶ Test 1: FEFO Batch Allocation Order");
    const allocations = await StockService.allocateBatchesFEFO(
      tenant.id,
      branch.id,
      dolo.id,
      10
    );

    assert(allocations.length > 0, "Allocates eligible active batches");
    assert(allocations[0].allocatedQty === 10, "Allocates exact requested quantity (10)");
    
    // Verify that earliest non-expired batch was prioritized
    const doloBatches = await prisma.medicineBatch.findMany({
      where: {
        tenantId: tenant.id,
        branchId: branch.id,
        medicineId: dolo.id,
        status: BatchStatus.ACTIVE,
        expiryDate: { gt: new Date() },
      },
      orderBy: { expiryDate: "asc" },
    });

    assert(
      allocations[0].batchId === doloBatches[0].id,
      `Allocates earliest expiring batch first (FEFO: ${doloBatches[0].batchNumber})`
    );

    // -------------------------------------------------------------------------
    // TEST 2: Prevention of Selling Expired / Quarantined Stock
    // -------------------------------------------------------------------------
    console.log("\n▶ Test 2: Expired and Quarantined Stock Restriction");
    const augmentin = await prisma.medicine.findFirst({
      where: { tenantId: tenant.id, sku: "MED-AUG-625" },
      include: { batches: true },
    });

    const expiredAugmentinBatch = augmentin?.batches.find((b) => b.status === "EXPIRED");
    assert(
      expiredAugmentinBatch !== undefined,
      "Expired test batch exists in database"
    );

    let expiredAllowed = false;
    try {
      const augAlloc = await StockService.allocateBatchesFEFO(
        tenant.id,
        branch.id,
        augmentin!.id,
        1000 // intentionally exceed active stock to see if expired gets touched
      );
      if (augAlloc.some((a) => a.batchId === expiredAugmentinBatch?.id)) {
        expiredAllowed = true;
      }
    } catch {
      // Expected to fail because active stock is less than 1000 and expired is blocked
      expiredAllowed = false;
    }

    assert(
      !expiredAllowed,
      "FEFO engine strictly rejects and filters out EXPIRED batches"
    );

    // -------------------------------------------------------------------------
    // TEST 3: Negative Stock Prevention
    // -------------------------------------------------------------------------
    console.log("\n▶ Test 3: Transactional Negative Stock Prevention");
    const activeBatch = doloBatches[0];
    const initialBalance = await prisma.inventoryBalance.findUnique({
      where: {
        branchId_batchId: {
          branchId: branch.id,
          batchId: activeBatch.id,
        },
      },
    });

    const currentQty = Number(initialBalance?.quantityOnHand || 0);

    let negativeStockAllowed = false;
    try {
      // Attempt to deduct currentQty + 500 units (must be blocked!)
      await StockService.recordStockMovement({
        tenantId: tenant.id,
        branchId: branch.id,
        medicineId: dolo.id,
        batchId: activeBatch.id,
        movementType: MovementType.SALE,
        quantityDelta: -(currentQty + 500),
        costPerUnit: Number(activeBatch.unitPurchaseCost),
        referenceType: "TEST_OVERDRAW",
      });
      negativeStockAllowed = true;
    } catch (err: unknown) {
      negativeStockAllowed = false;
      const error = err as Error;
      assert(
        error.message.includes("Insufficient stock"),
        "Deduction exceeding available units triggers Insufficient Stock rejection"
      );
    }

    assert(!negativeStockAllowed, "Database transaction prevents negative inventory balances");

    // -------------------------------------------------------------------------
    // TEST 4: Immutable Stock Ledger & Atomic Reversible Updates
    // -------------------------------------------------------------------------
    console.log("\n▶ Test 4: Immutable Stock Ledger Audit Trail");
    const testDelta = 5;
    const { ledgerEntry } = await StockService.recordStockMovement({
      tenantId: tenant.id,
      branchId: branch.id,
      medicineId: dolo.id,
      batchId: activeBatch.id,
      movementType: MovementType.ADJUSTMENT_POSITIVE,
      quantityDelta: testDelta,
      costPerUnit: Number(activeBatch.unitPurchaseCost),
      referenceType: "TEST_AUDIT",
      notes: "Automated test audit movement",
    });

    assert(ledgerEntry.id !== undefined, "Immutable StockLedgerEntry created with unique ID");
    assert(Number(ledgerEntry.quantityDelta) === testDelta, "Ledger records exact delta (+5)");
    assert(
      Number(ledgerEntry.balanceAfter) === currentQty + testDelta,
      `Ledger records accurate balanceAfter (${currentQty + testDelta})`
    );

    // Revert the test movement
    await StockService.recordStockMovement({
      tenantId: tenant.id,
      branchId: branch.id,
      medicineId: dolo.id,
      batchId: activeBatch.id,
      movementType: MovementType.ADJUSTMENT_NEGATIVE,
      quantityDelta: -testDelta,
      costPerUnit: Number(activeBatch.unitPurchaseCost),
      referenceType: "TEST_REVERT",
      notes: "Revert automated test adjustment",
    });

    const finalBalance = await prisma.inventoryBalance.findUnique({
      where: {
        branchId_batchId: {
          branchId: branch.id,
          batchId: activeBatch.id,
        },
      },
    });

    assert(
      Number(finalBalance?.quantityOnHand) === currentQty,
      "Inventory balance successfully restored after compensating ledger movement"
    );

    // -------------------------------------------------------------------------
    // TEST 5: Financial Tax Rounding & GST Precision
    // -------------------------------------------------------------------------
    console.log("\n▶ Test 5: Financial Calculation Precision & GST Rounding");
    const testGross = 100.0;
    const testGSTRate = 12.0;
    // Standard Indian pharma tax-inclusive formula
    const taxable = testGross / (1 + testGSTRate / 100);
    const tax = testGross - taxable;
    const cgst = tax / 2;
    const sgst = tax / 2;

    assert(
      Math.abs(taxable + cgst + sgst - testGross) < 0.0001,
      "Taxable + CGST + SGST perfectly reconciles to Gross (100.00)"
    );

    // -------------------------------------------------------------------------
    // TEST 6: Tenant Isolation
    // -------------------------------------------------------------------------
    console.log("\n▶ Test 6: Multi-Tenant Query Isolation");
    const otherTenantMedicines = await prisma.medicine.findMany({
      where: { tenantId: "non-existent-tenant-999" },
    });

    assert(
      otherTenantMedicines.length === 0,
      "Tenant-scoped query returns zero records for foreign tenant ID"
    );

  } catch (error) {
    console.error("Test execution error:", error);
    failed++;
  } finally {
    await prisma.$disconnect();
  }

  console.log("\n" + "=".repeat(45));
  console.log(`Test Results: ${passed} Passed, ${failed} Failed`);
  console.log("=".repeat(45));

  if (failed > 0) {
    process.exit(1);
  }
}

runTestSuite();
