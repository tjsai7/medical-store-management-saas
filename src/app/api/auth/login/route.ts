import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { comparePassword, createSessionToken, setSessionCookie } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      include: {
        tenant: true,
        branchAccesses: {
          include: {
            branch: true,
            role: true,
          },
        },
      },
    });

    if (!user || user.status !== "ACTIVE") {
      return NextResponse.json(
        { error: "Invalid credentials or inactive account" },
        { status: 401 }
      );
    }

    const isMatch = await comparePassword(password, user.passwordHash);
    if (!isMatch) {
      return NextResponse.json(
        { error: "Invalid credentials or inactive account" },
        { status: 401 }
      );
    }

    // Determine initial active branch
    let defaultBranchId: string | null = null;
    if (user.branchAccesses.length > 0) {
      const defaultAccess =
        user.branchAccesses.find((ba) => ba.isDefault) || user.branchAccesses[0];
      defaultBranchId = defaultAccess.branchId;
    }

    const token = createSessionToken({
      userId: user.id,
      email: user.email,
      tenantId: user.tenantId,
      activeBranchId: defaultBranchId,
      isPlatformAdmin: user.isPlatformAdmin,
    });

    await setSessionCookie(token);

    // Record login in audit log
    if (user.tenantId) {
      await prisma.auditLog.create({
        data: {
          tenantId: user.tenantId,
          userId: user.id,
          action: "LOGIN",
          entityType: "USER",
          entityId: user.id,
          details: JSON.stringify({ email: user.email, timestamp: new Date() }),
        },
      });
    }

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        isPlatformAdmin: user.isPlatformAdmin,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred during login" },
      { status: 500 }
    );
  }
}
