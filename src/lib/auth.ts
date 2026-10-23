import { cookies } from "next/headers";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

const SESSION_COOKIE = "pharma_session";
const SECRET = process.env.SESSION_SECRET || "default_medical_store_fallback_secret_32_chars";

export interface SessionPayload {
  userId: string;
  email: string;
  tenantId: string | null;
  activeBranchId: string | null;
  isPlatformAdmin: boolean;
  exp: number;
}

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export function comparePassword(plain: string, hashed: string): Promise<boolean> {
  return bcrypt.compare(plain, hashed);
}

export function createSessionToken(payload: Omit<SessionPayload, "exp">): string {
  const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7; // 7 days
  const data: SessionPayload = { ...payload, exp };
  const encoded = Buffer.from(JSON.stringify(data)).toString("base64url");
  const signature = crypto.createHmac("sha256", SECRET).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

export function verifySessionToken(token: string): SessionPayload | null {
  try {
    const [encoded, signature] = token.split(".");
    if (!encoded || !signature) return null;

    const expectedSig = crypto.createHmac("sha256", SECRET).update(encoded).digest("base64url");
    if (signature !== expectedSig) return null;

    const decoded: SessionPayload = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf-8")
    );

    if (decoded.exp < Math.floor(Date.now() / 1000)) return null;

    return decoded;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export async function setSessionCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export interface AuthContext {
  user: {
    id: string;
    email: string;
    fullName: string;
    isPlatformAdmin: boolean;
    status: string;
  };
  tenant: {
    id: string;
    name: string;
    slug: string;
    legalName: string;
    gstin?: string | null;
  } | null;
  activeBranch: {
    id: string;
    name: string;
    code: string;
    isMainBranch: boolean;
  } | null;
  branches: Array<{
    id: string;
    name: string;
    code: string;
    isMainBranch: boolean;
  }>;
  role: {
    id: string;
    name: string;
    code: string;
  } | null;
  permissions: string[];
}

export async function getAuthContext(): Promise<AuthContext | null> {
  const session = await getSession();
  if (!session) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    include: {
      tenant: true,
      branchAccesses: {
        include: {
          branch: true,
          role: {
            include: {
              permissions: {
                include: {
                  permission: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!user || user.status !== "ACTIVE") return null;

  // Platform super admins
  if (user.isPlatformAdmin) {
    return {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        isPlatformAdmin: true,
        status: user.status,
      },
      tenant: null,
      activeBranch: null,
      branches: [],
      role: {
        id: "platform-super-admin",
        name: "Platform Super Admin",
        code: "SUPER_ADMIN",
      },
      permissions: ["platform:superadmin"],
    };
  }

  if (!user.tenant) return null;

  const branches = user.branchAccesses.map((ba) => ({
    id: ba.branch.id,
    name: ba.branch.name,
    code: ba.branch.code,
    isMainBranch: ba.branch.isMainBranch,
  }));

  // Resolve active branch
  let activeBranchAccess = user.branchAccesses.find(
    (ba) => ba.branchId === session.activeBranchId
  );
  if (!activeBranchAccess && user.branchAccesses.length > 0) {
    activeBranchAccess =
      user.branchAccesses.find((ba) => ba.isDefault) || user.branchAccesses[0];
  }

  const activeBranch = activeBranchAccess
    ? {
        id: activeBranchAccess.branch.id,
        name: activeBranchAccess.branch.name,
        code: activeBranchAccess.branch.code,
        isMainBranch: activeBranchAccess.branch.isMainBranch,
      }
    : null;

  const role = activeBranchAccess?.role
    ? {
        id: activeBranchAccess.role.id,
        name: activeBranchAccess.role.name,
        code: activeBranchAccess.role.code,
      }
    : null;

  const permissions =
    activeBranchAccess?.role.permissions.map((p) => p.permission.code) ?? [];

  return {
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      isPlatformAdmin: false,
      status: user.status,
    },
    tenant: {
      id: user.tenant.id,
      name: user.tenant.name,
      slug: user.tenant.slug,
      legalName: user.tenant.legalName,
      gstin: user.tenant.gstin,
    },
    activeBranch,
    branches,
    role,
    permissions,
  };
}

export async function requireAuthContext(): Promise<AuthContext> {
  const ctx = await getAuthContext();
  if (!ctx) {
    throw new Error("UNAUTHORIZED");
  }
  return ctx;
}
