import * as React from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { requireAuthContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/utils";
import { ShieldAlert } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AuditLogsPage() {
  const auth = await requireAuthContext();
  const tenantId = auth.tenant?.id;

  if (!tenantId) {
    return <AppLayout><div>Unauthorized</div></AppLayout>;
  }

  const logs = await prisma.auditLog.findMany({
    where: { tenantId },
    include: { user: true },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <AppLayout>
      <div className="space-y-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            System Audit & Governance Trail
          </h1>
          <p className="text-xs text-slate-500">
            Immutable security log recording administrative actions, master data mutations, stock adjustments, and billing authorizations.
          </p>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Timestamp</TableHead>
              <TableHead>User / Actor</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Entity Type</TableHead>
              <TableHead>Entity ID</TableHead>
              <TableHead>Audit Payload</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.map((log) => (
              <TableRow key={log.id}>
                <TableCell className="font-mono text-xs text-slate-500">
                  {formatDateTime(log.createdAt)}
                </TableCell>
                <TableCell className="text-xs font-semibold text-slate-800">
                  {log.user?.fullName || "System Admin"}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={
                      log.action === "DELETE" || log.action === "VOID"
                        ? "danger"
                        : log.action === "CREATE"
                        ? "success"
                        : "info"
                    }
                    size="sm"
                  >
                    {log.action}
                  </Badge>
                </TableCell>
                <TableCell className="font-mono text-xs text-slate-600">
                  {log.entityType}
                </TableCell>
                <TableCell className="font-mono text-xs text-slate-400">
                  {log.entityId.slice(0, 12)}...
                </TableCell>
                <TableCell className="text-xs font-mono text-slate-600 max-w-xs truncate">
                  {log.details || "—"}
                </TableCell>
              </TableRow>
            ))}

            {logs.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-slate-400">
                  No audit trail recorded.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </AppLayout>
  );
}
