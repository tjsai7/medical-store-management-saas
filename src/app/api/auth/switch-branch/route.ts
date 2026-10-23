import { NextResponse } from "next/server";
import { getSession, createSessionToken, setSessionCookie } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { branchId } = await req.json();
    if (!branchId) {
      return NextResponse.json({ error: "Branch ID is required" }, { status: 400 });
    }

    // Verify user has access to this branch
    const hasAccess = await prisma.userBranchAccess.findFirst({
      where: {
        userId: session.userId,
        branchId,
      },
    });

    if (!hasAccess && !session.isPlatformAdmin) {
      return NextResponse.json(
        { error: "You do not have authorization for this branch" },
        { status: 403 }
      );
    }

    // Reissue token with new activeBranchId
    const newToken = createSessionToken({
      userId: session.userId,
      email: session.email,
      tenantId: session.tenantId,
      activeBranchId: branchId,
      isPlatformAdmin: session.isPlatformAdmin,
    });

    await setSessionCookie(newToken);

    return NextResponse.json({ success: true, activeBranchId: branchId });
  } catch (error) {
    console.error("Switch branch error:", error);
    return NextResponse.json({ error: "Failed to switch branch" }, { status: 500 });
  }
}
