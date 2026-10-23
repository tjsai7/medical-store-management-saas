import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthContext } from "@/lib/auth";
import { DrugSchedule, Prisma } from "@prisma/client";

export async function GET(req: Request) {
  try {
    const auth = await getAuthContext();
    if (!auth || !auth.tenant) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";
    const categoryId = searchParams.get("categoryId") || "";
    const schedule = searchParams.get("schedule") || "";

    const where: Prisma.MedicineWhereInput = {
      tenantId: auth.tenant.id,
      ...(search && {
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { genericName: { contains: search, mode: "insensitive" } },
          { brand: { contains: search, mode: "insensitive" } },
          { sku: { contains: search, mode: "insensitive" } },
          { barcode: { contains: search, mode: "insensitive" } },
        ],
      }),
      ...(categoryId && { categoryId }),
      ...(schedule && { drugSchedule: schedule as DrugSchedule }),
    };

    const medicines = await prisma.medicine.findMany({
      where,
      include: {
        category: true,
        batches: {
          where: auth.activeBranch ? { branchId: auth.activeBranch.id } : undefined,
          include: {
            inventoryBalances: true,
          },
        },
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ medicines });
  } catch (error) {
    console.error("Fetch medicines error:", error);
    return NextResponse.json({ error: "Failed to fetch medicines" }, { status: 500 });
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
      genericName,
      brand,
      manufacturer,
      sku,
      barcode,
      hsnCode = "3004",
      categoryId,
      dosageForm = "Tablet",
      packUnit = "Box",
      dispenseUnit = "Strip",
      conversionFactor = 1,
      drugSchedule = "OTC",
      prescriptionRequired = false,
      gstRate = 12,
      mrp,
      salePrice,
      purchasePrice,
      minStockAlert = 20,
      reorderQty = 50,
      storageCondition,
    } = body;

    if (!name || !sku || mrp === undefined || salePrice === undefined || purchasePrice === undefined) {
      return NextResponse.json(
        { error: "Name, SKU, MRP, Sale Price, and Purchase Price are required." },
        { status: 400 }
      );
    }

    // Duplicate detection: SKU or Name + Manufacturer
    const existingSku = await prisma.medicine.findUnique({
      where: {
        tenantId_sku: {
          tenantId: auth.tenant.id,
          sku: sku.trim(),
        },
      },
    });

    if (existingSku) {
      return NextResponse.json(
        { error: `A medicine with SKU "${sku}" already exists.` },
        { status: 409 }
      );
    }

    if (manufacturer) {
      const existingNameAndMfr = await prisma.medicine.findFirst({
        where: {
          tenantId: auth.tenant.id,
          name: { equals: name.trim(), mode: "insensitive" },
          manufacturer: { equals: manufacturer.trim(), mode: "insensitive" },
        },
      });

      if (existingNameAndMfr) {
        return NextResponse.json(
          {
            error: `Possible duplicate: "${name}" by manufacturer "${manufacturer}" is already registered.`,
          },
          { status: 409 }
        );
      }
    }

    const medicine = await prisma.medicine.create({
      data: {
        tenantId: auth.tenant.id,
        name: name.trim(),
        genericName: genericName?.trim(),
        brand: brand?.trim(),
        manufacturer: manufacturer?.trim(),
        sku: sku.trim(),
        barcode: barcode?.trim() || null,
        hsnCode: hsnCode.trim(),
        categoryId: categoryId || null,
        dosageForm,
        packUnit,
        dispenseUnit,
        conversionFactor: Number(conversionFactor) || 1,
        drugSchedule: drugSchedule as DrugSchedule,
        prescriptionRequired: Boolean(prescriptionRequired),
        gstRate: new Prisma.Decimal(gstRate),
        mrp: new Prisma.Decimal(mrp),
        salePrice: new Prisma.Decimal(salePrice),
        purchasePrice: new Prisma.Decimal(purchasePrice),
        minStockAlert: Number(minStockAlert),
        reorderQty: Number(reorderQty),
        storageCondition: storageCondition?.trim(),
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        tenantId: auth.tenant.id,
        userId: auth.user.id,
        action: "CREATE",
        entityType: "MEDICINE",
        entityId: medicine.id,
        details: JSON.stringify({ name: medicine.name, sku: medicine.sku }),
      },
    });

    return NextResponse.json({ success: true, medicine });
  } catch (error) {
    console.error("Create medicine error:", error);
    return NextResponse.json({ error: "Failed to create medicine" }, { status: 500 });
  }
}
