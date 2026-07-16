import { supabase } from '@/lib/supabase'
import { formatMoney } from '@/lib/currency'
import type { CurrencyCode } from '@/lib/currency'
import { APPLICATION_STATUS_LABEL } from '@/lib/applicationStatusLabels'
import { ATTENDANCE_STATUS_LABEL } from '@/lib/attendanceLabels'
import { EMPLOYMENT_STATUS_LABEL } from '@/lib/employeeLabels'
import { LEAVE_STATUS_LABEL } from '@/lib/leaveLabels'
import { PAYROLL_STATUS_LABEL } from '@/lib/payrollLabels'
import { assignCategoricalColors, assignStatusColors, bucketTopNPlusOther, countBy, sumBy } from '@/lib/reportPalette'
import { ALL_FILTER, REPORT_TYPE_LABEL, type ReportFilters, type ReportResult, type ReportType } from '@/lib/reportTypes'

function dayStartISO(date: string): string {
  return new Date(`${date}T00:00:00`).toISOString()
}
function dayEndISO(date: string): string {
  return new Date(`${date}T23:59:59.999`).toISOString()
}
function fullName(p: { first_name: string; last_name: string } | null | undefined): string {
  return p ? `${p.first_name} ${p.last_name}` : '—'
}

async function generateRecruitmentReport(filters: ReportFilters): Promise<ReportResult> {
  let query = supabase
    .from('applications')
    .select('id, status, created_at, applicants(first_name,last_name,email), job_postings(id,department_id,position_id,vacancies,departments(name),positions(title))')
    .gte('created_at', dayStartISO(filters.dateFrom))
    .lte('created_at', dayEndISO(filters.dateTo))
    .order('created_at', { ascending: false })
  const { data, error } = await query
  if (error) throw error

  const rows = (data ?? []).filter((a) => {
    const jp = a.job_postings
    if (filters.departmentId !== ALL_FILTER && jp?.department_id !== filters.departmentId) return false
    if (filters.positionId !== ALL_FILTER && jp?.position_id !== filters.positionId) return false
    if (filters.applicationStatus !== ALL_FILTER && a.status !== filters.applicationStatus) return false
    return true
  })

  const total = rows.length
  const qualified = rows.filter((r) => r.status === 'qualified').length
  const interviewed = rows.filter((r) => ['interview_scheduled', 'offered', 'hired', 'deployed'].includes(r.status)).length
  const hired = rows.filter((r) => r.status === 'hired' || r.status === 'deployed').length
  const rejected = rows.filter((r) => r.status === 'rejected').length
  const distinctPostings = new Map<string, number>()
  for (const r of rows) {
    if (r.job_postings?.id) distinctPostings.set(r.job_postings.id, r.job_postings.vacancies ?? 0)
  }
  const totalVacancies = [...distinctPostings.values()].reduce((a, b) => a + b, 0)

  const byPosition = countBy(rows, (r) => r.job_postings?.positions?.title)
  const byStatus = countBy(rows, (r) => APPLICATION_STATUS_LABEL[r.status])

  return {
    reportType: 'recruitment',
    title: REPORT_TYPE_LABEL.recruitment,
    filters,
    generatedAt: new Date().toISOString(),
    summary: [
      { label: 'Total Applicants', value: String(total) },
      { label: 'Qualified', value: String(qualified) },
      { label: 'Interviewed', value: String(interviewed) },
      { label: 'Hired', value: String(hired) },
      { label: 'Rejected', value: String(rejected) },
      { label: 'Open Vacancies', value: String(totalVacancies) },
    ],
    charts: [
      { title: 'Applications by Position', kind: 'bar', data: assignCategoricalColors([...byPosition.entries()].map(([name, value]) => ({ name, value }))) },
      { title: 'Application Status Distribution', kind: 'pie', data: assignStatusColors(bucketTopNPlusOther(byStatus)) },
    ],
    columns: [
      { key: 'applicant', header: 'Applicant Name' },
      { key: 'position', header: 'Position Applied' },
      { key: 'department', header: 'Department' },
      { key: 'date', header: 'Application Date' },
      { key: 'status', header: 'Status' },
    ],
    rows: rows.map((r) => ({
      applicant: fullName(r.applicants),
      position: r.job_postings?.positions?.title ?? '—',
      department: r.job_postings?.departments?.name ?? '—',
      date: new Date(r.created_at).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }),
      status: APPLICATION_STATUS_LABEL[r.status],
    })),
  }
}

async function generateEmployeeReport(filters: ReportFilters): Promise<ReportResult> {
  let query = supabase
    .from('employees')
    .select('id,employee_number,first_name,last_name,email,department_id,position_id,employment_status,employment_type,hire_date,basic_salary,currency,departments(name),positions(title)')
    .gte('hire_date', filters.dateFrom)
    .lte('hire_date', filters.dateTo)
    .order('hire_date', { ascending: false })
  const { data, error } = await query
  if (error) throw error

  const rows = (data ?? []).filter((e) => {
    if (filters.departmentId !== ALL_FILTER && e.department_id !== filters.departmentId) return false
    if (filters.positionId !== ALL_FILTER && e.position_id !== filters.positionId) return false
    if (filters.employmentStatus !== ALL_FILTER && e.employment_status !== filters.employmentStatus) return false
    return true
  })

  const active = rows.filter((r) => r.employment_status === 'active' || r.employment_status === 'regular').length
  const probationary = rows.filter((r) => r.employment_status === 'probationary').length
  const separated = rows.filter((r) => ['resigned', 'terminated', 'retired'].includes(r.employment_status)).length

  const byDepartment = countBy(rows, (r) => r.departments?.name)
  const byStatus = countBy(rows, (r) => EMPLOYMENT_STATUS_LABEL[r.employment_status])

  return {
    reportType: 'employee',
    title: REPORT_TYPE_LABEL.employee,
    filters,
    generatedAt: new Date().toISOString(),
    summary: [
      { label: 'Total Employees', value: String(rows.length) },
      { label: 'Active / Regular', value: String(active) },
      { label: 'Probationary', value: String(probationary) },
      { label: 'Separated', value: String(separated) },
    ],
    charts: [
      { title: 'Employees per Department', kind: 'bar', data: assignCategoricalColors([...byDepartment.entries()].map(([name, value]) => ({ name, value }))) },
      { title: 'Employment Status Distribution', kind: 'doughnut', data: assignStatusColors(bucketTopNPlusOther(byStatus)) },
    ],
    columns: [
      { key: 'employee_id', header: 'Employee ID' },
      { key: 'name', header: 'Name' },
      { key: 'department', header: 'Department' },
      { key: 'position', header: 'Position' },
      { key: 'status', header: 'Employment Status' },
      { key: 'hire_date', header: 'Hire Date' },
    ],
    rows: rows.map((r) => ({
      employee_id: r.employee_number,
      name: fullName(r),
      department: r.departments?.name ?? '—',
      position: r.positions?.title ?? '—',
      status: EMPLOYMENT_STATUS_LABEL[r.employment_status],
      hire_date: new Date(`${r.hire_date}T00:00:00`).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }),
    })),
  }
}

async function generateAttendanceReport(filters: ReportFilters): Promise<ReportResult> {
  let query = supabase
    .from('attendance_records')
    .select('id,attendance_date,status,working_hours,late_minutes,overtime_minutes,employees(employee_number,first_name,last_name,department_id,position_id,departments(name),positions(title))')
    .gte('attendance_date', filters.dateFrom)
    .lte('attendance_date', filters.dateTo)
    .order('attendance_date', { ascending: false })
  const { data, error } = await query
  if (error) throw error

  const rows = (data ?? []).filter((r) => {
    if (filters.departmentId !== ALL_FILTER && r.employees?.department_id !== filters.departmentId) return false
    if (filters.positionId !== ALL_FILTER && r.employees?.position_id !== filters.positionId) return false
    if (filters.attendanceStatus !== ALL_FILTER && r.status !== filters.attendanceStatus) return false
    return true
  })

  const present = rows.filter((r) => r.status === 'present').length
  const absent = rows.filter((r) => r.status === 'absent').length
  const late = rows.filter((r) => r.late_minutes > 0).length
  const totalOvertimeHours = rows.reduce((sum, r) => sum + r.overtime_minutes / 60, 0)
  const avgWorkingHours = rows.length ? rows.reduce((sum, r) => sum + Number(r.working_hours ?? 0), 0) / rows.length : 0

  const byStatus = countBy(rows, (r) => ATTENDANCE_STATUS_LABEL[r.status])
  const byDate = sumBy(rows, (r) => r.attendance_date, (r) => (r.status === 'present' || r.status === 'late' ? 1 : 0))
  const dailyTrend = [...byDate.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([name, value]) => ({ name: new Date(`${name}T00:00:00`).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' }), value }))

  return {
    reportType: 'attendance',
    title: REPORT_TYPE_LABEL.attendance,
    filters,
    generatedAt: new Date().toISOString(),
    summary: [
      { label: 'Total Records', value: String(rows.length) },
      { label: 'Present', value: String(present) },
      { label: 'Absent', value: String(absent) },
      { label: 'Late', value: String(late) },
      { label: 'Total Overtime (hrs)', value: totalOvertimeHours.toFixed(1) },
      { label: 'Avg. Working Hours', value: avgWorkingHours.toFixed(1) },
    ],
    charts: [
      { title: 'Attendance Status Distribution', kind: 'bar', data: assignStatusColors(bucketTopNPlusOther(byStatus)) },
      { title: 'Daily Present Count', kind: 'line', data: dailyTrend.map((d) => ({ ...d, color: '#2a78d6' })) },
    ],
    columns: [
      { key: 'employee_id', header: 'Employee ID' },
      { key: 'name', header: 'Employee Name' },
      { key: 'department', header: 'Department' },
      { key: 'date', header: 'Date' },
      { key: 'status', header: 'Status' },
      { key: 'late', header: 'Late (min)' },
      { key: 'overtime', header: 'Overtime (min)' },
      { key: 'hours', header: 'Working Hours' },
    ],
    rows: rows.map((r) => ({
      employee_id: r.employees?.employee_number ?? '—',
      name: fullName(r.employees),
      department: r.employees?.departments?.name ?? '—',
      date: new Date(`${r.attendance_date}T00:00:00`).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }),
      status: ATTENDANCE_STATUS_LABEL[r.status],
      late: r.late_minutes,
      overtime: r.overtime_minutes,
      hours: Number(r.working_hours ?? 0).toFixed(2),
    })),
  }
}

async function generateLeaveReport(filters: ReportFilters): Promise<ReportResult> {
  let query = supabase
    .from('leave_requests')
    .select('id,start_date,end_date,days_requested,status,leave_types(name),employees(employee_number,first_name,last_name,department_id,position_id,departments(name))')
    .lte('start_date', filters.dateTo)
    .gte('end_date', filters.dateFrom)
    .order('start_date', { ascending: false })
  const { data, error } = await query
  if (error) throw error

  const rows = (data ?? []).filter((r) => {
    if (filters.departmentId !== ALL_FILTER && r.employees?.department_id !== filters.departmentId) return false
    if (filters.positionId !== ALL_FILTER && r.employees?.position_id !== filters.positionId) return false
    if (filters.leaveStatus !== ALL_FILTER && r.status !== filters.leaveStatus) return false
    if (filters.leaveTypeId !== ALL_FILTER && r.leave_types === null) return false
    return true
  })

  const approved = rows.filter((r) => r.status === 'approved').length
  const rejected = rows.filter((r) => r.status === 'rejected').length
  const pending = rows.filter((r) => r.status === 'pending').length
  const totalDaysApproved = rows.filter((r) => r.status === 'approved').reduce((sum, r) => sum + Number(r.days_requested), 0)

  const byType = countBy(rows, (r) => r.leave_types?.name)
  const byStatus = countBy(rows, (r) => LEAVE_STATUS_LABEL[r.status])

  return {
    reportType: 'leave',
    title: REPORT_TYPE_LABEL.leave,
    filters,
    generatedAt: new Date().toISOString(),
    summary: [
      { label: 'Total Requests', value: String(rows.length) },
      { label: 'Approved', value: String(approved) },
      { label: 'Rejected', value: String(rejected) },
      { label: 'Pending', value: String(pending) },
      { label: 'Total Days Approved', value: totalDaysApproved.toFixed(1) },
    ],
    charts: [
      { title: 'Requests by Leave Type', kind: 'pie', data: assignCategoricalColors(bucketTopNPlusOther(byType)) },
      { title: 'Requests by Status', kind: 'bar', data: assignStatusColors(bucketTopNPlusOther(byStatus)) },
    ],
    columns: [
      { key: 'employee_id', header: 'Employee ID' },
      { key: 'name', header: 'Employee Name' },
      { key: 'leave_type', header: 'Leave Type' },
      { key: 'start_date', header: 'Start Date' },
      { key: 'end_date', header: 'End Date' },
      { key: 'days', header: 'Days' },
      { key: 'status', header: 'Status' },
    ],
    rows: rows.map((r) => ({
      employee_id: r.employees?.employee_number ?? '—',
      name: fullName(r.employees),
      leave_type: r.leave_types?.name ?? '—',
      start_date: new Date(`${r.start_date}T00:00:00`).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }),
      end_date: new Date(`${r.end_date}T00:00:00`).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }),
      days: Number(r.days_requested),
      status: LEAVE_STATUS_LABEL[r.status],
    })),
  }
}

async function generatePayrollReport(filters: ReportFilters): Promise<ReportResult> {
  const { data, error } = await supabase
    .from('payroll_records')
    .select(
      'id,gross_salary,total_deductions,net_salary,status,currency,employees(employee_number,first_name,last_name,department_id,position_id,departments(name)),payroll_periods(period_start,period_end)'
    )
    .order('created_at', { ascending: false })
  if (error) throw error

  const rows = (data ?? []).filter((r) => {
    const period = r.payroll_periods
    if (period && (period.period_end < filters.dateFrom || period.period_start > filters.dateTo)) return false
    if (filters.departmentId !== ALL_FILTER && r.employees?.department_id !== filters.departmentId) return false
    if (filters.positionId !== ALL_FILTER && r.employees?.position_id !== filters.positionId) return false
    if (filters.payrollStatus !== ALL_FILTER && r.status !== filters.payrollStatus) return false
    return true
  })

  const currency = (rows[0]?.currency ?? 'PHP') as CurrencyCode
  const totalGross = rows.reduce((sum, r) => sum + Number(r.gross_salary), 0)
  const totalDeductions = rows.reduce((sum, r) => sum + Number(r.total_deductions), 0)
  const totalNet = rows.reduce((sum, r) => sum + Number(r.net_salary), 0)
  const released = rows.filter((r) => r.status === 'released').length

  const netByDepartment = sumBy(rows, (r) => r.employees?.departments?.name, (r) => Number(r.net_salary))
  const byStatus = countBy(rows, (r) => PAYROLL_STATUS_LABEL[r.status])

  return {
    reportType: 'payroll',
    title: REPORT_TYPE_LABEL.payroll,
    filters,
    generatedAt: new Date().toISOString(),
    summary: [
      { label: 'Payroll Records', value: String(rows.length) },
      { label: 'Total Gross', value: formatMoney(totalGross, currency) },
      { label: 'Total Deductions', value: formatMoney(totalDeductions, currency) },
      { label: 'Total Net Pay', value: formatMoney(totalNet, currency) },
      { label: 'Payslips Released', value: String(released) },
    ],
    charts: [
      { title: 'Net Pay by Department', kind: 'bar', data: assignCategoricalColors([...netByDepartment.entries()].map(([name, value]) => ({ name, value: Math.round(value) }))) },
      { title: 'Payroll Status Distribution', kind: 'doughnut', data: assignStatusColors(bucketTopNPlusOther(byStatus)) },
    ],
    columns: [
      { key: 'employee_id', header: 'Employee ID' },
      { key: 'name', header: 'Employee Name' },
      { key: 'department', header: 'Department' },
      { key: 'gross', header: 'Gross Salary' },
      { key: 'deductions', header: 'Deductions' },
      { key: 'net', header: 'Net Salary' },
      { key: 'status', header: 'Status' },
    ],
    rows: rows.map((r) => ({
      employee_id: r.employees?.employee_number ?? '—',
      name: fullName(r.employees),
      department: r.employees?.departments?.name ?? '—',
      gross: formatMoney(Number(r.gross_salary), r.currency as CurrencyCode),
      deductions: formatMoney(Number(r.total_deductions), r.currency as CurrencyCode),
      net: formatMoney(Number(r.net_salary), r.currency as CurrencyCode),
      status: PAYROLL_STATUS_LABEL[r.status],
    })),
  }
}

async function generateOverallHrReport(filters: ReportFilters): Promise<ReportResult> {
  const [recruitment, employee, attendance, leave, payroll] = await Promise.all([
    generateRecruitmentReport(filters),
    generateEmployeeReport(filters),
    generateAttendanceReport(filters),
    generateLeaveReport(filters),
    generatePayrollReport(filters),
  ])

  const findStat = (result: ReportResult, label: string) => result.summary.find((s) => s.label === label)?.value ?? '0'

  return {
    reportType: 'overall_hr',
    title: REPORT_TYPE_LABEL.overall_hr,
    filters,
    generatedAt: new Date().toISOString(),
    summary: [
      { label: 'Total Employees', value: findStat(employee, 'Total Employees') },
      { label: 'New Applicants', value: findStat(recruitment, 'Total Applicants') },
      { label: 'Attendance Records', value: findStat(attendance, 'Total Records') },
      { label: 'Leave Requests', value: findStat(leave, 'Total Requests') },
      { label: 'Total Net Payroll', value: findStat(payroll, 'Total Net Pay') },
      { label: 'Payslips Released', value: findStat(payroll, 'Payslips Released') },
    ],
    charts: [employee.charts[0], payroll.charts[1], leave.charts[0], attendance.charts[0]],
    columns: [
      { key: 'module', header: 'Module' },
      { key: 'metric', header: 'Metric' },
      { key: 'value', header: 'Value' },
    ],
    rows: [
      ...recruitment.summary.map((s) => ({ module: 'Recruitment', metric: s.label, value: s.value })),
      ...employee.summary.map((s) => ({ module: 'Employee', metric: s.label, value: s.value })),
      ...attendance.summary.map((s) => ({ module: 'Attendance', metric: s.label, value: s.value })),
      ...leave.summary.map((s) => ({ module: 'Leave', metric: s.label, value: s.value })),
      ...payroll.summary.map((s) => ({ module: 'Payroll', metric: s.label, value: s.value })),
    ],
  }
}

export async function generateReport(reportType: ReportType, filters: ReportFilters): Promise<ReportResult> {
  switch (reportType) {
    case 'recruitment':
      return generateRecruitmentReport(filters)
    case 'employee':
      return generateEmployeeReport(filters)
    case 'attendance':
      return generateAttendanceReport(filters)
    case 'leave':
      return generateLeaveReport(filters)
    case 'payroll':
      return generatePayrollReport(filters)
    case 'overall_hr':
      return generateOverallHrReport(filters)
  }
}
