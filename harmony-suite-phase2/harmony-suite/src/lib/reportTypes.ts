import type { ReportFormat } from '@/lib/database.types'
import type { ChartDatum } from '@/lib/reportPalette'

export type ReportType = 'recruitment' | 'employee' | 'attendance' | 'leave' | 'payroll' | 'overall_hr'

export const REPORT_TYPES: ReportType[] = ['recruitment', 'employee', 'attendance', 'leave', 'payroll', 'overall_hr']

export const REPORT_TYPE_LABEL: Record<ReportType, string> = {
  recruitment: 'Recruitment Report',
  employee: 'Employee Report',
  attendance: 'Attendance Report',
  leave: 'Leave Report',
  payroll: 'Payroll Report',
  overall_hr: 'Overall HR Report',
}

export const REPORT_TYPE_DESCRIPTION: Record<ReportType, string> = {
  recruitment: 'Applicants, hiring pipeline, and job vacancy activity.',
  employee: 'Headcount, roster, and workforce composition.',
  attendance: 'Time in/out records, punctuality, and overtime.',
  leave: 'Leave requests, approvals, and credit usage.',
  payroll: 'Gross pay, deductions, net pay, and payslip status.',
  overall_hr: 'A combined executive snapshot across every module.',
}

export const REPORT_FORMAT_LABEL: Record<ReportFormat, string> = {
  pdf: 'PDF',
  docx: 'Word (DOCX)',
  excel: 'Excel',
}

export interface ReportFilters {
  dateFrom: string
  dateTo: string
  departmentId: string
  positionId: string
  employmentStatus: string
  applicationStatus: string
  attendanceStatus: string
  leaveTypeId: string
  leaveStatus: string
  payrollStatus: string
}

export const ALL_FILTER = 'all'

export function defaultReportFilters(): ReportFilters {
  const today = new Date()
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
  const toISODate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  return {
    dateFrom: toISODate(monthStart),
    dateTo: toISODate(today),
    departmentId: ALL_FILTER,
    positionId: ALL_FILTER,
    employmentStatus: ALL_FILTER,
    applicationStatus: ALL_FILTER,
    attendanceStatus: ALL_FILTER,
    leaveTypeId: ALL_FILTER,
    leaveStatus: ALL_FILTER,
    payrollStatus: ALL_FILTER,
  }
}

export interface ReportSummaryStat {
  label: string
  value: string
}

export interface ReportChartSpec {
  title: string
  kind: 'bar' | 'line' | 'pie' | 'doughnut'
  data: ChartDatum[]
  valueLabel?: string
}

export interface ReportColumn {
  key: string
  header: string
}

export type ReportRow = Record<string, string | number>

export interface ReportResult {
  reportType: ReportType
  title: string
  filters: ReportFilters
  generatedAt: string
  summary: ReportSummaryStat[]
  charts: ReportChartSpec[]
  columns: ReportColumn[]
  rows: ReportRow[]
}
