import * as React from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { requireAuthContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatINR, formatDate } from "@/lib/utils";
import { RotateCcw } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function PurchaseReturnsPage() {
  const auth = await requireAuthContext();
  const tenantId = auth.tenant?.id;
  const branchId = auth.activeBranch?.id;

  if (!tenantId || !branchId) {
    return <AppLayout><div>Unauthorized</div></AppLayout>;
  }

  const returns = await prisma.purchaseReturn.findMany({
    where: { tenantId, branchId },
    include: {
      vendor: true,
      lines: { include: { medicine: true } },
    },
    orderBy: { returnDate: "desc" },
  });

  return (
    <AppLayout>
      <div className="space-y-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Purchase Returns & Debit Notes
          </h1>
          <p className="text-xs text-slate-500">
            Stock returns to pharmaceutical distributors for damaged, near-expiry, or short-supplied batches.
          </p>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Return #</TableHead>
              <TableHead>Distributor</TableHead>
              <TableHead>Return Date</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Debit Note / Credit Note</TableHead>
              <TableHead>Returned Amount</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {returns.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-mono font-semibold text-slate-900">
                  {r.returnNumber}
                </TableCell>
                <TableCell className="font-medium text-slate-800 text-xs">
                  {r.vendor.name}
                </TableCell>
                <TableCell className="text-xs">{formatDate(r.returnDate)}</TableCell>
                <TableCell className="text-xs text-slate-600">{r.reason}</TableCell>
                <TableCell className="font-mono text-xs text-slate-600">
                  {r.creditNoteNumber || "Pending CN"}
                </TableCell>
                <TableCell className="font-bold text-slate-900 text-xs">
                  {formatINR(r.totalAmount)}
                </TableCell>
                <TableCell>
                  <Badge variant="success" size="sm">
                    {r.status}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}

            {returns.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-slate-400">
                  No purchase returns recorded for this branch.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </AppLayout>
  );
}
