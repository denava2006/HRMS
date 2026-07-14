export type UserRole = 'admin' | 'hr'

export type ApplicantStatus =
  | 'draft'
  | 'submitted'
  | 'under_review'
  | 'rejected'
  | 'qualified'
  | 'initial_interview'
  | 'initial_failed'
  | 'final_interview_scheduled'
  | 'final_interview'
  | 'hired'
  | 'offer_sent'
  | 'offer_declined'
  | 'offer_accepted'
  | 'contract_prepared'
  | 'contract_signed'
  | 'deployed'
  | 'employee_created'
  | 'closed'

export type EmploymentStatus = 'active' | 'inactive' | 'terminated' | 'on_leave'

export type LeaveStatus = 'pending' | 'approved' | 'rejected'

export type PayrollStatus = 'draft' | 'review' | 'approved' | 'released'

export type ReportType =
  | 'recruitment'
  | 'employee'
  | 'attendance'
  | 'leave'
  | 'payroll'
  | 'overall_hr'

export type ExportFormat = 'pdf' | 'excel'

export interface Profile {
  id: string
  email: string
  full_name: string
  role: UserRole
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface HrStaff {
  id: string
  user_id: string
  full_name: string
  email: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Department {
  id: string
  name: string
  description: string | null
  created_at: string
  updated_at: string
}

export interface SalaryGrade {
  id: string
  grade_level: string
  base_salary: number
  description: string | null
  created_at: string
  updated_at: string
}

export interface Position {
  id: string
  title: string
  department_id: string
  salary_grade_id: string | null
  description: string | null
  created_at: string
  updated_at: string
  department?: Department
  salary_grade?: SalaryGrade
}

export interface SystemSetting {
  id: string
  key: string
  value: string
  description: string | null
  updated_at: string
}

export interface AuditLog {
  id: string
  actor_id: string | null
  action: string
  entity_type: string
  entity_id: string | null
  details: string | null
  created_at: string
  actor?: Profile
}

export interface JobPosting {
  id: string
  title: string
  department_id: string
  position_id: string
  description: string
  requirements: string | null
  is_active: boolean
  published_at: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  department?: Department
  position?: Position
}

export interface Applicant {
  id: string
  job_posting_id: string
  full_name: string
  email: string
  phone: string | null
  address: string | null
  resume_url: string | null
  status: ApplicantStatus
  notes: string | null
  created_at: string
  updated_at: string
  job_posting?: JobPosting
}

export interface Interview {
  id: string
  applicant_id: string
  interview_type: 'initial' | 'final'
  scheduled_at: string | null
  conducted_at: string | null
  interviewer_id: string | null
  result: 'passed' | 'failed' | 'pending' | null
  notes: string | null
  created_at: string
  updated_at: string
  applicant?: Applicant
}

export interface JobOffer {
  id: string
  applicant_id: string
  salary: number
  start_date: string
  status: 'pending' | 'accepted' | 'declined'
  sent_at: string | null
  responded_at: string | null
  created_at: string
  updated_at: string
  applicant?: Applicant
}

export interface EmploymentContract {
  id: string
  applicant_id: string
  job_offer_id: string
  contract_url: string | null
  status: 'prepared' | 'printed' | 'signed'
  prepared_at: string | null
  signed_at: string | null
  created_at: string
  updated_at: string
}

export interface Employee {
  id: string
  employee_id: string
  applicant_id: string | null
  user_id: string | null
  full_name: string
  email: string
  phone: string | null
  department_id: string
  position_id: string
  employment_status: EmploymentStatus
  hire_date: string
  created_at: string
  updated_at: string
  department?: Department
  position?: Position
}

export interface EmployeeDocument {
  id: string
  employee_id: string
  document_type: string
  file_url: string
  uploaded_at: string
}

export interface Attendance {
  id: string
  employee_id: string
  date: string
  time_in: string | null
  time_out: string | null
  working_hours: number
  late_minutes: number
  undertime_minutes: number
  overtime_hours: number
  created_at: string
  updated_at: string
  employee?: Employee
}

export interface LeaveRequest {
  id: string
  employee_id: string
  leave_type: string
  start_date: string
  end_date: string
  days_requested: number
  reason: string | null
  status: LeaveStatus
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
  updated_at: string
  employee?: Employee
}

export interface LeaveBalance {
  id: string
  employee_id: string
  leave_type: string
  total_credits: number
  used_credits: number
  remaining_credits: number
  updated_at: string
}

export interface PayrollPeriod {
  id: string
  name: string
  start_date: string
  end_date: string
  status: PayrollStatus
  created_at: string
}

export interface Payroll {
  id: string
  payroll_period_id: string
  employee_id: string
  basic_salary: number
  allowances: number
  gross_salary: number
  deductions: number
  net_salary: number
  status: PayrollStatus
  payslip_url: string | null
  created_at: string
  updated_at: string
  employee?: Employee
  payroll_period?: PayrollPeriod
}

export interface PayrollItem {
  id: string
  payroll_id: string
  item_type: 'allowance' | 'deduction'
  description: string
  amount: number
}

export interface Report {
  id: string
  report_type: ReportType
  title: string
  filters: Record<string, unknown>
  file_url: string | null
  export_format: ExportFormat
  generated_by: string | null
  created_at: string
}

export interface DashboardStats {
  totalEmployees: number
  activeEmployees: number
  newApplicants: number
  pendingLeaveRequests: number
  payrollStatus: string
  upcomingInterviews: number
}

export interface DatabaseBackup {
  id: string
  file_url: string | null
  backup_type: 'backup' | 'restore'
  status: string
  created_by: string | null
  created_at: string
}
