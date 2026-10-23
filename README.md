# PharmaPulse — Medical Store & Pharmacy Chain Management SaaS

A production-grade, multi-tenant SaaS application built for medical stores, retail pharmacies, and multi-branch pharmacy chains in India.

Built with **Next.js 16 (App Router)**, **TypeScript**, **Tailwind CSS**, and **PostgreSQL with Prisma ORM**.

---

## 🚀 Features

- **Multi-Tenant & Multi-Branch Architecture**: Tenant-level data isolation, multi-branch operations, and subscription tier quota enforcement.
- **Role-Based Access Control (RBAC)**: Fine-grained permissions with pre-configured roles: Platform Super Admin, Chain Owner, Store Manager, Pharmacist, Cashier, and Accountant.
- **Medicine & Batch Inventory**: Master catalog with drug schedules (H, H1, X), batch tracking, real-time balances, and immutable stock ledger (`StockLedgerEntry`).
- **FEFO Allocation Engine**: First-Expiry-First-Out automated batch allocation; strict rejection of expired or quarantined batches.
- **Expiry Risk Workspace**: Segmentation by <30, 31–60, and 61–90 days, financial exposure calculation, and controlled write-off disposal.
- **Procurement & 3-Way Match**: Vendor directory, multi-line purchase orders (PO), goods receipt notes (GRN) with batch & expiry capture, vendor invoices with 3-way matching and duplicate detection.
- **Keyboard-First POS Terminal**: High-speed billing with `F2` (search) and `F8` (checkout) shortcuts, automatic batch allocation with manual override, Schedule H prescriber compliance, and 80mm printable thermal receipt.
- **Inter-Branch Stock Transfers**: Complete dispatch-transit-receipt lifecycle with **in-transit stock isolation** (prevents double counting).
- **Reports & GSTR-1 Tax Analytics**: Stock valuation (Cost vs MRP), Sales & Gross Margin, GST Tax breakdown (CGST/SGST), Stock Movement Ledger, and Vendor Payables with 1-click CSV export.
- **Platform Super Admin Portal**: Tenant provisioning, subscription plan management, and tenant activation/suspension.

---

## 🛠️ Tech Stack

- **Framework**: Next.js 16 (App Router, Server Components & Route Handlers)
- **Language**: TypeScript
- **Styling**: Tailwind CSS (Teal `#0F766E` brand palette, Slate neutrals)
- **Database**: PostgreSQL (25+ relational entities)
- **ORM**: Prisma 6
- **Authentication**: Cookie-based HMAC-signed sessions with bcrypt hashing
- **Testing**: Automated integration test suite (`tsx tests/suite.test.ts`)

---

## 📋 Getting Started

### 1. Prerequisites
- Node.js 18+ or 20+
- PostgreSQL running locally or in the cloud

### 2. Environment Setup
Copy the example environment file:
```bash
cp .env.example .env
```
Update `.env` with your PostgreSQL connection URL:
```env
DATABASE_URL="postgresql://username:password@localhost:5432/medical_store_saas?schema=public"
SESSION_SECRET="your-secure-random-secret-key"
```

### 3. Database Migration & Seed
```bash
# Push schema to PostgreSQL
npx prisma db push

# Seed system roles, subscription plans, demo pharmacy chain, branches, inventory, and invoices
npx tsx prisma/seed.ts
```

### 4. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🧪 Testing & Verification

Run the automated integration test suite:
```bash
npm test
```
The test suite validates:
- FEFO batch allocation order
- Expired & quarantined stock restrictions
- Transactional negative stock prevention
- Immutable stock ledger audit recording
- GST financial rounding precision
- Multi-tenant query isolation

Run production build and linting:
```bash
npm run build
npm run lint
```

---

## 🔑 Demo Credentials

All accounts share the password: `Pharmacy@12345` (Super Admin is `Admin@12345`).
The login screen includes 1-click quick-login buttons for instant role switching.

| Role | Email | Password | Scope |
| :--- | :--- | :--- | :--- |
| **Super Admin** | `admin@pharmapulse.io` | `Admin@12345` | Global SaaS tenant & plan administration |
| **Pharmacy Owner** | `owner@apexmedcare.com` | `Pharmacy@12345` | Full chain administrative access across branches |
| **Pharmacist** | `pharmacist@apexmedcare.com` | `Pharmacy@12345` | Inventory, batches, goods receipt, and POS |
| **POS Cashier** | `cashier@apexmedcare.com` | `Pharmacy@12345` | Fast retail POS checkout and receipt printing |

---

## 📄 License
MIT
