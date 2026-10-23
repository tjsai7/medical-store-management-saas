import * as React from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { requireAuthContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatINR, formatDateTime } from "@/lib/utils";
import { ReceiptText, Printer } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function SalesInvoicesPage() {
  const auth = await requireAuthContext();
  const tenantId = auth.tenant?.id;
  const branchId = auth.activeBranch?.id;

  if (!tenantId || !branchId) {
    return <AppLayout><div>Unauthorized</div></AppLayout>;
  }

  const invoices = await prisma.salesInvoice.findMany({
    where: { tenantId, branchId },
    include: {
      createdBy: true,
      lines: { include: { medicine: true, batch: true } },
      payments: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <AppLayout>
      <div className="space-y-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Sales Invoices & Receipts
          </h1>
          <p className="text-xs text-slate-500">
            Auditable log of sequential customer invoices issued at{" "}
            <span className="font-semibold text-slate-700">{auth.activeBranch?.name}</span>.
          </p>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice #</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Prescriber</TableHead>
              <TableHead>Date & Time</TableHead>
              <TableHead>Taxable (₹)</TableHead>
              <TableHead>GST (CGST+SGST)</TableHead>
              <TableHead>Grand Total</TableHead>
              <TableHead>Billed By</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.map((inv) => (
              <TableRow key={inv.id}>
                <TableCell className="font-mono font-bold text-slate-900">
                  {inv.invoiceNumber}
                </TableCell>

                <TableCell className="text-xs">
                  <p className="font-medium text-slate-900">{inv.customerName}</p>
                  <p className="text-slate-400 font-mono text-[11px]">{inv.customerPhone || "—"}</p>
                </TableCell>

                <TableCell className="text-xs text-slate-600">
                  {inv.doctorName ? (
                    <div>
                      <p className="font-medium text-slate-800">{inv.doctorName}</p>
                      <p className="text-[10px] text-slate-400">{inv.doctorRegNumber || "Reg N/A"}</p>
                    </div>
                  ) : (
                    "—"
                  )}
                </TableCell>

                <TableCell className="text-xs text-slate-600">
                  {formatDateTime(inv.createdAt)}
                </TableCell>

                <TableCell className="text-xs text-slate-600">
                  {formatINR(inv.taxableAmount)}
                </TableCell>

                <TableCell className="text-xs text-slate-600">
                  {formatINR(Number(inv.cgstAmount) + Number(inv.sgstAmount))}
                </TableCell>

                <TableCell className="font-bold text-slate-900 text-xs">
                  {formatINR(inv.grandTotal)}
                </TableCell>

                <TableCell className="text-xs text-slate-600">
                  {inv.createdBy.fullName}
                </TableCell>

                <TableCell>
                  <Badge variant={inv.isVoid ? "danger" : "success"} size="sm">
                    {inv.isVoid ? "VOIDED" : inv.paymentStatus}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}

            {invoices.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-slate-400">
                  No sales invoices recorded yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </AppLayout>
  );
}
