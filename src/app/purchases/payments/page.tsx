import * as React from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { requireAuthContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatINR, formatDate } from "@/lib/utils";
import { CreditCard, CheckCircle2 } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function VendorPaymentsPage() {
  const auth = await requireAuthContext();
  const tenantId = auth.tenant?.id;

  if (!tenantId) {
    return <AppLayout><div>Unauthorized</div></AppLayout>;
  }

  const payments = await prisma.vendorPayment.findMany({
    where: { tenantId },
    include: { vendor: true, invoice: true },
    orderBy: { paymentDate: "desc" },
  });

  return (
    <AppLayout>
      <div className="space-y-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Vendor Payments & Disbursals
          </h1>
          <p className="text-xs text-slate-500">
            Audit history of supplier banking settlements, RTGS/NEFT references, and cheque reconciliations.
          </p>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Payment Reference</TableHead>
              <TableHead>Distributor</TableHead>
              <TableHead>Invoice Linked</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Payment Mode</TableHead>
              <TableHead>Bank / UTR Reference</TableHead>
              <TableHead>Settled Amount</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payments.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-mono font-semibold text-slate-900">
                  {p.paymentNumber}
                </TableCell>
                <TableCell className="font-medium text-slate-800 text-xs">
                  {p.vendor.name}
                </TableCell>
                <TableCell className="font-mono text-xs text-slate-600">
                  {p.invoice?.invoiceNumber || "Account Advance"}
                </TableCell>
                <TableCell className="text-xs">{formatDate(p.paymentDate)}</TableCell>
                <TableCell>
                  <Badge variant="neutral" size="sm">
                    {p.paymentMode}
                  </Badge>
                </TableCell>
                <TableCell className="font-mono text-xs text-slate-600">
                  {p.referenceNumber || "—"}
                </TableCell>
                <TableCell className="font-bold text-slate-900 text-xs">
                  {formatINR(p.amount)}
                </TableCell>
                <TableCell>
                  <Badge variant="success" size="sm">
                    CONFIRMED
                  </Badge>
                </TableCell>
              </TableRow>
            ))}

            {payments.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-slate-400">
                  No vendor payments logged yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </AppLayout>
  );
}
