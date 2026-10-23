import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthContext } from "@/lib/auth";
import { BatchStatus } from "@prisma/client";

export async function GET(req: Request) {
  try {
    const auth = await getAuthContext();
    if (!auth || !auth.tenant) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const medicineId = searchParams.get("medicineId");
    const status = searchParams.get("status");

    const batches = await prisma.medicineBatch.findMany({
      where: {
        tenantId: auth.tenant.id,
        ...(auth.activeBranch && { branchId: auth.activeBranch.id }),
        ...(medicineId && { medicineId }),
        ...(status && { status: status as BatchStatus }),
      },
      include: {
        medicine: true,
        supplier: true,
        inventoryBalances: true,
      },
      orderBy: { expiryDate: "asc" },
    });

    return NextResponse.json({ batches });
  } catch (error) {
    console.error("Fetch batches error:", error);
    return NextResponse.json({ error: "Failed to fetch batches" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const auth = await getAuthContext();
    if (!auth || !auth.tenant) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { batchId, status } = await req.json();

    if (!batchId || !status) {
      return NextResponse.json({ error: "batchId and status are required" }, { status: 400 });
    }

    const batch = await prisma.medicineBatch.findFirst({
      where: { id: batchId, tenantId: auth.tenant.id },
    });

    if (!batch) {
      return NextResponse.json({ error: "Batch not found" }, { status: 404 });
    }

    const updated = await prisma.medicineBatch.update({
      where: { id: batchId },
      data: { status: status as BatchStatus },
    });

    // Record audit
    await prisma.auditLog.create({
      data: {
        tenantId: auth.tenant.id,
        userId: auth.user.id,
        action: "UPDATE",
        entityType: "BATCH",
        entityId: batchId,
        details: JSON.stringify({
          batchNumber: batch.batchNumber,
          oldStatus: batch.status,
          newStatus: status,
        }),
      },
    });

    return NextResponse.json({ success: true, batch: updated });
  } catch (error) {
    console.error("Update batch status error:", error);
    return NextResponse.json({ error: "Failed to update batch status" }, { status: 500 });
  }
}
