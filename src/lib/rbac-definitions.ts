export interface PermissionDefinition {
  code: string;
  name: string;
  module: string;
  description: string;
}

export const SYSTEM_PERMISSIONS: PermissionDefinition[] = [
  // Inventory
  { code: "inventory:view", name: "View Inventory", module: "INVENTORY", description: "View medicine catalog, batches, and stock levels" },
  { code: "inventory:create", name: "Create Medicines", module: "INVENTORY", description: "Add new medicines and configure master details" },
  { code: "inventory:edit", name: "Edit Medicines", module: "INVENTORY", description: "Modify pricing, categories, and medicine metadata" },
  { code: "inventory:adjust", name: "Adjust Stock", module: "INVENTORY", description: "Perform manual stock counts, write-offs, and corrections" },
  { code: "inventory:transfer", name: "Transfer Stock", module: "INVENTORY", description: "Create and dispatch inter-branch stock transfers" },

  // Procurement
  { code: "procurement:view", name: "View Procurement", module: "PROCUREMENT", description: "View vendors, POs, and goods receipts" },
  { code: "procurement:create", name: "Create Orders", module: "PROCUREMENT", description: "Create purchase orders and request stock" },
  { code: "procurement:approve", name: "Approve Orders", module: "PROCUREMENT", description: "Approve high-value purchase orders" },
  { code: "procurement:receive", name: "Receive Goods", module: "PROCUREMENT", description: "Post goods receipts and generate batch stock" },
  { code: "procurement:invoices", name: "Manage Invoices", module: "PROCUREMENT", description: "Enter vendor invoices and log payments" },

  // Sales & POS
  { code: "sales:pos", name: "Operate POS", module: "SALES", description: "Access billing register and dispense medicines" },
  { code: "sales:discount", name: "Apply Custom Discounts", module: "SALES", description: "Apply line and invoice discounts beyond thresholds" },
  { code: "sales:return", name: "Process Returns", module: "SALES", description: "Process customer returns and issue refunds" },
  { code: "sales:void", name: "Void Invoices", module: "SALES", description: "Void or cancel finalized sales invoices" },

  // Operations & Admin
  { code: "reports:view", name: "View Reports", module: "REPORTS", description: "Access inventory, sales, margin, and tax reports" },
  { code: "reports:export", name: "Export Reports", module: "REPORTS", description: "Download CSV, Excel, and PDF reports" },
  { code: "branches:manage", name: "Manage Branches", module: "OPERATIONS", description: "Configure store locations and operating hours" },
  { code: "staff:manage", name: "Manage Staff", module: "OPERATIONS", description: "Invite staff and assign branch permissions" },
  { code: "settings:manage", name: "Manage Settings", module: "SETTINGS", description: "Configure legal profile, tax rates, and billing options" },
  { code: "platform:superadmin", name: "Platform Admin", module: "PLATFORM", description: "Manage SaaS tenants, plans, and global infrastructure" },
];

export const SYSTEM_ROLE_DEFAULTS: Record<string, { name: string; description: string; permissions: string[] }> = {
  SUPER_ADMIN: {
    name: "Platform Super Admin",
    description: "Full access to platform administration, tenants, and global configuration",
    permissions: SYSTEM_PERMISSIONS.map((p) => p.code),
  },
  PHARMACY_OWNER: {
    name: "Pharmacy Owner / Tenant Admin",
    description: "Complete control across all pharmacy branches, finances, and settings",
    permissions: SYSTEM_PERMISSIONS.filter((p) => p.code !== "platform:superadmin").map((p) => p.code),
  },
  STORE_MANAGER: {
    name: "Store Manager",
    description: "Manages store operations, staff, procurement, inventory, and branch POS",
    permissions: [
      "inventory:view", "inventory:create", "inventory:edit", "inventory:adjust", "inventory:transfer",
      "procurement:view", "procurement:create", "procurement:approve", "procurement:receive", "procurement:invoices",
      "sales:pos", "sales:discount", "sales:return", "sales:void",
      "reports:view", "reports:export", "staff:manage", "settings:manage"
    ],
  },
  PHARMACIST: {
    name: "Licensed Pharmacist",
    description: "Dispenses medicines, reviews prescriptions, handles sales, and monitors expiry",
    permissions: [
      "inventory:view", "inventory:transfer",
      "procurement:view", "procurement:receive",
      "sales:pos", "sales:return",
      "reports:view"
    ],
  },
  INVENTORY_MANAGER: {
    name: "Inventory / Purchase Manager",
    description: "Focuses on supplier orders, batch verification, goods receipts, and stock taking",
    permissions: [
      "inventory:view", "inventory:create", "inventory:edit", "inventory:adjust", "inventory:transfer",
      "procurement:view", "procurement:create", "procurement:receive", "procurement:invoices",
      "reports:view", "reports:export"
    ],
  },
  CASHIER: {
    name: "Billing Executive / Cashier",
    description: "Fast-paced retail POS billing, receipts, and cash reconciliation",
    permissions: [
      "inventory:view",
      "sales:pos"
    ],
  },
  ACCOUNTANT: {
    name: "Accountant",
    description: "Tracks vendor invoices, payments, tax returns, and financial reports",
    permissions: [
      "inventory:view",
      "procurement:view", "procurement:invoices",
      "reports:view", "reports:export",
      "settings:manage"
    ],
  },
  AUDITOR: {
    name: "Auditor / Read-only",
    description: "Read-only visibility into inventory, invoices, ledger, and reports",
    permissions: [
      "inventory:view",
      "procurement:view",
      "reports:view", "reports:export"
    ],
  },
};
