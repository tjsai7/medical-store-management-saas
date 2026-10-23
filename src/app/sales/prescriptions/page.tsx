import * as React from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { requireAuthContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { FileText, ShieldCheck } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function PrescriptionsPage() {
  const auth = await requireAuthContext();
  const tenantId = auth.tenant?.id;
  const branchId = auth.activeBranch?.id;

  if (!tenantId || !branchId) {
    return <AppLayout><div>Unauthorized</div></AppLayout>;
  }

  const prescriptions = await prisma.prescription.findMany({
    where: { tenantId, branchId },
    include: { salesInvoices: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <AppLayout>
      <div className="space-y-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Prescription Management & Digital Records
          </h1>
          <p className="text-xs text-slate-500">
            Regulatory records for Schedule H, H1, and X controlled substances requiring registered medical practitioner prescriptions.
          </p>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Customer</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Prescribing Doctor</TableHead>
              <TableHead>Medical Reg #</TableHead>
              <TableHead>Date Logged</TableHead>
              <TableHead>Sales Invoice Linked</TableHead>
              <TableHead>Compliance Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {prescriptions.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-semibold text-slate-900 text-xs">
                  {p.customerName}
                </TableCell>
                <TableCell className="text-xs font-mono text-slate-600">
                  {p.customerPhone || "—"}
                </TableCell>
                <TableCell className="text-xs font-medium text-slate-800">
                  {p.doctorName}
                </TableCell>
                <TableCell className="text-xs font-mono text-slate-600">
                  {p.doctorRegNumber || "N/A"}
                </TableCell>
                <TableCell className="text-xs">{formatDate(p.createdAt)}</TableCell>
                <TableCell className="font-mono text-xs text-slate-700">
                  {p.salesInvoices[0]?.invoiceNumber || "POS Linked"}
                </TableCell>
                <TableCell>
                  <Badge variant="success" size="sm">
                    {p.verificationStatus}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}

            {prescriptions.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-slate-400">
                  <div className="flex flex-col items-center justify-center space-y-2">
                    <FileText className="h-8 w-8 text-slate-300" />
                    <p className="font-semibold text-slate-600">No Prescriptions Filed Yet</p>
                    <p className="text-xs text-slate-400">
                      Doctor details captured during POS dispensing are automatically indexed here.
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
