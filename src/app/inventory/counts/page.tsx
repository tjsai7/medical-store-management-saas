import * as React from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { requireAuthContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import { ClipboardCheck, Plus, CheckCircle2 } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function StockCountsPage() {
  const auth = await requireAuthContext();
  const tenantId = auth.tenant?.id;
  const branchId = auth.activeBranch?.id;

  if (!tenantId || !branchId) {
    return <AppLayout><div>Unauthorized</div></AppLayout>;
  }

  const stockCounts = await prisma.stockCount.findMany({
    where: { tenantId, branchId },
    include: {
      countedBy: true,
      lines: {
        include: { medicine: true, batch: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <AppLayout>
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              Physical Stock Count Sessions
            </h1>
            <p className="text-xs text-slate-500">
              Conduct periodic physical inventory counts, detect shelf shortages/excesses, and post verified reconciliations.
            </p>
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Session #</TableHead>
              <TableHead>Title / Description</TableHead>
              <TableHead>Count Date</TableHead>
              <TableHead>Audited Items</TableHead>
              <TableHead>Auditor</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {stockCounts.map((sc) => (
              <TableRow key={sc.id}>
                <TableCell className="font-mono font-semibold text-slate-900">
                  {sc.countNumber}
                </TableCell>
                <TableCell className="text-xs font-medium text-slate-800">
                  {sc.title}
                </TableCell>
                <TableCell className="text-xs">{formatDate(sc.createdAt)}</TableCell>
                <TableCell className="text-xs">
                  {sc.lines.length} {sc.lines.length === 1 ? "Line" : "Lines"}
                </TableCell>
                <TableCell className="text-xs text-slate-600">
                  {sc.countedBy.fullName}
                </TableCell>
                <TableCell>
                  <Badge variant={sc.status === "APPROVED" ? "success" : "info"} size="sm">
                    {sc.status}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}

            {stockCounts.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-10 text-slate-400">
                  <div className="flex flex-col items-center justify-center space-y-2">
                    <ClipboardCheck className="h-8 w-8 text-slate-300" />
                    <p className="font-semibold text-slate-600">No Active Count Sessions</p>
                    <p className="text-xs text-slate-400">
                      Physical count sessions scheduled will appear here. Adjustments can also be posted directly from the Adjustments tab.
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </AppLayout>
  );
}
