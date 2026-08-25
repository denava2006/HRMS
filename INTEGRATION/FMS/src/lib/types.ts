// -----------------------------------------------------------------------------
// Domain types — mirror the enums and core tables defined in the SQL migrations.
// -----------------------------------------------------------------------------

export type UserRole =
  | "employee"
  | "finance_staff"
  | "finance_manager"
  | "accountant"
  | "administrator";

export type RequestType = "purchase" | "reimbursement";

export type RequestStatus =
  | "draft"
  | "pending_finance_staff"
  | "pending_finance_manager"
  | "pending_accountant"
  | "completed"
  | "returned"
  | "rejected"
  | "cancelled";

export type ApprovalAction =
  | "submitted"
  | "edited"
  | "resubmitted"
  | "validated"
  | "final_approved"
  | "completed"
  | "returned"
  | "rejected"
  | "cancelled";

export type PaymentMethod =
  | "bank_transfer"
  | "check"
  | "cash"
  | "gcash"
  | "credit_card";

export type TransactionType = "income" | "expense";
export type BudgetPeriod = "monthly" | "quarterly" | "yearly";
export type NotificationType =
  | "info"
  | "approval"
  | "rejection"
  | "payment"
  | "system";

/**
 * Return shape of the form Server Actions that are consumed with
 * `useActionState`, so validation problems render inline instead of throwing.
 */
export interface FormState {
  ok?: boolean;
  error?: string;
}

/**
 * Figures behind a "Budget Validation Failed" block, computed when a finance
 * approver tries to advance a request its department cannot afford.
 *
 *   remaining = allocated - approvedExpenses
 *   shortage  = requested - remaining
 */
export interface BudgetValidation {
  departmentName: string;
  budgetName: string;
  allocated: number;
  approvedExpenses: number;
  remaining: number;
  requested: number;
  shortage: number;
}

/** Result of an approval decision, consumed with `useActionState`. */
export interface ApprovalState {
  ok?: boolean;
  error?: string;
  budgetBlock?: BudgetValidation;
}

export interface Department {
  id: string;
  name: string;
  code: string;
  description: string | null;
  manager_id: string | null;
  created_at: string;
}

export interface Profile {
  id: string;
  employee_no: string | null;
  full_name: string;
  email: string;
  role: UserRole;
  department_id: string | null;
  position: string | null;
  phone: string | null;
  avatar_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  department?: Department | null;
}

export interface Category {
  id: string;
  name: string;
  type: TransactionType;
  description: string | null;
  is_active: boolean;
}

export interface Vendor {
  id: string;
  name: string;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  tin: string | null;
  is_active: boolean;
}

export interface Budget {
  id: string;
  name: string;
  department_id: string | null;
  category_id: string | null;
  period: BudgetPeriod;
  fiscal_year: number;
  amount: number;
  allocated: number;
  spent: number;
  start_date: string | null;
  end_date: string | null;
  status: string;
  alert_threshold: number;
  created_at: string;
  department?: Department | null;
}

export interface FinanceRequest {
  id: string;
  request_no: string | null;
  type: RequestType;
  title: string;
  description: string | null;
  justification: string | null;
  requester_id: string;
  department_id: string | null;
  vendor_id: string | null;
  category_id: string | null;
  budget_id: string | null;
  amount: number;
  priority: "low" | "medium" | "high";
  needed_by: string | null;
  expense_date: string | null;
  status: RequestStatus;
  payment_schedule: string | null;
  created_at: string;
  updated_at: string;
  requester?: Profile | null;
  department?: Department | null;
  category?: Category | null;
  vendor?: Vendor | null;
}

export interface RequestApproval {
  id: string;
  request_id: string;
  actor_id: string | null;
  action: ApprovalAction;
  role_at_action: UserRole | null;
  from_status: RequestStatus | null;
  to_status: RequestStatus | null;
  remarks: string | null;
  created_at: string;
  actor?: Profile | null;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  body: string | null;
  type: NotificationType;
  link: string | null;
  request_id: string | null;
  is_read: boolean;
  created_at: string;
}

export interface AuditLog {
  id: string;
  actor_id: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  description: string | null;
  changes: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
  actor?: Profile | null;
}
