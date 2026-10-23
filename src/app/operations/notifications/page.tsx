import * as React from "react";
import Link from "next/link";
import { AppLayout } from "@/components/layout/app-layout";
import { requireAuthContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/utils";
import { Bell, AlertTriangle, CalendarX, ArrowRight } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const auth = await requireAuthContext();
  const tenantId = auth.tenant?.id;

  if (!tenantId) {
    return <AppLayout><div>Unauthorized</div></AppLayout>;
  }

  const notifications = await prisma.notification.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
  });

  return (
    <AppLayout>
      <div className="space-y-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            System Alerts & Operational Notifications
          </h1>
          <p className="text-xs text-slate-500">
            Automated alerts for near-expiry medicine lines, minimum stock threshold breaches, and approvals.
          </p>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead>Notification Title</TableHead>
              <TableHead>Message Details</TableHead>
              <TableHead>Timestamp</TableHead>
              <TableHead>Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {notifications.map((n) => (
              <TableRow key={n.id}>
                <TableCell>
                  <Badge
                    variant={
                      n.type === "EXPIRED"
                        ? "danger"
                        : n.type === "NEAR_EXPIRY" || n.type === "LOW_STOCK"
                        ? "warning"
                        : "info"
                    }
                    size="sm"
                  >
                    {n.type}
                  </Badge>
                </TableCell>

                <TableCell className="font-semibold text-slate-900 text-xs">
                  {n.title}
                </TableCell>

                <TableCell className="text-xs text-slate-600">
                  {n.message}
                </TableCell>

                <TableCell className="text-xs text-slate-400 font-mono">
                  {formatDateTime(n.createdAt)}
                </TableCell>

                <TableCell>
                  {n.linkUrl ? (
                    <Link
                      href={n.linkUrl}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-[#0F766E] hover:underline"
                    >
                      <span>Review</span>
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                  ) : (
                    "—"
                  )}
                </TableCell>
              </TableRow>
            ))}

            {notifications.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-slate-400">
                  No unread notifications.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </AppLayout>
  );
}
