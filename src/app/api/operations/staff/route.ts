import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthContext, hashPassword } from "@/lib/auth";

export async function GET() {
  try {
    const auth = await getAuthContext();
    if (!auth || !auth.tenant) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const staff = await prisma.user.findMany({
      where: { tenantId: auth.tenant.id },
      include: {
        branchAccesses: {
          include: { branch: true, role: true },
        },
      },
      orderBy: { fullName: "asc" },
    });

    return NextResponse.json({ staff });
  } catch (error) {
    console.error("Fetch staff error:", error);
    return NextResponse.json({ error: "Failed to fetch staff" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const auth = await getAuthContext();
    if (!auth || !auth.tenant) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const {
      fullName,
      email,
      phone,
      password = "Pharmacy@12345",
      branchId,
      roleId,
    } = await req.json();

    if (!fullName || !email || !branchId || !roleId) {
      return NextResponse.json(
        { error: "Full Name, Email, Branch, and Role are required." },
        { status: 400 }
      );
    }

    // Check duplicate email
    const existing = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (existing) {
      return NextResponse.json(
        { error: `An account with email "${email}" already exists.` },
        { status: 409 }
      );
    }

    const passwordHash = await hashPassword(password);

    const newUser = await prisma.user.create({
      data: {
        tenantId: auth.tenant.id,
        email: email.toLowerCase().trim(),
        passwordHash,
        fullName: fullName.trim(),
        phone: phone?.trim(),
        status: "ACTIVE",
        branchAccesses: {
          create: {
            branchId,
            roleId,
            isDefault: true,
          },
        },
      },
      include: {
        branchAccesses: {
          include: { branch: true, role: true },
        },
      },
    });

    // Record audit
    await prisma.auditLog.create({
      data: {
        tenantId: auth.tenant.id,
        userId: auth.user.id,
        action: "CREATE",
        entityType: "USER",
        entityId: newUser.id,
        details: JSON.stringify({ email: newUser.email, fullName: newUser.fullName }),
      },
    });

    return NextResponse.json({ success: true, user: newUser });
  } catch (error) {
    console.error("Create staff error:", error);
    return NextResponse.json({ error: "Failed to create staff member" }, { status: 500 });
  }
}
