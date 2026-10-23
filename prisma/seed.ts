import { PrismaClient, DrugSchedule, BatchStatus, MovementType, POStatus, GRNStatus, InvoiceStatus, PaymentStatus } from "@prisma/client";
import bcrypt from "bcryptjs";
import { SYSTEM_PERMISSIONS, SYSTEM_ROLE_DEFAULTS } from "../src/lib/rbac-definitions";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting database seeding...");

  // 1. Seed System Permissions
  console.log("Seeding system permissions...");
  for (const p of SYSTEM_PERMISSIONS) {
    await prisma.permission.upsert({
      where: { code: p.code },
      update: { name: p.name, module: p.module, description: p.description },
      create: p,
    });
  }

  // 2. Seed Subscription Plans
  console.log("Seeding subscription plans...");
  const starterPlan = await prisma.subscriptionPlan.upsert({
    where: { code: "STARTER" },
    update: {},
    create: {
      name: "Starter Pharmacy",
      code: "STARTER",
      maxBranches: 1,
      maxUsers: 3,
      priceInr: 1499,
      interval: "monthly",
      features: JSON.stringify(["1 Branch", "Up to 3 Staff", "Inventory & POS", "Tax Reports"]),
    },
  });

  const proPlan = await prisma.subscriptionPlan.upsert({
    where: { code: "PRO_CHAIN" },
    update: {},
    create: {
      name: "Pharmacy Chain Pro",
      code: "PRO_CHAIN",
      maxBranches: 5,
      maxUsers: 15,
      priceInr: 4999,
      interval: "monthly",
      features: JSON.stringify([
        "Up to 5 Branches",
        "Up to 15 Staff",
        "Inter-Branch Transfers",
        "Consolidated Reports",
        "Full Procurement & Invoicing",
      ]),
    },
  });

  // 3. Seed Platform Super Admin
  console.log("Seeding platform super admin...");
  const superAdminPassword = await bcrypt.hash("Admin@12345", 10);
  await prisma.user.upsert({
    where: { email: "admin@pharmapulse.io" },
    update: { passwordHash: superAdminPassword, isPlatformAdmin: true, status: "ACTIVE" },
    create: {
      email: "admin@pharmapulse.io",
      passwordHash: superAdminPassword,
      fullName: "Platform Super Admin",
      phone: "+91 9876543210",
      isPlatformAdmin: true,
      status: "ACTIVE",
    },
  });

  // 4. Seed Tenant: Apex MedCare Pharmacy
  console.log("Seeding Apex MedCare Pharmacy tenant...");
  const tenant = await prisma.tenant.upsert({
    where: { slug: "apex-medcare" },
    update: {},
    create: {
      name: "Apex MedCare Pharmacy",
      slug: "apex-medcare",
      legalName: "Apex MedCare Retail & Healthcare Pvt Ltd",
      gstin: "36AAACA1234A1Z5",
      drugLicenseNumber: "TG/HYD/20B/10492, TG/HYD/21B/10493",
      status: "ACTIVE",
      planId: proPlan.id,
    },
  });

  // Business settings
  await prisma.businessSettings.upsert({
    where: { tenantId: tenant.id },
    update: {},
    create: {
      tenantId: tenant.id,
      legalName: "Apex MedCare Retail & Healthcare Pvt Ltd",
      tradeName: "Apex MedCare Pharmacy",
      contactPhone: "+91 40 2345 6789",
      contactEmail: "contact@apexmedcare.com",
      address: "Plot 42, Road No 36, Jubilee Hills",
      state: "Telangana",
      gstin: "36AAACA1234A1Z5",
      drugLicense20B: "TG/HYD/20B/10492",
      drugLicense21B: "TG/HYD/21B/10493",
      currency: "INR",
      fefoAllocation: true,
      allowNegativeStock: false,
      nearExpiryDays: 60,
    },
  });

  // 5. Seed Branches
  console.log("Seeding branches...");
  const branch1 = await prisma.branch.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: "JH-01" } },
    update: {},
    create: {
      tenantId: tenant.id,
      name: "Apex MedCare - Jubilee Hills",
      code: "JH-01",
      address: "Plot 42, Road No 36, Jubilee Hills",
      city: "Hyderabad",
      state: "Telangana",
      pincode: "500033",
      phone: "+91 40 2345 6789",
      email: "jh01@apexmedcare.com",
      gstin: "36AAACA1234A1Z5",
      dlNumber: "TG/HYD/20B/10492",
      isMainBranch: true,
      isActive: true,
    },
  });

  await prisma.branchSettings.upsert({
    where: { branchId: branch1.id },
    update: {},
    create: {
      branchId: branch1.id,
      invoicePrefix: "INV-JH-",
      nextInvoiceNum: 1042,
      receiptPrinter: "80mm_thermal",
      receiptHeader: "Apex MedCare Pharmacy - Jubilee Hills\n24x7 Healthcare Support | Ph: 040-23456789",
      receiptFooter: "Thank you for trusting Apex MedCare! Please consult your doctor for dosage.",
      taxInclusivePOS: true,
    },
  });

  const branch2 = await prisma.branch.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: "MP-02" } },
    update: {},
    create: {
      tenantId: tenant.id,
      name: "Apex MedCare - Madhapur Counter",
      code: "MP-02",
      address: "Shop 12, Cyber Towers Road, Madhapur",
      city: "Hyderabad",
      state: "Telangana",
      pincode: "500081",
      phone: "+91 40 2345 8899",
      email: "mp02@apexmedcare.com",
      gstin: "36AAACA1234A1Z5",
      dlNumber: "TG/HYD/20B/10984",
      isMainBranch: false,
      isActive: true,
    },
  });

  await prisma.branchSettings.upsert({
    where: { branchId: branch2.id },
    update: {},
    create: {
      branchId: branch2.id,
      invoicePrefix: "INV-MP-",
      nextInvoiceNum: 1001,
      receiptPrinter: "80mm_thermal",
      receiptHeader: "Apex MedCare Express - Madhapur",
      receiptFooter: "Get well soon!",
      taxInclusivePOS: true,
    },
  });

  // 6. Seed Tenant Roles & Permissions
  console.log("Seeding roles and permissions...");
  const roleMap: Record<string, string> = {};

  for (const [code, roleDef] of Object.entries(SYSTEM_ROLE_DEFAULTS)) {
    if (code === "SUPER_ADMIN") continue;
    const role = await prisma.role.upsert({
      where: { tenantId_code: { tenantId: tenant.id, code } },
      update: { name: roleDef.name, description: roleDef.description },
      create: {
        tenantId: tenant.id,
        name: roleDef.name,
        code,
        description: roleDef.description,
        isSystemRole: true,
      },
    });
    roleMap[code] = role.id;

    // Link permissions
    for (const permCode of roleDef.permissions) {
      const perm = await prisma.permission.findUnique({ where: { code: permCode } });
      if (perm) {
        await prisma.rolePermission.upsert({
          where: { roleId_permissionId: { roleId: role.id, permissionId: perm.id } },
          update: {},
          create: { roleId: role.id, permissionId: perm.id },
        });
      }
    }
  }

  // 7. Seed Staff Users
  console.log("Seeding staff users...");
  const userPassword = await bcrypt.hash("Pharmacy@12345", 10);

  const ownerUser = await prisma.user.upsert({
    where: { email: "owner@apexmedcare.com" },
    update: { passwordHash: userPassword, fullName: "Dr. Rajesh Varma", status: "ACTIVE" },
    create: {
      tenantId: tenant.id,
      email: "owner@apexmedcare.com",
      passwordHash: userPassword,
      fullName: "Dr. Rajesh Varma",
      phone: "+91 9988776655",
      status: "ACTIVE",
    },
  });

  // Assign Owner to both branches with PHARMACY_OWNER role
  await prisma.userBranchAccess.upsert({
    where: { userId_branchId: { userId: ownerUser.id, branchId: branch1.id } },
    update: { roleId: roleMap["PHARMACY_OWNER"] },
    create: {
      userId: ownerUser.id,
      branchId: branch1.id,
      roleId: roleMap["PHARMACY_OWNER"],
      isDefault: true,
    },
  });

  await prisma.userBranchAccess.upsert({
    where: { userId_branchId: { userId: ownerUser.id, branchId: branch2.id } },
    update: { roleId: roleMap["PHARMACY_OWNER"] },
    create: {
      userId: ownerUser.id,
      branchId: branch2.id,
      roleId: roleMap["PHARMACY_OWNER"],
      isDefault: false,
    },
  });

  const pharmacistUser = await prisma.user.upsert({
    where: { email: "pharmacist@apexmedcare.com" },
    update: { passwordHash: userPassword, fullName: "Kiran Sharma, B.Pharm", status: "ACTIVE" },
    create: {
      tenantId: tenant.id,
      email: "pharmacist@apexmedcare.com",
      passwordHash: userPassword,
      fullName: "Kiran Sharma, B.Pharm",
      phone: "+91 9123456780",
      status: "ACTIVE",
    },
  });

  await prisma.userBranchAccess.upsert({
    where: { userId_branchId: { userId: pharmacistUser.id, branchId: branch1.id } },
    update: { roleId: roleMap["PHARMACIST"] },
    create: {
      userId: pharmacistUser.id,
      branchId: branch1.id,
      roleId: roleMap["PHARMACIST"],
      isDefault: true,
    },
  });

  const cashierUser = await prisma.user.upsert({
    where: { email: "cashier@apexmedcare.com" },
    update: { passwordHash: userPassword, fullName: "Anil Reddy", status: "ACTIVE" },
    create: {
      tenantId: tenant.id,
      email: "cashier@apexmedcare.com",
      passwordHash: userPassword,
      fullName: "Anil Reddy",
      phone: "+91 9876501234",
      status: "ACTIVE",
    },
  });

  await prisma.userBranchAccess.upsert({
    where: { userId_branchId: { userId: cashierUser.id, branchId: branch1.id } },
    update: { roleId: roleMap["CASHIER"] },
    create: {
      userId: cashierUser.id,
      branchId: branch1.id,
      roleId: roleMap["CASHIER"],
      isDefault: true,
    },
  });

  // 8. Seed Vendors
  console.log("Seeding vendors...");
  const vendorSun = await prisma.vendor.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: "VEND-SUN" } },
    update: {},
    create: {
      tenantId: tenant.id,
      code: "VEND-SUN",
      name: "Sun Pharma Distributors Hyderabad",
      contactPerson: "Mahesh Gupta",
      phone: "+91 9440112233",
      email: "mahesh@sundistributors.com",
      address: "15-3-102, Sultan Bazaar",
      city: "Hyderabad",
      state: "Telangana",
      pincode: "500095",
      gstin: "36AABCS1234E1Z8",
      dlNumber: "TG/HYD/20B/08123",
      paymentTermsDays: 30,
      creditLimit: 250000,
      outstandingBalance: 42500,
      status: "ACTIVE",
    },
  });

  const vendorCipla = await prisma.vendor.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: "VEND-CIPLA" } },
    update: {},
    create: {
      tenantId: tenant.id,
      code: "VEND-CIPLA",
      name: "Cipla Medilink Logistics",
      contactPerson: "Srinivas Rao",
      phone: "+91 9885001122",
      email: "orders@medilinkcipla.in",
      address: "Plot 88, IDA Cherlapally",
      city: "Hyderabad",
      state: "Telangana",
      pincode: "500051",
      gstin: "36AACCC5678B1Z2",
      dlNumber: "TG/HYD/20B/09555",
      paymentTermsDays: 21,
      creditLimit: 150000,
      outstandingBalance: 18200,
      status: "ACTIVE",
    },
  });

  // 9. Seed Medicine Categories
  console.log("Seeding medicine categories...");
  const catAnalgesics = await prisma.medicineCategory.upsert({
    where: { tenantId_name: { tenantId: tenant.id, name: "Analgesics & Antipyretics" } },
    update: {},
    create: { tenantId: tenant.id, name: "Analgesics & Antipyretics", description: "Pain relief and fever reduction" },
  });

  const catAntibiotics = await prisma.medicineCategory.upsert({
    where: { tenantId_name: { tenantId: tenant.id, name: "Antibiotics & Anti-infectives" } },
    update: {},
    create: { tenantId: tenant.id, name: "Antibiotics & Anti-infectives", description: "Bacterial infection control" },
  });

  const catGastro = await prisma.medicineCategory.upsert({
    where: { tenantId_name: { tenantId: tenant.id, name: "Gastrointestinal & Antacids" } },
    update: {},
    create: { tenantId: tenant.id, name: "Gastrointestinal & Antacids", description: "Acid reflux and stomach care" },
  });

  const catCardio = await prisma.medicineCategory.upsert({
    where: { tenantId_name: { tenantId: tenant.id, name: "Cardiovascular & Hypertension" } },
    update: {},
    create: { tenantId: tenant.id, name: "Cardiovascular & Hypertension", description: "Blood pressure and heart health" },
  });

  // 10. Seed Medicines & Batches
  console.log("Seeding medicines and batch inventory...");

  const medicineList = [
    {
      name: "Dolo 650mg Tablet",
      genericName: "Paracetamol 650mg",
      brand: "Micro Labs",
      manufacturer: "Micro Labs Ltd",
      sku: "MED-DOLO-650",
      barcode: "8901148203011",
      hsnCode: "3004",
      categoryId: catAnalgesics.id,
      dosageForm: "Tablet",
      packUnit: "Box",
      dispenseUnit: "Strip",
      conversionFactor: 15, // 15 tablets per strip
      drugSchedule: DrugSchedule.OTC,
      prescriptionRequired: false,
      gstRate: 12.0,
      mrp: 33.6,
      salePrice: 31.0,
      purchasePrice: 24.5,
      minStockAlert: 20,
      reorderQty: 100,
      batches: [
        {
          batchNumber: "DL24K01",
          expiryDate: new Date("2027-08-31"),
          unitPurchaseCost: 24.5,
          unitSalePrice: 31.0,
          mrp: 33.6,
          quantity: 140,
          status: BatchStatus.ACTIVE,
          supplierId: vendorSun.id,
        },
        {
          batchNumber: "DL23M09",
          expiryDate: new Date("2026-11-20"), // Expiring within 30 days!
          unitPurchaseCost: 23.0,
          unitSalePrice: 30.0,
          mrp: 32.0,
          quantity: 18,
          status: BatchStatus.ACTIVE,
          supplierId: vendorSun.id,
        },
      ],
    },
    {
      name: "Augmentin 625 Duo Tablet",
      genericName: "Amoxicillin 500mg + Clavulanic Acid 125mg",
      brand: "GSK",
      manufacturer: "GlaxoSmithKline Pharmaceuticals",
      sku: "MED-AUG-625",
      barcode: "8901043001221",
      hsnCode: "3004",
      categoryId: catAntibiotics.id,
      dosageForm: "Tablet",
      packUnit: "Strip",
      dispenseUnit: "Tablet",
      conversionFactor: 10,
      drugSchedule: DrugSchedule.SCHEDULE_H1,
      prescriptionRequired: true,
      gstRate: 12.0,
      mrp: 204.5,
      salePrice: 195.0,
      purchasePrice: 152.0,
      minStockAlert: 15,
      reorderQty: 40,
      batches: [
        {
          batchNumber: "AG625-24F",
          expiryDate: new Date("2027-04-30"),
          unitPurchaseCost: 152.0,
          unitSalePrice: 195.0,
          mrp: 204.5,
          quantity: 65,
          status: BatchStatus.ACTIVE,
          supplierId: vendorCipla.id,
        },
        {
          batchNumber: "AG625-23A",
          expiryDate: new Date("2026-09-15"), // Already EXPIRED
          unitPurchaseCost: 148.0,
          unitSalePrice: 190.0,
          mrp: 200.0,
          quantity: 8,
          status: BatchStatus.EXPIRED,
          supplierId: vendorCipla.id,
        },
      ],
    },
    {
      name: "Pantocid 40mg Tablet",
      genericName: "Pantoprazole 40mg",
      brand: "Sun Pharma",
      manufacturer: "Sun Pharmaceutical Industries Ltd",
      sku: "MED-PNT-40",
      barcode: "8901117105023",
      hsnCode: "3004",
      categoryId: catGastro.id,
      dosageForm: "Tablet",
      packUnit: "Box",
      dispenseUnit: "Strip",
      conversionFactor: 15,
      drugSchedule: DrugSchedule.SCHEDULE_H,
      prescriptionRequired: true,
      gstRate: 12.0,
      mrp: 165.0,
      salePrice: 155.0,
      purchasePrice: 118.0,
      minStockAlert: 10,
      reorderQty: 30,
      batches: [
        {
          batchNumber: "P40-2501",
          expiryDate: new Date("2027-12-31"),
          unitPurchaseCost: 118.0,
          unitSalePrice: 155.0,
          mrp: 165.0,
          quantity: 80,
          status: BatchStatus.ACTIVE,
          supplierId: vendorSun.id,
        },
      ],
    },
    {
      name: "Telma 40mg Tablet",
      genericName: "Telmisartan 40mg",
      brand: "Glenmark",
      manufacturer: "Glenmark Pharmaceuticals",
      sku: "MED-TEL-40",
      barcode: "8904091122345",
      hsnCode: "3004",
      categoryId: catCardio.id,
      dosageForm: "Tablet",
      packUnit: "Box",
      dispenseUnit: "Strip",
      conversionFactor: 30,
      drugSchedule: DrugSchedule.SCHEDULE_H,
      prescriptionRequired: true,
      gstRate: 12.0,
      mrp: 232.0,
      salePrice: 215.0,
      purchasePrice: 165.0,
      minStockAlert: 25,
      reorderQty: 50,
      batches: [
        {
          batchNumber: "TM40-881",
          expiryDate: new Date("2028-02-28"),
          unitPurchaseCost: 165.0,
          unitSalePrice: 215.0,
          mrp: 232.0,
          quantity: 9, // LOW STOCK! Below minStockAlert (25)
          status: BatchStatus.ACTIVE,
          supplierId: vendorSun.id,
        },
      ],
    },
    {
      name: "Azithral 500mg Tablet",
      genericName: "Azithromycin 500mg",
      brand: "Alembic",
      manufacturer: "Alembic Pharmaceuticals Ltd",
      sku: "MED-AZI-500",
      barcode: "8901235678901",
      hsnCode: "3004",
      categoryId: catAntibiotics.id,
      dosageForm: "Tablet",
      packUnit: "Strip",
      dispenseUnit: "Strip",
      conversionFactor: 5,
      drugSchedule: DrugSchedule.SCHEDULE_H1,
      prescriptionRequired: true,
      gstRate: 12.0,
      mrp: 132.5,
      salePrice: 125.0,
      purchasePrice: 94.0,
      minStockAlert: 12,
      reorderQty: 30,
      batches: [
        {
          batchNumber: "AZ500-24B",
          expiryDate: new Date("2027-06-30"),
          unitPurchaseCost: 94.0,
          unitSalePrice: 125.0,
          mrp: 132.5,
          quantity: 42,
          status: BatchStatus.ACTIVE,
          supplierId: vendorCipla.id,
        },
      ],
    },
  ];

  for (const m of medicineList) {
    const medicine = await prisma.medicine.upsert({
      where: { tenantId_sku: { tenantId: tenant.id, sku: m.sku } },
      update: {},
      create: {
        tenantId: tenant.id,
        name: m.name,
        genericName: m.genericName,
        brand: m.brand,
        manufacturer: m.manufacturer,
        sku: m.sku,
        barcode: m.barcode,
        hsnCode: m.hsnCode,
        categoryId: m.categoryId,
        dosageForm: m.dosageForm,
        packUnit: m.packUnit,
        dispenseUnit: m.dispenseUnit,
        conversionFactor: m.conversionFactor,
        drugSchedule: m.drugSchedule,
        prescriptionRequired: m.prescriptionRequired,
        gstRate: m.gstRate,
        mrp: m.mrp,
        salePrice: m.salePrice,
        purchasePrice: m.purchasePrice,
        minStockAlert: m.minStockAlert,
        reorderQty: m.reorderQty,
        isActive: true,
      },
    });

    for (const b of m.batches) {
      const batch = await prisma.medicineBatch.upsert({
        where: {
          tenantId_branchId_medicineId_batchNumber: {
            tenantId: tenant.id,
            branchId: branch1.id,
            medicineId: medicine.id,
            batchNumber: b.batchNumber,
          },
        },
        update: {},
        create: {
          tenantId: tenant.id,
          branchId: branch1.id,
          medicineId: medicine.id,
          batchNumber: b.batchNumber,
          expiryDate: b.expiryDate,
          mrp: b.mrp,
          unitSalePrice: b.unitSalePrice,
          unitPurchaseCost: b.unitPurchaseCost,
          gstRate: m.gstRate,
          status: b.status,
          supplierId: b.supplierId,
        },
      });

      // Update Inventory Balance
      await prisma.inventoryBalance.upsert({
        where: { branchId_batchId: { branchId: branch1.id, batchId: batch.id } },
        update: { quantityOnHand: b.quantity },
        create: {
          tenantId: tenant.id,
          branchId: branch1.id,
          medicineId: medicine.id,
          batchId: batch.id,
          quantityOnHand: b.quantity,
          quantityReserved: 0,
          reorderLevel: m.minStockAlert,
        },
      });

      // Create Initial Stock Ledger Entry
      await prisma.stockLedgerEntry.create({
        data: {
          tenantId: tenant.id,
          branchId: branch1.id,
          medicineId: medicine.id,
          batchId: batch.id,
          movementType: MovementType.PURCHASE_RECEIPT,
          quantityDelta: b.quantity,
          balanceAfter: b.quantity,
          costPerUnit: b.unitPurchaseCost,
          referenceType: "INITIAL_SEED",
          referenceId: "GRN-SEED-01",
          notes: "Initial inventory setup & opening stock",
          createdByUserId: ownerUser.id,
        },
      });
    }
  }

  // 11. Seed a Sample Purchase Order and Goods Receipt
  console.log("Seeding sample purchase order and GRN...");
  const samplePO = await prisma.purchaseOrder.upsert({
    where: { tenantId_poNumber: { tenantId: tenant.id, poNumber: "PO-2026-001" } },
    update: {},
    create: {
      tenantId: tenant.id,
      branchId: branch1.id,
      vendorId: vendorSun.id,
      poNumber: "PO-2026-001",
      expectedDate: new Date("2026-11-01"),
      status: POStatus.COMPLETED,
      subtotal: 12000,
      taxAmount: 1440,
      discountAmount: 200,
      grandTotal: 13240,
      notes: "Emergency monsoon seasonal stock replenishment",
      createdById: ownerUser.id,
    },
  });

  // 12. Seed Sample Invoices & POS Billing
  console.log("Seeding sample sales invoices...");
  const doloMed = await prisma.medicine.findUnique({ where: { tenantId_sku: { tenantId: tenant.id, sku: "MED-DOLO-650" } } });
  const doloBatch = await prisma.medicineBatch.findFirst({ where: { medicineId: doloMed?.id, status: BatchStatus.ACTIVE } });

  if (doloMed && doloBatch) {
    const sampleInvoice = await prisma.salesInvoice.upsert({
      where: {
        tenantId_branchId_invoiceNumber: {
          tenantId: tenant.id,
          branchId: branch1.id,
          invoiceNumber: "INV-JH-1041",
        },
      },
      update: {},
      create: {
        tenantId: tenant.id,
        branchId: branch1.id,
        invoiceNumber: "INV-JH-1041",
        customerName: "Vikram Malhotra",
        customerPhone: "+91 9849012345",
        doctorName: "Dr. B. K. Rao, MD",
        subtotal: 62.0,
        discountAmount: 2.0,
        taxableAmount: 53.57,
        cgstAmount: 3.21,
        sgstAmount: 3.21,
        igstAmount: 0.0,
        roundOff: 0.01,
        grandTotal: 60.0,
        paidAmount: 60.0,
        paymentStatus: PaymentStatus.PAID,
        createdById: cashierUser.id,
      },
    });

    await prisma.salesPayment.create({
      data: {
        salesInvoiceId: sampleInvoice.id,
        method: "UPI",
        amount: 60.0,
        referenceNo: "UPI/2026/09129841",
      },
    });
  }

  // 13. Seed In-app Notifications
  console.log("Seeding notifications...");
  await prisma.notification.createMany({
    data: [
      {
        tenantId: tenant.id,
        branchId: branch1.id,
        title: "Near Expiry Alert",
        message: "Dolo 650mg Batch DL23M09 (18 strips) expires on 20-Nov-2026. Action required.",
        type: "NEAR_EXPIRY",
        isRead: false,
        linkUrl: "/inventory/expiry",
      },
      {
        tenantId: tenant.id,
        branchId: branch1.id,
        title: "Critical Low Stock",
        message: "Telma 40mg Tablet is below threshold (9 strips remaining, min alert 25).",
        type: "LOW_STOCK",
        isRead: false,
        linkUrl: "/inventory/reorder",
      },
      {
        tenantId: tenant.id,
        branchId: branch1.id,
        title: "Quarantine Stock Alert",
        message: "Augmentin 625 Duo Batch AG625-23A is EXPIRED and locked from POS sale.",
        type: "EXPIRED",
        isRead: false,
        linkUrl: "/inventory/expiry",
      },
    ],
  });

  console.log("✅ Database seeding complete!");
}

main()
  .catch((e) => {
    console.error("❌ Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
