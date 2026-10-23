"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { formatINR } from "@/lib/utils";
import { Plus, Search, Filter, Download, Pill, AlertCircle } from "lucide-react";

interface MedicineItem {
  id: string;
  name: string;
  genericName?: string | null;
  brand?: string | null;
  manufacturer?: string | null;
  sku: string;
  barcode?: string | null;
  hsnCode: string;
  categoryName: string;
  dosageForm: string;
  packUnit: string;
  dispenseUnit: string;
  conversionFactor: number;
  drugSchedule: string;
  prescriptionRequired: boolean;
  gstRate: number;
  mrp: number;
  salePrice: number;
  purchasePrice: number;
  minStockAlert: number;
  reorderQty: number;
  isActive: boolean;
  currentStock: number;
}

export function MedicinesClient({
  initialMedicines,
  categories,
}: {
  initialMedicines: MedicineItem[];
  categories: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [medicines, setMedicines] = React.useState<MedicineItem[]>(initialMedicines);
  const [search, setSearch] = React.useState("");
  const [categoryFilter, setCategoryFilter] = React.useState("ALL");
  const [scheduleFilter, setScheduleFilter] = React.useState("ALL");
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [formError, setFormError] = React.useState("");

  // Form State
  const [formData, setFormData] = React.useState({
    name: "",
    genericName: "",
    brand: "",
    manufacturer: "",
    sku: "",
    barcode: "",
    hsnCode: "3004",
    categoryId: categories[0]?.id || "",
    dosageForm: "Tablet",
    packUnit: "Box",
    dispenseUnit: "Strip",
    conversionFactor: 10,
    drugSchedule: "OTC",
    prescriptionRequired: false,
    gstRate: 12,
    mrp: "",
    salePrice: "",
    purchasePrice: "",
    minStockAlert: 20,
    reorderQty: 50,
  });

  const filteredMedicines = React.useMemo(() => {
    return medicines.filter((m) => {
      const matchSearch =
        search === "" ||
        m.name.toLowerCase().includes(search.toLowerCase()) ||
        m.genericName?.toLowerCase().includes(search.toLowerCase()) ||
        m.sku.toLowerCase().includes(search.toLowerCase()) ||
        m.barcode?.includes(search);

      const matchCategory =
        categoryFilter === "ALL" || m.categoryName === categoryFilter;

      const matchSchedule =
        scheduleFilter === "ALL" || m.drugSchedule === scheduleFilter;

      return matchSearch && matchCategory && matchSchedule;
    });
  }, [medicines, search, categoryFilter, scheduleFilter]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setLoading(true);

    try {
      const res = await fetch("/api/inventory/medicines", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || "Failed to create medicine");
        setLoading(false);
        return;
      }

      setIsModalOpen(false);
      router.refresh();
      // Optimistic update
      const newMed: MedicineItem = {
        ...formData,
        id: data.medicine.id,
        categoryName: categories.find((c) => c.id === formData.categoryId)?.name || "General",
        mrp: Number(formData.mrp),
        salePrice: Number(formData.salePrice),
        purchasePrice: Number(formData.purchasePrice),
        conversionFactor: Number(formData.conversionFactor),
        gstRate: Number(formData.gstRate),
        minStockAlert: Number(formData.minStockAlert),
        reorderQty: Number(formData.reorderQty),
        isActive: true,
        currentStock: 0,
      };
      setMedicines([newMed, ...medicines]);
    } catch {
      setFormError("Network error occurred");
    } finally {
      setLoading(false);
    }
  };

  const exportCSV = () => {
    const headers = [
      "Name",
      "Generic Name",
      "SKU",
      "Barcode",
      "Category",
      "Schedule",
      "GST Rate",
      "Purchase Cost",
      "Sale Price",
      "MRP",
      "Current Stock",
    ];
    const rows = filteredMedicines.map((m) => [
      `"${m.name}"`,
      `"${m.genericName || ""}"`,
      `"${m.sku}"`,
      `"${m.barcode || ""}"`,
      `"${m.categoryName}"`,
      `"${m.drugSchedule}"`,
      `"${m.gstRate}%"`,
      m.purchasePrice,
      m.salePrice,
      m.mrp,
      m.currentStock,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `medicine_catalog_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Medicine Catalog
          </h1>
          <p className="text-xs text-slate-500">
            Centralized master directory of pharmaceutical products, schedules & tax rules.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportCSV}>
            <Download className="h-3.5 w-3.5" />
            <span>Export CSV</span>
          </Button>
          <Button variant="primary" size="sm" onClick={() => setIsModalOpen(true)}>
            <Plus className="h-3.5 w-3.5" />
            <span>Add Medicine</span>
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center justify-between rounded-lg border border-slate-200 bg-white p-3 shadow-2xs">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by medicine, generic name, brand, SKU or barcode..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 w-full rounded-md border border-slate-200 bg-slate-50 pl-8 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#0F766E] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#0F766E]"
          />
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <Filter className="h-3.5 w-3.5 text-slate-400" />
            <span>Category:</span>
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="h-8 rounded-md border border-slate-200 bg-slate-50 px-2.5 text-xs text-slate-800 focus:border-[#0F766E] focus:outline-none"
          >
            <option value="ALL">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>

          <select
            value={scheduleFilter}
            onChange={(e) => setScheduleFilter(e.target.value)}
            className="h-8 rounded-md border border-slate-200 bg-slate-50 px-2.5 text-xs text-slate-800 focus:border-[#0F766E] focus:outline-none"
          >
            <option value="ALL">All Schedules</option>
            <option value="OTC">OTC</option>
            <option value="SCHEDULE_H">Schedule H</option>
            <option value="SCHEDULE_H1">Schedule H1</option>
            <option value="SCHEDULE_X">Schedule X</option>
          </select>
        </div>
      </div>

      {/* Medicine Data Table */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Medicine Name</TableHead>
            <TableHead>Generic / Brand</TableHead>
            <TableHead>SKU & HSN</TableHead>
            <TableHead>Schedule & Tax</TableHead>
            <TableHead>Packaging</TableHead>
            <TableHead>Pricing (Cost / MRP / Sale)</TableHead>
            <TableHead>Branch Stock</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredMedicines.map((m) => (
            <TableRow key={m.id}>
              <TableCell className="font-semibold text-slate-900">
                <div className="flex items-center gap-2">
                  <Pill className="h-4 w-4 text-[#0F766E] shrink-0" />
                  <div>
                    <p>{m.name}</p>
                    <p className="text-[11px] text-slate-400 font-normal">
                      {m.categoryName} • {m.dosageForm}
                    </p>
                  </div>
                </div>
              </TableCell>

              <TableCell className="text-xs">
                <p className="text-slate-700">{m.genericName || "—"}</p>
                <p className="text-slate-400">{m.brand || m.manufacturer || "—"}</p>
              </TableCell>

              <TableCell className="font-mono text-xs">
                <p className="text-slate-800">{m.sku}</p>
                <p className="text-slate-400 text-[10px]">HSN: {m.hsnCode}</p>
              </TableCell>

              <TableCell>
                <div className="flex flex-col gap-1">
                  <Badge
                    variant={
                      m.drugSchedule.includes("H1")
                        ? "danger"
                        : m.drugSchedule.includes("H")
                        ? "warning"
                        : "neutral"
                    }
                    size="sm"
                  >
                    {m.drugSchedule}
                  </Badge>
                  <span className="text-[10px] text-slate-500 font-medium">
                    GST: {m.gstRate}%
                  </span>
                </div>
              </TableCell>

              <TableCell className="text-xs text-slate-600">
                <p>
                  1 {m.packUnit} = {m.conversionFactor} {m.dispenseUnit}s
                </p>
              </TableCell>

              <TableCell className="text-xs">
                <div className="space-y-0.5">
                  <p className="text-slate-500">Cost: {formatINR(m.purchasePrice)}</p>
                  <p className="font-semibold text-slate-900">Sale: {formatINR(m.salePrice)}</p>
                  <p className="text-[10px] text-slate-400">MRP: {formatINR(m.mrp)}</p>
                </div>
              </TableCell>

              <TableCell>
                <span
                  className={`font-bold ${
                    m.currentStock <= m.minStockAlert ? "text-red-600" : "text-emerald-700"
                  }`}
                >
                  {m.currentStock} {m.dispenseUnit}s
                </span>
                {m.currentStock <= m.minStockAlert && (
                  <p className="text-[10px] text-red-500 font-medium">Low Stock</p>
                )}
              </TableCell>

              <TableCell>
                <Badge variant={m.isActive ? "success" : "neutral"} size="sm">
                  {m.isActive ? "Active" : "Archived"}
                </Badge>
              </TableCell>
            </TableRow>
          ))}

          {filteredMedicines.length === 0 && (
            <TableRow>
              <TableCell colSpan={8} className="text-center py-8 text-slate-400">
                No medicines found matching the filters.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {/* Add Medicine Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Register New Medicine"
        description="Add a master pharmaceutical item with packaging units, drug schedules, and tax rules."
        maxWidth="xl"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && (
            <div className="flex items-center gap-2 p-3 text-xs rounded bg-red-50 text-red-700 border border-red-200">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Medicine Name *"
              placeholder="e.g. Dolo 650mg Tablet"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
            <Input
              label="Generic Composition"
              placeholder="e.g. Paracetamol 650mg"
              value={formData.genericName}
              onChange={(e) => setFormData({ ...formData, genericName: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Brand / Trade Name"
              placeholder="e.g. Micro Labs"
              value={formData.brand}
              onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
            />
            <Input
              label="Manufacturer Name"
              placeholder="e.g. Micro Labs Ltd"
              value={formData.manufacturer}
              onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Input
              label="SKU / Internal Code *"
              placeholder="e.g. MED-DOLO-650"
              value={formData.sku}
              onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
              required
            />
            <Input
              label="Barcode / EAN"
              placeholder="e.g. 8901148203011"
              value={formData.barcode}
              onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
            />
            <Input
              label="HSN Code"
              placeholder="3004"
              value={formData.hsnCode}
              onChange={(e) => setFormData({ ...formData, hsnCode: e.target.value })}
              required
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Select
              label="Category"
              value={formData.categoryId}
              onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>

            <Select
              label="Drug Schedule"
              value={formData.drugSchedule}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  drugSchedule: e.target.value,
                  prescriptionRequired: e.target.value !== "OTC",
                })
              }
            >
              <option value="OTC">OTC (Over the Counter)</option>
              <option value="SCHEDULE_H">Schedule H (Prescription)</option>
              <option value="SCHEDULE_H1">Schedule H1 (Controlled)</option>
              <option value="SCHEDULE_X">Schedule X (Strict Narcotics)</option>
            </Select>

            <Select
              label="GST Rate"
              value={formData.gstRate}
              onChange={(e) => setFormData({ ...formData, gstRate: Number(e.target.value) })}
            >
              <option value={0}>0% (Exempt)</option>
              <option value={5}>5%</option>
              <option value={12}>12% (Standard Medicine)</option>
              <option value={18}>18%</option>
            </Select>
          </div>

          {/* Unit Conversions */}
          <div className="grid grid-cols-3 gap-3 p-3 rounded-md bg-slate-50 border border-slate-200">
            <Input
              label="Pack Unit (Wholesale)"
              placeholder="Box"
              value={formData.packUnit}
              onChange={(e) => setFormData({ ...formData, packUnit: e.target.value })}
            />
            <Input
              label="Dispense Unit (Retail)"
              placeholder="Strip"
              value={formData.dispenseUnit}
              onChange={(e) => setFormData({ ...formData, dispenseUnit: e.target.value })}
            />
            <Input
              label="Conversion Factor"
              type="number"
              placeholder="10"
              value={formData.conversionFactor}
              onChange={(e) =>
                setFormData({ ...formData, conversionFactor: Number(e.target.value) })
              }
            />
          </div>

          {/* Financials */}
          <div className="grid grid-cols-3 gap-3">
            <Input
              label="Purchase Price (₹) *"
              type="number"
              step="0.01"
              placeholder="24.50"
              value={formData.purchasePrice}
              onChange={(e) => setFormData({ ...formData, purchasePrice: e.target.value })}
              required
            />
            <Input
              label="Retail Sale Price (₹) *"
              type="number"
              step="0.01"
              placeholder="31.00"
              value={formData.salePrice}
              onChange={(e) => setFormData({ ...formData, salePrice: e.target.value })}
              required
            />
            <Input
              label="MRP (₹) *"
              type="number"
              step="0.01"
              placeholder="33.60"
              value={formData.mrp}
              onChange={(e) => setFormData({ ...formData, mrp: e.target.value })}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Min Stock Alert Threshold"
              type="number"
              value={formData.minStockAlert}
              onChange={(e) =>
                setFormData({ ...formData, minStockAlert: Number(e.target.value) })
              }
            />
            <Input
              label="Suggested Reorder Quantity"
              type="number"
              value={formData.reorderQty}
              onChange={(e) =>
                setFormData({ ...formData, reorderQty: Number(e.target.value) })
              }
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={loading}>
              Save Medicine
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
