import type { UserRole } from "./types";
import { ALL_ROLES } from "./rbac";

export interface NavItem {
  label: string;
  href: string;
  icon: string; // lucide-react icon name
  roles: UserRole[]; // roles allowed to see this item
  section?: string;
}

const REVIEWERS: UserRole[] = [
  "finance_staff",
  "finance_manager",
  "accountant",
  "administrator",
];

const FINANCE: UserRole[] = [
  "finance_staff",
  "finance_manager",
  "accountant",
  "administrator",
];

/** Full navigation model. Items are filtered per-role by `navForRole`. */
export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: "LayoutDashboard", roles: ALL_ROLES, section: "Overview" },
  { label: "Approvals", href: "/approvals", icon: "CheckCircle2", roles: REVIEWERS, section: "Overview" },
  { label: "Notifications", href: "/notifications", icon: "Bell", roles: ALL_ROLES, section: "Overview" },

  { label: "Purchase Requests", href: "/purchase-requests", icon: "ShoppingCart", roles: ALL_ROLES, section: "Requests" },
  { label: "Reimbursements", href: "/reimbursements", icon: "ReceiptText", roles: ALL_ROLES, section: "Requests" },

  { label: "Budgets", href: "/budgets", icon: "Wallet", roles: FINANCE, section: "Finance" },
  { label: "Income", href: "/income", icon: "TrendingUp", roles: FINANCE, section: "Finance" },
  { label: "Expenses", href: "/expenses", icon: "TrendingDown", roles: FINANCE, section: "Finance" },
  { label: "Payments", href: "/payments", icon: "Banknote", roles: ["finance_manager", "accountant", "administrator"], section: "Finance" },
  { label: "Reports", href: "/reports", icon: "BarChart3", roles: REVIEWERS, section: "Finance" },

  { label: "Vendors", href: "/vendors", icon: "Store", roles: ["administrator", "finance_manager", "finance_staff"], section: "Administration" },

  { label: "Users", href: "/users", icon: "Users", roles: ["administrator"], section: "Administration" },
  { label: "Departments", href: "/departments", icon: "Building2", roles: ["administrator"], section: "Administration" },
  { label: "Categories", href: "/categories", icon: "Tags", roles: ["administrator", "finance_manager"], section: "Administration" },
  { label: "Audit Logs", href: "/audit-logs", icon: "ScrollText", roles: ["administrator", "finance_manager"], section: "Administration" },
];

export const NAV_SECTIONS = ["Overview", "Requests", "Finance", "Administration"];

/** Items a given role is allowed to see, in declaration order. */
export function navForRole(role: UserRole | null | undefined): NavItem[] {
  if (!role) return [];
  return NAV_ITEMS.filter((item) => item.roles.includes(role));
}

/** True if a role may access a given path (used by middleware / guards). */
export function canAccessPath(role: UserRole | null | undefined, pathname: string): boolean {
  if (!role) return false;
  const item = NAV_ITEMS.find((i) => pathname === i.href || pathname.startsWith(i.href + "/"));
  if (!item) return true; // pages without a nav entry (e.g. /settings) are open to any authed user
  return item.roles.includes(role);
}
