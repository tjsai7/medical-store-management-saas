"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { formatINR, formatDate, getDaysToExpiry } from "@/lib/utils";
import {
  Search,
  ShoppingCart,
  Trash2,
  Printer,
  User,
  Stethoscope,
  AlertCircle,
} from "lucide-react";

interface CompletedInvoice {
  invoiceNumber: string;
  customerName: string;
  doctorName?: string | null;
  taxableAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  grandTotal: number;
  cartItems: CartItem[];
}

interface BatchRef {
  id: string;
  batchNumber: string;
  expiryDate: string;
  status: string;
  mrp: number;
  unitSalePrice: number;
  quantityOnHand: number;
}

interface MedicineRef {
  id: string;
  name: string;
  genericName?: string | null;
  sku: string;
  barcode?: string | null;
  hsnCode: string;
  dispenseUnit: string;
  dosageForm: string;
  drugSchedule: string;
  prescriptionRequired: boolean;
  gstRate: number;
  salePrice: number;
  mrp: number;
  batches: BatchRef[];
}

interface CartItem {
  medicineId: string;
  name: string;
  sku: string;
  dispenseUnit: string;
  drugSchedule: string;
  batchId: string;
  batchNumber: string;
  expiryDate: string;
  unitSalePrice: number;
  mrp: number;
  quantity: number;
  availableStock: number;
  discountPercent: number;
  gstRate: number;
}

export function PosClient({
  medicines,
  branchDetails,
}: {
  medicines: MedicineRef[];
  branchDetails: {
    name: string;
    code: string;
    gstin: string;
    receiptHeader: string;
    receiptFooter: string;
  };
}) {
  const router = useRouter();
  const searchInputRef = React.useRef<HTMLInputElement>(null);

  // Search & Cart State
  const [searchTerm, setSearchTerm] = React.useState("");
  const [cart, setCart] = React.useState<CartItem[]>([]);
  const [customerName, setCustomerName] = React.useState("Walk-in Customer");
  const [customerPhone, setCustomerPhone] = React.useState("");
  const [doctorName, setDoctorName] = React.useState("");
  const [doctorRegNumber, setDoctorRegNumber] = React.useState("");

  // Payment Modal State
  const [isPaymentOpen, setIsPaymentOpen] = React.useState(false);
  const [paymentMethod, setPaymentMethod] = React.useState("CASH");
  const [cashTendered, setCashTendered] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [checkoutError, setCheckoutError] = React.useState("");

  // Receipt Modal State
  const [completedInvoice, setCompletedInvoice] = React.useState<CompletedInvoice | null>(null);

  // Keyboard Shortcuts: F2 for search, F8 for checkout
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F2") {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === "F8") {
        e.preventDefault();
        if (cart.length > 0) setIsPaymentOpen(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [cart]);

  // Search results
  const searchResults = React.useMemo(() => {
    if (!searchTerm.trim()) return [];
    const q = searchTerm.toLowerCase();
    return medicines
      .filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.genericName?.toLowerCase().includes(q) ||
          m.sku.toLowerCase().includes(q) ||
          m.barcode?.includes(q)
      )
      .slice(0, 6);
  }, [medicines, searchTerm]);

  // Add medicine to cart with automatic FEFO batch allocation
  const handleAddToCart = (medicine: MedicineRef) => {
    const now = new Date();
    // Eligible non-expired, active batches with stock > 0
    const eligibleBatches = medicine.batches.filter((b) => {
      const isExpired = b.status === "EXPIRED" || new Date(b.expiryDate) < now;
      return b.status === "ACTIVE" && !isExpired && b.quantityOnHand > 0;
    });

    if (eligibleBatches.length === 0) {
      alert(`No active, saleable batches available for ${medicine.name}. (Expired or Out of Stock)`);
      return;
    }

    // FEFO: Pick earliest expiry batch
    const bestBatch = eligibleBatches[0];

    // Check if item with this batch is already in cart
    const existingIndex = cart.findIndex(
      (c) => c.medicineId === medicine.id && c.batchId === bestBatch.id
    );

    if (existingIndex >= 0) {
      const updated = [...cart];
      if (updated[existingIndex].quantity + 1 > bestBatch.quantityOnHand) {
        alert(`Cannot add more than available batch stock (${bestBatch.quantityOnHand} units).`);
        return;
      }
      updated[existingIndex].quantity += 1;
      setCart(updated);
    } else {
      setCart([
        ...cart,
        {
          medicineId: medicine.id,
          name: medicine.name,
          sku: medicine.sku,
          dispenseUnit: medicine.dispenseUnit,
          drugSchedule: medicine.drugSchedule,
          batchId: bestBatch.id,
          batchNumber: bestBatch.batchNumber,
          expiryDate: bestBatch.expiryDate,
          unitSalePrice: bestBatch.unitSalePrice || medicine.salePrice,
          mrp: bestBatch.mrp,
          quantity: 1,
          availableStock: bestBatch.quantityOnHand,
          discountPercent: 0,
          gstRate: medicine.gstRate,
        },
      ]);
    }

    setSearchTerm("");
    searchInputRef.current?.focus();
  };

  const handleUpdateQty = (index: number, qty: number) => {
    if (qty <= 0) {
      handleRemoveItem(index);
      return;
    }
    const item = cart[index];
    if (qty > item.availableStock) {
      alert(`Stock limit reached: Only ${item.availableStock} ${item.dispenseUnit}s available.`);
      return;
    }
    const updated = [...cart];
    updated[index].quantity = qty;
    setCart(updated);
  };

  const handleRemoveItem = (index: number) => {
    setCart(cart.filter((_, i) => i !== index));
  };

  // Switch batch manually in cart
  const handleBatchChange = (index: number, newBatchId: string) => {
    const item = cart[index];
    const med = medicines.find((m) => m.id === item.medicineId);
    const newBatch = med?.batches.find((b) => b.id === newBatchId);
    if (!newBatch) return;

    if (newBatch.status === "EXPIRED" || new Date(newBatch.expiryDate) < new Date()) {
      alert("Cannot select an expired batch for retail dispensing.");
      return;
    }
    if (newBatch.status === "QUARANTINED") {
      alert("Cannot select a quarantined batch.");
      return;
    }

    const updated = [...cart];
    updated[index] = {
      ...updated[index],
      batchId: newBatch.id,
      batchNumber: newBatch.batchNumber,
      expiryDate: newBatch.expiryDate,
      unitSalePrice: newBatch.unitSalePrice || med!.salePrice,
      mrp: newBatch.mrp,
      availableStock: newBatch.quantityOnHand,
      quantity: Math.min(item.quantity, newBatch.quantityOnHand),
    };
    setCart(updated);
  };

  // Calculations
  const subtotal = cart.reduce((sum, item) => sum + item.quantity * item.unitSalePrice, 0);
  const totalDiscount = cart.reduce(
    (sum, item) => sum + item.quantity * item.unitSalePrice * (item.discountPercent / 100),
    0
  );
  const netBeforeTax = subtotal - totalDiscount;

  // Tax breakdown (tax-inclusive formula standard in Indian pharma retail)
  const taxableTotal = cart.reduce((sum, item) => {
    const netLine = item.quantity * item.unitSalePrice * (1 - item.discountPercent / 100);
    return sum + netLine / (1 + item.gstRate / 100);
  }, 0);

  const totalGST = netBeforeTax - taxableTotal;
  const cgst = totalGST / 2;
  const sgst = totalGST / 2;

  const grandTotal = Math.round(netBeforeTax);
  const roundOff = Math.round((grandTotal - netBeforeTax) * 100) / 100;

  // Prescriber check for Schedule H/H1/X
  const hasControlledMedicines = cart.some(
    (item) => item.drugSchedule.includes("H") || item.drugSchedule.includes("X")
  );

  const handleCheckout = async () => {
    if (hasControlledMedicines && !doctorName.trim()) {
      alert("Doctor Prescriber Name is MANDATORY for Schedule H / H1 / X medications.");
      return;
    }

    setCheckoutError("");
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/sales/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName,
          customerPhone,
          doctorName: doctorName || null,
          doctorRegNumber: doctorRegNumber || null,
          paymentMethod,
          items: cart.map((c) => ({
            medicineId: c.medicineId,
            batchId: c.batchId,
            quantity: c.quantity,
            unitSalePrice: c.unitSalePrice,
            mrp: c.mrp,
            discountPercent: c.discountPercent,
            gstRate: c.gstRate,
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setCheckoutError(data.error || "Checkout failed");
        setIsSubmitting(false);
        return;
      }

      // Checkout succeeded!
      setCompletedInvoice({
        ...data.invoice,
        cartItems: [...cart],
        branchDetails,
      });

      setIsPaymentOpen(false);
      setCart([]);
      router.refresh();
    } catch {
      setCheckoutError("Failed to communicate with billing server");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="grid grid-cols-12 gap-4 h-[calc(100vh-5.5rem)]">
      {/* Left 8 Cols: Search, Product Finder & Active Bill Cart */}
      <div className="col-span-12 lg:col-span-8 flex flex-col space-y-3">
        {/* Top Search Bar with keyboard shortcut badge */}
        <div className="relative rounded-lg border border-slate-200 bg-white p-2.5 shadow-2xs">
          <div className="relative flex items-center">
            <Search className="absolute left-3 h-4 w-4 text-slate-400" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search medicine by brand, generic, SKU, or scan barcode... (Press F2)"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-10 w-full rounded-md border border-slate-200 bg-slate-50 pl-9 pr-16 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#0F766E] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#0F766E]"
            />
            <kbd className="absolute right-3 rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
              F2
            </kbd>
          </div>

          {/* Autocomplete Results Dropdown */}
          {searchResults.length > 0 && (
            <div className="absolute left-0 right-0 top-14 z-50 rounded-lg border border-slate-200 bg-white p-1.5 shadow-xl">
              <p className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Matching Medicines (Click to add via FEFO)
              </p>
              {searchResults.map((m) => {
                const totalStock = m.batches.reduce(
                  (sum, b) => (b.status === "ACTIVE" ? sum + b.quantityOnHand : sum),
                  0
                );
                return (
                  <button
                    key={m.id}
                    onClick={() => handleAddToCart(m)}
                    className="flex w-full items-center justify-between p-2 rounded-md hover:bg-teal-50 text-left transition-colors cursor-pointer"
                  >
                    <div>
                      <p className="text-xs font-semibold text-slate-900">{m.name}</p>
                      <p className="text-[11px] text-slate-500">
                        {m.genericName} • {m.dosageForm}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold text-slate-900">
                        {formatINR(m.salePrice)}
                      </p>
                      <p
                        className={`text-[10px] font-semibold ${
                          totalStock > 0 ? "text-emerald-700" : "text-red-600"
                        }`}
                      >
                        {totalStock > 0 ? `${totalStock} in stock` : "Out of Stock"}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Active Bill Cart Table */}
        <div className="flex-1 rounded-lg border border-slate-200 bg-white shadow-2xs overflow-hidden flex flex-col">
          <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-[#0F766E]" />
              <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Sales Register ({cart.length} Items)
              </h2>
            </div>
            {cart.length > 0 && (
              <button
                onClick={() => setCart([])}
                className="text-xs text-red-600 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Trash2 className="h-3 w-3" />
                <span>Clear Bill</span>
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Medicine</TableHead>
                  <TableHead>Batch (FEFO)</TableHead>
                  <TableHead>Expiry</TableHead>
                  <TableHead>Rate (₹)</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Disc %</TableHead>
                  <TableHead>Line Total (₹)</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cart.map((item, idx) => {
                  const med = medicines.find((m) => m.id === item.medicineId);
                  const days = getDaysToExpiry(item.expiryDate);
                  const lineTotal =
                    item.quantity * item.unitSalePrice * (1 - item.discountPercent / 100);

                  return (
                    <TableRow key={`${item.medicineId}-${item.batchId}`}>
                      <TableCell className="font-semibold text-slate-900 text-xs">
                        <p>{item.name}</p>
                        <div className="flex items-center gap-1 mt-0.5">
                          {item.drugSchedule !== "OTC" && (
                            <Badge variant="warning" size="sm">
                              {item.drugSchedule}
                            </Badge>
                          )}
                          <span className="text-[10px] text-slate-400 font-mono">
                            {item.sku}
                          </span>
                        </div>
                      </TableCell>

                      <TableCell>
                        <select
                          value={item.batchId}
                          onChange={(e) => handleBatchChange(idx, e.target.value)}
                          className="h-7 rounded border border-slate-300 bg-white px-1.5 text-xs font-mono font-semibold text-slate-800 focus:outline-none"
                        >
                          {med?.batches.map((b) => (
                            <option
                              key={b.id}
                              value={b.id}
                              disabled={b.status !== "ACTIVE"}
                            >
                              {b.batchNumber} (Avail: {b.quantityOnHand}){" "}
                              {b.status !== "ACTIVE" ? `[${b.status}]` : ""}
                            </option>
                          ))}
                        </select>
                      </TableCell>

                      <TableCell className="text-xs">
                        <p className="font-medium text-slate-700">{formatDate(item.expiryDate)}</p>
                        <p
                          className={`text-[10px] ${
                            days <= 60 ? "text-amber-700 font-semibold" : "text-slate-400"
                          }`}
                        >
                          {days}d left
                        </p>
                      </TableCell>

                      <TableCell className="font-medium text-xs text-slate-800">
                        {formatINR(item.unitSalePrice)}
                      </TableCell>

                      <TableCell>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleUpdateQty(idx, item.quantity - 1)}
                            className="h-6 w-6 rounded bg-slate-100 text-slate-700 font-bold hover:bg-slate-200 text-xs cursor-pointer"
                          >
                            -
                          </button>
                          <input
                            type="number"
                            min={1}
                            max={item.availableStock}
                            value={item.quantity}
                            onChange={(e) => handleUpdateQty(idx, Number(e.target.value))}
                            className="w-12 h-6 text-center text-xs font-bold rounded border border-slate-200"
                          />
                          <button
                            onClick={() => handleUpdateQty(idx, item.quantity + 1)}
                            className="h-6 w-6 rounded bg-slate-100 text-slate-700 font-bold hover:bg-slate-200 text-xs cursor-pointer"
                          >
                            +
                          </button>
                        </div>
                      </TableCell>

                      <TableCell>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={item.discountPercent}
                          onChange={(e) => {
                            const updated = [...cart];
                            updated[idx].discountPercent = Number(e.target.value);
                            setCart(updated);
                          }}
                          className="w-12 h-6 text-center text-xs rounded border border-slate-200"
                        />
                      </TableCell>

                      <TableCell className="font-bold text-slate-900 text-xs">
                        {formatINR(lineTotal)}
                      </TableCell>

                      <TableCell>
                        <button
                          onClick={() => handleRemoveItem(idx)}
                          className="text-slate-400 hover:text-red-600 p-1 cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </TableCell>
                    </TableRow>
                  );
                })}

                {cart.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-16 text-slate-400">
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <ShoppingCart className="h-8 w-8 text-slate-300" />
                        <p className="font-semibold text-slate-600">Cart is empty</p>
                        <p className="text-xs text-slate-400">
                          Search for medicines above or press F2 to begin billing.
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      {/* Right 4 Cols: Customer, Prescriber, Tax Breakdown & Pay Action */}
      <div className="col-span-12 lg:col-span-4 flex flex-col space-y-3">
        {/* Customer & Prescriber Panel */}
        <div className="rounded-lg border border-slate-200 bg-white p-3.5 shadow-2xs space-y-3 text-xs">
          <div className="flex items-center gap-1.5 font-semibold text-slate-800 border-b border-slate-100 pb-2">
            <User className="h-4 w-4 text-[#0F766E]" />
            <span>Customer Details</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Input
              label="Customer Name"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
            />
            <Input
              label="Phone Number"
              placeholder="+91..."
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-1.5 font-semibold text-slate-800 border-b border-slate-100 pb-2 pt-1">
            <Stethoscope className="h-4 w-4 text-[#0F766E]" />
            <span>Doctor / Prescriber {hasControlledMedicines && <span className="text-red-500">*</span>}</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Input
              label="Doctor Name"
              placeholder="Dr. Rajesh Rao"
              value={doctorName}
              onChange={(e) => setDoctorName(e.target.value)}
              error={hasControlledMedicines && !doctorName ? "Mandatory for Schedule H/H1" : undefined}
            />
            <Input
              label="Reg Number"
              placeholder="MCI-10492"
              value={doctorRegNumber}
              onChange={(e) => setDoctorRegNumber(e.target.value)}
            />
          </div>
        </div>

        {/* Financial & Tax Summary */}
        <div className="flex-1 rounded-lg border border-slate-200 bg-white p-4 shadow-2xs flex flex-col justify-between">
          <div className="space-y-2.5 text-xs">
            <p className="font-semibold text-slate-800 uppercase tracking-wider text-[11px] pb-1 border-b border-slate-100">
              Tax & Settlement Summary
            </p>

            <div className="flex justify-between text-slate-600">
              <span>Gross Total:</span>
              <span className="font-medium text-slate-900">{formatINR(subtotal)}</span>
            </div>

            {totalDiscount > 0 && (
              <div className="flex justify-between text-emerald-700">
                <span>Discount Savings:</span>
                <span>-{formatINR(totalDiscount)}</span>
              </div>
            )}

            <div className="flex justify-between text-slate-500 text-[11px]">
              <span>Taxable Subtotal:</span>
              <span>{formatINR(taxableTotal)}</span>
            </div>

            <div className="flex justify-between text-slate-500 text-[11px]">
              <span>CGST (Intrastate):</span>
              <span>{formatINR(cgst)}</span>
            </div>

            <div className="flex justify-between text-slate-500 text-[11px]">
              <span>SGST (Intrastate):</span>
              <span>{formatINR(sgst)}</span>
            </div>

            {roundOff !== 0 && (
              <div className="flex justify-between text-slate-400 text-[11px]">
                <span>Round Off:</span>
                <span>{roundOff > 0 ? `+${roundOff}` : roundOff}</span>
              </div>
            )}

            <div className="pt-2 border-t border-slate-200 flex justify-between items-baseline">
              <span className="text-sm font-bold text-slate-900">Net Payable:</span>
              <span className="text-2xl font-extrabold text-[#0F766E]">
                {formatINR(grandTotal)}
              </span>
            </div>
          </div>

          <Button
            variant="primary"
            size="lg"
            className="w-full mt-4 font-bold tracking-wide"
            disabled={cart.length === 0}
            onClick={() => setIsPaymentOpen(true)}
          >
            <span>Collect Payment (F8)</span>
          </Button>
        </div>
      </div>

      {/* Payment Settlement Modal */}
      <Modal
        isOpen={isPaymentOpen}
        onClose={() => setIsPaymentOpen(false)}
        title="Complete POS Sale"
        description="Select customer payment method and confirm sequential tax invoice issuance."
        maxWidth="md"
      >
        <div className="space-y-4">
          {checkoutError && (
            <div className="flex items-center gap-2 p-3 text-xs rounded bg-red-50 text-red-700 border border-red-200">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{checkoutError}</span>
            </div>
          )}

          <div className="text-center p-4 rounded-lg bg-teal-50 border border-teal-200">
            <p className="text-xs text-teal-800 font-semibold uppercase">Grand Total Due</p>
            <p className="text-3xl font-extrabold text-teal-950 mt-1">
              {formatINR(grandTotal)}
            </p>
          </div>

          {/* Payment Method Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Select Payment Mode
            </label>
            <div className="grid grid-cols-3 gap-2">
              {["CASH", "UPI", "CARD"].map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setPaymentMethod(mode)}
                  className={`p-2.5 text-xs font-bold rounded-md border text-center transition-all cursor-pointer ${
                    paymentMethod === mode
                      ? "border-[#0F766E] bg-teal-50 text-[#0F766E] ring-1 ring-[#0F766E]"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>

          {paymentMethod === "CASH" && (
            <div className="space-y-2">
              <Input
                label="Cash Tendered (₹)"
                type="number"
                placeholder={grandTotal.toString()}
                value={cashTendered}
                onChange={(e) => setCashTendered(e.target.value)}
              />
              {Number(cashTendered) > grandTotal && (
                <p className="text-xs font-bold text-emerald-700">
                  Change to return: {formatINR(Number(cashTendered) - grandTotal)}
                </p>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsPaymentOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={handleCheckout}
              isLoading={isSubmitting}
            >
              Generate Bill & Print
            </Button>
          </div>
        </div>
      </Modal>

      {/* Printable Thermal Receipt Modal */}
      {completedInvoice && (
        <Modal
          isOpen={!!completedInvoice}
          onClose={() => setCompletedInvoice(null)}
          title="Tax Invoice Generated"
          description={`Invoice #${completedInvoice.invoiceNumber} has been finalized and deducted from stock.`}
          maxWidth="md"
        >
          <div className="space-y-4">
            {/* 80mm Thermal Receipt Simulation Container */}
            <div className="printable-receipt border border-slate-300 bg-white p-4 font-mono text-xs rounded-sm shadow-inner space-y-2">
              <div className="text-center space-y-0.5 border-b border-dashed border-slate-400 pb-2">
                <p className="font-bold text-sm text-slate-900">{branchDetails.name}</p>
                <p className="text-[10px] text-slate-600 whitespace-pre-line">
                  {branchDetails.receiptHeader}
                </p>
                <p className="text-[10px] font-bold text-slate-800">
                  GSTIN: {branchDetails.gstin}
                </p>
              </div>

              <div className="flex justify-between text-[11px] pt-1">
                <span>Inv: {completedInvoice.invoiceNumber}</span>
                <span>{new Date().toLocaleTimeString()}</span>
              </div>

              <div className="text-[10px] text-slate-600 border-b border-dashed border-slate-400 pb-1">
                <p>Customer: {completedInvoice.customerName}</p>
                {completedInvoice.doctorName && (
                  <p>Dr: {completedInvoice.doctorName}</p>
                )}
              </div>

              {/* Line Items */}
              <div className="space-y-1 border-b border-dashed border-slate-400 py-1">
                {completedInvoice.cartItems.map((item: CartItem, i: number) => (
                  <div key={i} className="flex justify-between text-[11px]">
                    <span className="truncate max-w-[160px]">
                      {item.name} ({item.batchNumber}) x{item.quantity}
                    </span>
                    <span className="font-bold">
                      {formatINR(item.quantity * item.unitSalePrice)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div className="space-y-0.5 text-right pt-1">
                <p>Taxable Value: {formatINR(completedInvoice.taxableAmount)}</p>
                <p>CGST: {formatINR(completedInvoice.cgstAmount)}</p>
                <p>SGST: {formatINR(completedInvoice.sgstAmount)}</p>
                <p className="text-sm font-bold border-t border-dashed border-slate-400 pt-1">
                  TOTAL PAID: {formatINR(completedInvoice.grandTotal)}
                </p>
              </div>

              <div className="text-center pt-2 text-[10px] text-slate-500 whitespace-pre-line border-t border-dashed border-slate-400">
                {branchDetails.receiptFooter}
              </div>
            </div>

            <div className="flex justify-between items-center pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCompletedInvoice(null)}
              >
                Close
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => window.print()}
                className="gap-1.5"
              >
                <Printer className="h-4 w-4" />
                <span>Print Receipt</span>
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
