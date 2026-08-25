import type { UserRole } from "./types";

export interface RoleMeta {
  key: UserRole;
  name: string;
  short: string;
  description: string;
  rank: number;
  color: string; // tailwind text/bg accent hue
}

/** Descriptive metadata for every role, ordered by the approval chain. */
export const ROLES: Record<UserRole, RoleMeta> = {
  employee: {
    key: "employee",
    name: "Employee",
    short: "Employee",
    description: "Creates purchase and reimbursement requests and tracks their status.",
    rank: 1,
    color: "slate",
  },
  finance_staff: {
    key: "finance_staff",
    name: "Finance Staff",
    short: "Finance Staff",
    description: "First reviewer — validates documents, checks budgets, approves or returns requests.",
    rank: 2,
    color: "cyan",
  },
  finance_manager: {
    key: "finance_manager",
    name: "Finance Manager",
    short: "Finance Mgr",
    description: "Grants final financial approval and monitors company budgets.",
    rank: 3,
    color: "blue",
  },
  accountant: {
    key: "accountant",
    name: "Accountant",
    short: "Accountant",
    description: "Processes payment, records the transaction, updates the ledger and reports.",
    rank: 4,
    color: "emerald",
  },
  administrator: {
    key: "administrator",
    name: "Administrator",
    short: "Admin",
    description: "Manages users, departments, categories, permissions and audit logs.",
    rank: 5,
    color: "rose",
  },
};

export const ALL_ROLES = Object.values(ROLES).map((r) => r.key) as UserRole[];

export function roleName(role: UserRole | null | undefined): string {
  return role ? ROLES[role].name : "Unknown";
}

export function hasAnyRole(role: UserRole | null | undefined, allowed: UserRole[]): boolean {
  return !!role && allowed.includes(role);
}

/** Reviewers are everyone except plain employees — they can see the pipeline. */
export function isReviewer(role: UserRole | null | undefined): boolean {
  return !!role && role !== "employee";
}

export function isAdmin(role: UserRole | null | undefined): boolean {
  return role === "administrator";
}

/**
 * Budget authority:
 *   Finance Manager — sets the ceilings (the monthly / company-wide budgets).
 *   Administrator   — handles budget allocation as a system duty.
 *   Finance Staff   — draws allocations from a ceiling already set.
 */
export function canManageBudgets(role: UserRole | null | undefined): boolean {
  return role === "finance_manager" || role === "administrator";
}

export function canAllocateBudget(role: UserRole | null | undefined): boolean {
  return role === "finance_manager" || role === "finance_staff" || role === "administrator";
}

/**
 * Vendors are procurement master data: Finance Staff meet the suppliers and
 * check their documents, so they maintain the list alongside the Finance
 * Manager and the Administrator.
 */
export function canManageVendors(role: UserRole | null | undefined): boolean {
  return role === "administrator" || role === "finance_manager" || role === "finance_staff";
}

/**
 * Recording income is the Accountant's "record transaction" duty; the other
 * finance roles may also post it. Employees never touch the ledger.
 */
export function canRecordIncome(role: UserRole | null | undefined): boolean {
  return isReviewer(role);
}
