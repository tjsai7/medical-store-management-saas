import * as React from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { requireAuthContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatINR, formatDate } from "@/lib/utils";
import { RotateCcw } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function SalesReturnsPage() {
  const auth = await requireAuthContext();
  const tenantId = auth.tenant?.id;
  const branchId = auth.activeBranch?.id;

  if (!tenantId || !branchId) {
    return <AppLayout><div>Unauthorized</div></AppLayout>;
  }

  const returns = await prisma.salesReturn.findMany({
    where: { tenantId, branchId },
    include: {
      salesInvoice: true,
      createdBy: true,
      lines: { include: { medicine: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <AppLayout>
      <div className="space-y-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Customer Sales Returns & Credit Notes
          </h1>
          <p className="text-xs text-slate-500">
            Audit history of medicine returns, customer refunds, and restocked batch movements.
          </p>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Return #</TableHead>
              <TableHead>Original Invoice #</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Return Reason</TableHead>
              <TableHead>Refund Amount</TableHead>
              <TableHead>Refund Mode</TableHead>
              <TableHead>Handled By</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {returns.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-mono font-semibold text-slate-900">
                  {r.returnNumber}
                </TableCell>
                <TableCell className="font-mono text-xs text-slate-600">
                  {r.salesInvoice.invoiceNumber}
                </TableCell>
                <TableCell className="text-xs text-slate-700">
                  {r.customerName || "Walk-in"}
                </TableCell>
                <TableCell className="text-xs">{formatDate(r.createdAt)}</TableCell>
                <TableCell className="text-xs text-slate-600">{r.reason}</TableCell>
                <TableCell className="font-bold text-slate-900 text-xs">
                  {formatINR(r.refundAmount)}
                </TableCell>
                <TableCell>
                  <Badge variant="neutral" size="sm">
                    {r.refundMode}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs text-slate-600">
                  {r.createdBy.fullName}
                </TableCell>
              </TableRow>
            ))}

            {returns.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-slate-400">
                  No sales returns recorded for this branch.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </AppLayout>
  );
}
