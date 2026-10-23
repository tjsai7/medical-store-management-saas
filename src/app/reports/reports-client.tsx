"use client";

import * as React from "react";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { KPICard } from "@/components/ui/kpi-card";
import { formatINR, formatDate, formatDateTime } from "@/lib/utils";
import {
  Download,
  Boxes,
  TrendingUp,
  Receipt,
  FileSpreadsheet,
} from "lucide-react";

interface StockBalanceItem {
  medicineName: string;
  sku: string;
  categoryName: string;
  batchNumber: string;
  expiryDate: string;
  quantityOnHand: number;
  unitPurchaseCost: number;
  mrp: number;
  totalCost: number;
  totalRetailValue: number;
}

interface SaleRecordItem {
  invoiceNumber: string;
  date: string;
  customerName: string;
  taxableAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  revenue: number;
  totalCost: number;
  grossMargin: number;
  marginPercent: number;
}

interface LedgerItem {
  timestamp: string;
  medicineName: string;
  batchNumber: string;
  movementType: string;
  quantityDelta: number;
  balanceAfter: number;
  costPerUnit: number;
  referenceType: string;
  referenceId: string;
  notes: string;
  actorName: string;
}

interface VendorItem {
  id: string;
  name: string;
  code: string;
  phone: string;
  gstin: string;
  paymentTermsDays: number;
  outstandingBalance: number;
  status: string;
}

export function ReportsClient({
  branchName,
  stockBalances,
  salesRecords,
  ledgerEntries,
  vendors,
}: {
  branchName: string;
  stockBalances: StockBalanceItem[];
  salesRecords: SaleRecordItem[];
  ledgerEntries: LedgerItem[];
  vendors: VendorItem[];
}) {
  const [activeTab, setActiveTab] = React.useState<"VALUATION" | "SALES" | "TAX" | "LEDGER" | "VENDORS">("VALUATION");

  // Summary Aggregates
  const totalValuationCost = stockBalances.reduce((sum, s) => sum + s.totalCost, 0);
  const totalRetailMRP = stockBalances.reduce((sum, s) => sum + s.totalRetailValue, 0);
  const totalRevenue = salesRecords.reduce((sum, s) => sum + s.revenue, 0);
  const totalGrossMargin = salesRecords.reduce((sum, s) => sum + s.grossMargin, 0);
  const totalTaxCollected = salesRecords.reduce((sum, s) => sum + s.cgstAmount + s.sgstAmount, 0);

  const exportCurrentTabCSV = () => {
    let headers: string[] = [];
    let rows: (string | number)[][] = [];
    const filename = `report_${activeTab.toLowerCase()}_${new Date().toISOString().slice(0, 10)}.csv`;

    if (activeTab === "VALUATION") {
      headers = ["Medicine", "SKU", "Batch", "Expiry", "On Hand", "Unit Cost", "MRP", "Valuation (Cost)", "Retail Value"];
      rows = stockBalances.map((s) => [
        `"${s.medicineName}"`,
        s.sku,
        s.batchNumber,
        formatDate(s.expiryDate),
        s.quantityOnHand,
        s.unitPurchaseCost,
        s.mrp,
        s.totalCost.toFixed(2),
        s.totalRetailValue.toFixed(2),
      ]);
    } else if (activeTab === "SALES") {
      headers = ["Invoice #", "Date", "Customer", "Revenue", "Cost", "Gross Profit", "Margin %"];
      rows = salesRecords.map((s) => [
        s.invoiceNumber,
        formatDate(s.date),
        `"${s.customerName}"`,
        s.revenue.toFixed(2),
        s.totalCost.toFixed(2),
        s.grossMargin.toFixed(2),
        `${s.marginPercent.toFixed(1)}%`,
      ]);
    } else if (activeTab === "TAX") {
      headers = ["Invoice #", "Date", "Taxable Value", "CGST (50%)", "SGST (50%)", "Total GST", "Invoice Total"];
      rows = salesRecords.map((s) => [
        s.invoiceNumber,
        formatDate(s.date),
        s.taxableAmount.toFixed(2),
        s.cgstAmount.toFixed(2),
        s.sgstAmount.toFixed(2),
        (s.cgstAmount + s.sgstAmount).toFixed(2),
        s.revenue.toFixed(2),
      ]);
    } else if (activeTab === "LEDGER") {
      headers = ["Timestamp", "Medicine", "Batch", "Movement Type", "Quantity Delta", "Balance After", "Cost/Unit", "Ref ID", "Actor"];
      rows = ledgerEntries.map((l) => [
        l.timestamp,
        `"${l.medicineName}"`,
        l.batchNumber,
        l.movementType,
        l.quantityDelta,
        l.balanceAfter,
        l.costPerUnit,
        l.referenceId,
        `"${l.actorName}"`,
      ]);
    } else if (activeTab === "VENDORS") {
      headers = ["Vendor Name", "Code", "Phone", "GSTIN", "Payment Terms", "Outstanding Balance", "Status"];
      rows = vendors.map((v) => [
        `"${v.name}"`,
        v.code,
        v.phone,
        v.gstin,
        `${v.paymentTermsDays} Days`,
        v.outstandingBalance.toFixed(2),
        v.status,
      ]);
    }

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Financial & Operational Reports
          </h1>
          <p className="text-xs text-slate-500">
            Real-time, permission-filtered reports backed by immutable database transactions for{" "}
            <span className="font-semibold text-slate-700">{branchName}</span>.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={exportCurrentTabCSV}>
          <Download className="h-3.5 w-3.5" />
          <span>Export Current Report (CSV)</span>
        </Button>
      </div>

      {/* Top Metrics Cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <KPICard
          title="Stock Cost Valuation"
          value={formatINR(totalValuationCost)}
          subtitle="Acquisition basis"
          icon={Boxes}
        />
        <KPICard
          title="Stock Retail (MRP)"
          value={formatINR(totalRetailMRP)}
          subtitle="Estimated shelf value"
          icon={TrendingUp}
          variant="info"
        />
        <KPICard
          title="Total Sales Revenue"
          value={formatINR(totalRevenue)}
          subtitle={`${salesRecords.length} invoices settled`}
          icon={Receipt}
          variant="success"
        />
        <KPICard
          title="Gross Profit Margin"
          value={formatINR(totalGrossMargin)}
          subtitle={totalRevenue > 0 ? `${((totalGrossMargin / totalRevenue) * 100).toFixed(1)}% Gross Margin` : "—"}
          icon={TrendingUp}
          variant="success"
        />
        <KPICard
          title="GST Collected"
          value={formatINR(totalTaxCollected)}
          subtitle="GSTR-1 output tax"
          icon={FileSpreadsheet}
          variant="default"
        />
      </div>

      {/* Report Category Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 overflow-x-auto pb-1">
        {[
          { id: "VALUATION", label: "Stock Valuation" },
          { id: "SALES", label: "Sales & Gross Margin" },
          { id: "TAX", label: "GST Tax Breakdown (GSTR-1)" },
          { id: "LEDGER", label: "Stock Movement Ledger" },
          { id: "VENDORS", label: "Vendor Payables" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as "VALUATION" | "SALES" | "TAX" | "LEDGER" | "VENDORS")}
            className={`px-3.5 py-2 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors cursor-pointer ${
              activeTab === tab.id
                ? "border-[#0F766E] text-[#0F766E]"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab 1: Valuation */}
      {activeTab === "VALUATION" && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Medicine</TableHead>
              <TableHead>Batch #</TableHead>
              <TableHead>Expiry Date</TableHead>
              <TableHead>Quantity on Hand</TableHead>
              <TableHead>Unit Cost</TableHead>
              <TableHead>MRP</TableHead>
              <TableHead>Total Cost (Valuation)</TableHead>
              <TableHead>Total Retail Value</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {stockBalances.map((s, i) => (
              <TableRow key={i}>
                <TableCell className="font-semibold text-slate-900 text-xs">
                  {s.medicineName}
                </TableCell>
                <TableCell className="font-mono text-xs">{s.batchNumber}</TableCell>
                <TableCell className="text-xs">{formatDate(s.expiryDate)}</TableCell>
                <TableCell className="font-bold text-slate-900 text-xs">{s.quantityOnHand}</TableCell>
                <TableCell className="text-xs">{formatINR(s.unitPurchaseCost)}</TableCell>
                <TableCell className="text-xs">{formatINR(s.mrp)}</TableCell>
                <TableCell className="font-bold text-teal-800 text-xs">{formatINR(s.totalCost)}</TableCell>
                <TableCell className="font-semibold text-slate-700 text-xs">{formatINR(s.totalRetailValue)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Tab 2: Sales & Margin */}
      {activeTab === "SALES" && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice #</TableHead>
              <TableHead>Settled Date</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Billed Revenue</TableHead>
              <TableHead>Inventory Cost</TableHead>
              <TableHead>Gross Margin (₹)</TableHead>
              <TableHead>Gross Margin %</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {salesRecords.map((s, i) => (
              <TableRow key={i}>
                <TableCell className="font-mono font-bold text-slate-900 text-xs">{s.invoiceNumber}</TableCell>
                <TableCell className="text-xs">{formatDate(s.date)}</TableCell>
                <TableCell className="text-xs">{s.customerName}</TableCell>
                <TableCell className="font-semibold text-slate-900 text-xs">{formatINR(s.revenue)}</TableCell>
                <TableCell className="text-xs text-slate-500">{formatINR(s.totalCost)}</TableCell>
                <TableCell className="font-bold text-emerald-700 text-xs">{formatINR(s.grossMargin)}</TableCell>
                <TableCell className="text-xs font-semibold text-emerald-800">{s.marginPercent.toFixed(1)}%</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Tab 3: Tax Reports */}
      {activeTab === "TAX" && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice #</TableHead>
              <TableHead>Invoice Date</TableHead>
              <TableHead>Taxable Amount (₹)</TableHead>
              <TableHead>CGST (Intrastate 50%)</TableHead>
              <TableHead>SGST (Intrastate 50%)</TableHead>
              <TableHead>Total GST (Output Tax)</TableHead>
              <TableHead>Invoice Grand Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {salesRecords.map((s, i) => (
              <TableRow key={i}>
                <TableCell className="font-mono font-bold text-slate-900 text-xs">{s.invoiceNumber}</TableCell>
                <TableCell className="text-xs">{formatDate(s.date)}</TableCell>
                <TableCell className="text-xs font-semibold text-slate-800">{formatINR(s.taxableAmount)}</TableCell>
                <TableCell className="text-xs text-slate-600">{formatINR(s.cgstAmount)}</TableCell>
                <TableCell className="text-xs text-slate-600">{formatINR(s.sgstAmount)}</TableCell>
                <TableCell className="font-bold text-teal-800 text-xs">{formatINR(s.cgstAmount + s.sgstAmount)}</TableCell>
                <TableCell className="font-bold text-slate-900 text-xs">{formatINR(s.revenue)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Tab 4: Ledger Audit */}
      {activeTab === "LEDGER" && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Timestamp</TableHead>
              <TableHead>Medicine</TableHead>
              <TableHead>Batch #</TableHead>
              <TableHead>Movement Type</TableHead>
              <TableHead>Delta</TableHead>
              <TableHead>Balance After</TableHead>
              <TableHead>Unit Cost</TableHead>
              <TableHead>Reference / Transaction</TableHead>
              <TableHead>Acting User</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ledgerEntries.map((l, i) => {
              const isPositive = l.quantityDelta > 0;
              return (
                <TableRow key={i}>
                  <TableCell className="font-mono text-xs text-slate-500">{formatDateTime(l.timestamp)}</TableCell>
                  <TableCell className="font-semibold text-slate-900 text-xs">{l.medicineName}</TableCell>
                  <TableCell className="font-mono text-xs">{l.batchNumber}</TableCell>
                  <TableCell>
                    <Badge variant={isPositive ? "success" : "danger"} size="sm">
                      {l.movementType.replace(/_/g, " ")}
                    </Badge>
                  </TableCell>
                  <TableCell className={`font-bold text-xs ${isPositive ? "text-emerald-700" : "text-red-600"}`}>
                    {isPositive ? `+${l.quantityDelta}` : l.quantityDelta}
                  </TableCell>
                  <TableCell className="font-bold text-slate-900 text-xs">{l.balanceAfter}</TableCell>
                  <TableCell className="text-xs">{formatINR(l.costPerUnit)}</TableCell>
                  <TableCell className="text-xs text-slate-600 font-mono">{l.referenceId}</TableCell>
                  <TableCell className="text-xs text-slate-600">{l.actorName}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      {/* Tab 5: Vendor Payables */}
      {activeTab === "VENDORS" && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Distributor</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Contact Phone</TableHead>
              <TableHead>GSTIN</TableHead>
              <TableHead>Payment Terms</TableHead>
              <TableHead>Outstanding Payable Balance</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {vendors.map((v) => (
              <TableRow key={v.id}>
                <TableCell className="font-semibold text-slate-900 text-xs">{v.name}</TableCell>
                <TableCell className="font-mono text-xs">{v.code}</TableCell>
                <TableCell className="text-xs">{v.phone}</TableCell>
                <TableCell className="font-mono text-xs">{v.gstin}</TableCell>
                <TableCell className="text-xs">{v.paymentTermsDays} Days Net</TableCell>
                <TableCell className="font-bold text-red-600 text-xs">{formatINR(v.outstandingBalance)}</TableCell>
                <TableCell>
                  <Badge variant="success" size="sm">
                    {v.status}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
