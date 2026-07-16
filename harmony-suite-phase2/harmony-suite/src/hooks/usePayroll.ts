import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import type { Tables, TablesInsert, EmploymentStatus } from '@/lib/database.types'
import { toast } from '@/components/ui/sonner'
import { fetchEffectiveSchedule } from '@/hooks/useAttendance'
import {
  dateRangesOverlap,
  countScheduledWorkingDays,
  calculateDailyRate,
  calculateHourlyRate,
  calculateOvertimePay,
  calculateHolidayPay,
  calculateLateDeduction,
  calculateUndertimeDeduction,
  calculateAbsenceDeduction,
  calculateLeaveWithoutPayDeduction,
  calculateGrossSalary,
  calculateNetSalary,
} from '@/lib/payrollCalculations'

const STANDARD_WORKING_DAYS_PER_MONTH = 22

export type PayrollPeriod = Tables<'payroll_periods'>
export type PayrollLineItem = Tables<'payroll_line_items'>

export type PayrollEmployee = Pick<
  Tables<'employees'>,
  'id' | 'employee_number' | 'first_name' | 'last_name' | 'email' | 'department_id' | 'position_id' | 'employment_status' | 'employment_type'
> & {
  departments: { id: string; name: string } | null
  positions: { id: string; title: string } | null
}

export type PayrollRecord = Tables<'payroll_records'> & {
  employees: PayrollEmployee
  payroll_line_items: PayrollLineItem[]
  payslips: Tables<'payslips'>[]
}

function byCreatedAtDesc<T extends { created_at: string }>(rows: T[] | null | undefined): T[] {
  return [...(rows ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at))
}

export function getLatestPayslip(record: PayrollRecord): Tables<'payslips'> | null {
  return byCreatedAtDesc(record.payslips)[0] ?? null
}

export function usePayrollPeriods() {
  return useQuery({
    queryKey: ['payroll-periods'],
    queryFn: async () => {
      const { data, error } = await supabase.from('payroll_periods').select('*').order('period_start', { ascending: false })
      if (error) throw error
      return data
    },
  })
}

const RECORD_SELECT = `
  *,
  employees (
    id, employee_number, first_name, last_name, email, department_id, position_id, employment_status, employment_type,
    departments (id, name),
    positions (id, title)
  ),
  payroll_line_items (*),
  payslips (*)
`

export function usePayrollRecords(periodId: string | undefined) {
  return useQuery({
    queryKey: ['payroll-records', periodId],
    queryFn: async () => {
      const { data, error } = await supabase.from('payroll_records').select(RECORD_SELECT).eq('payroll_period_id', periodId as string)
      if (error) throw error
      return data as unknown as PayrollRecord[]
    },
    enabled: !!periodId,
  })
}

export function usePayrollRecord(id: string | undefined) {
  return useQuery({
    queryKey: ['payroll-record', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('payroll_records').select(RECORD_SELECT).eq('id', id as string).maybeSingle()
      if (error) throw error
      return data as unknown as PayrollRecord | null
    },
    enabled: !!id,
  })
}

export function usePayrollPeriodStats(periodId: string | undefined) {
  return useQuery({
    queryKey: ['payroll-period-stats', periodId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payroll_records')
        .select('gross_salary, total_deductions, net_salary, status')
        .eq('payroll_period_id', periodId as string)
      if (error) throw error

      return {
        employeesIncluded: data.length,
        grossPayroll: data.reduce((sum, r) => sum + Number(r.gross_salary), 0),
        totalDeductions: data.reduce((sum, r) => sum + Number(r.total_deductions), 0),
        totalNetPayroll: data.reduce((sum, r) => sum + Number(r.net_salary), 0),
        payslipsReleased: data.filter((r) => r.status === 'released').length,
      }
    },
    enabled: !!periodId,
  })
}

function useInvalidatePayroll() {
  const queryClient = useQueryClient()
  return (periodId?: string, recordId?: string) => {
    queryClient.invalidateQueries({ queryKey: ['payroll-periods'] })
    if (periodId) {
      queryClient.invalidateQueries({ queryKey: ['payroll-records', periodId] })
      queryClient.invalidateQueries({ queryKey: ['payroll-period-stats', periodId] })
    }
    if (recordId) {
      queryClient.invalidateQueries({ queryKey: ['payroll-record', recordId] })
      queryClient.invalidateQueries({ queryKey: ['payroll-audit-log', recordId] })
    }
  }
}

// ---- Step 1: Create Payroll Period ----

export interface CreatePayrollPeriodInput {
  periodStart: string
  periodEnd: string
  payDate?: string
  frequency: 'weekly' | 'biweekly' | 'semi_monthly' | 'monthly'
}

export function useCreatePayrollPeriod() {
  const { profile } = useAuth()
  const invalidate = useInvalidatePayroll()
  return useMutation({
    mutationFn: async (input: CreatePayrollPeriodInput) => {
      if (input.periodStart > input.periodEnd) throw new Error('End Date cannot be earlier than Start Date.')

      const { data: existing, error: existingError } = await supabase.from('payroll_periods').select('period_start, period_end')
      if (existingError) throw existingError

      const overlaps = existing.some((p) => dateRangesOverlap(input.periodStart, input.periodEnd, p.period_start, p.period_end))
      if (overlaps) throw new Error('This payroll period overlaps an existing payroll period.')

      const { data, error } = await supabase
        .from('payroll_periods')
        .insert({
          period_start: input.periodStart,
          period_end: input.periodEnd,
          pay_date: input.payDate || null,
          frequency: input.frequency,
          status: 'draft',
          created_by: profile?.id,
        })
        .select('id')
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      invalidate()
      toast.success('Payroll period created')
    },
    onError: (error) => toast.error(error.message),
  })
}

// ---- Steps 2-10: Generate Payroll ----

const ACTIVE_EMPLOYMENT_STATUSES: EmploymentStatus[] = ['active', 'probationary', 'regular', 'contractual', 'temporary', 'on_leave']

export function useGeneratePayroll() {
  const { profile } = useAuth()
  const invalidate = useInvalidatePayroll()
  return useMutation({
    mutationFn: async ({ periodId }: { periodId: string }) => {
      const { data: period, error: periodError } = await supabase
        .from('payroll_periods')
        .select('period_start, period_end')
        .eq('id', periodId)
        .single()
      if (periodError) throw periodError

      const { data: employees, error: employeesError } = await supabase
        .from('employees')
        .select('id, basic_salary, currency, work_schedule_id')
        .in('employment_status', ACTIVE_EMPLOYMENT_STATUSES)
      if (employeesError) throw employeesError
      if (employees.length === 0) throw new Error('No active employees to include in this payroll.')

      const { data: regularHolidays, error: holidaysError } = await supabase
        .from('holidays')
        .select('holiday_date')
        .eq('holiday_type', 'regular')
        .gte('holiday_date', period.period_start)
        .lte('holiday_date', period.period_end)
      if (holidaysError) throw holidaysError

      let includedCount = 0
      for (const employee of employees) {
        const { data: existingRecord } = await supabase
          .from('payroll_records')
          .select('id')
          .eq('payroll_period_id', periodId)
          .eq('employee_id', employee.id)
          .maybeSingle()
        if (existingRecord) continue // already generated for this employee — skip rather than duplicate

        const schedule = await fetchEffectiveSchedule(employee.id)
        const workingDays = countScheduledWorkingDays(period.period_start, period.period_end, schedule)
        const dailyRate = calculateDailyRate(Number(employee.basic_salary), STANDARD_WORKING_DAYS_PER_MONTH)
        const hourlyRate = calculateHourlyRate(dailyRate, schedule)

        const { data: attendanceRows, error: attendanceError } = await supabase
          .from('attendance_records')
          .select('attendance_date, status, late_minutes, undertime_minutes, overtime_minutes')
          .eq('employee_id', employee.id)
          .gte('attendance_date', period.period_start)
          .lte('attendance_date', period.period_end)
        if (attendanceError) throw attendanceError

        const daysPresent = attendanceRows.filter((r) => ['present', 'late', 'half_day', 'work_from_home'].includes(r.status)).length
        const explicitAbsentDays = attendanceRows.filter((r) => r.status === 'absent').length
        const recordedDates = new Set(attendanceRows.map((r) => r.attendance_date))
        let unrecordedAbsentDays = 0
        const cursor = new Date(`${period.period_start}T00:00:00`)
        const end = new Date(`${period.period_end}T00:00:00`)
        while (cursor.getTime() <= end.getTime()) {
          const iso = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`
          if (!recordedDates.has(iso)) {
            const weekday = cursor.getDay()
            if (schedule.working_days.includes(weekday)) unrecordedAbsentDays++
          }
          cursor.setDate(cursor.getDate() + 1)
        }
        const absentDays = explicitAbsentDays + unrecordedAbsentDays
        const lateMinutes = attendanceRows.reduce((sum, r) => sum + r.late_minutes, 0)
        const undertimeMinutes = attendanceRows.reduce((sum, r) => sum + r.undertime_minutes, 0)
        const overtimeHours = attendanceRows.reduce((sum, r) => sum + r.overtime_minutes / 60, 0)

        const { data: leaveRequests, error: leaveError } = await supabase
          .from('leave_requests')
          .select('start_date, end_date, leave_types(is_paid)')
          .eq('employee_id', employee.id)
          .eq('status', 'approved')
          .lte('start_date', period.period_end)
          .gte('end_date', period.period_start)
        if (leaveError) throw leaveError

        let paidLeaveDays = 0
        let unpaidLeaveDays = 0
        for (const leave of leaveRequests) {
          const clippedStart = leave.start_date > period.period_start ? leave.start_date : period.period_start
          const clippedEnd = leave.end_date < period.period_end ? leave.end_date : period.period_end
          const days = Math.round((new Date(`${clippedEnd}T00:00:00`).getTime() - new Date(`${clippedStart}T00:00:00`).getTime()) / 86400000) + 1
          const isPaid = (leave.leave_types as unknown as { is_paid: boolean } | null)?.is_paid ?? true
          if (isPaid) paidLeaveDays += days
          else unpaidLeaveDays += days
        }

        const overtimePay = calculateOvertimePay(overtimeHours, hourlyRate)
        const holidayPay = calculateHolidayPay(regularHolidays.length, dailyRate)
        const lateDeduction = calculateLateDeduction(lateMinutes, hourlyRate)
        const undertimeDeduction = calculateUndertimeDeduction(undertimeMinutes, hourlyRate)
        const absenceDeduction = calculateAbsenceDeduction(absentDays, dailyRate)
        const leaveDeduction = calculateLeaveWithoutPayDeduction(unpaidLeaveDays, dailyRate)

        const totalAllowances = overtimePay + holidayPay
        const totalDeductions = lateDeduction + undertimeDeduction + absenceDeduction + leaveDeduction
        const periodBasicSalary = Math.round(dailyRate * workingDays * 100) / 100
        const grossSalary = calculateGrossSalary(periodBasicSalary, totalAllowances)
        const netSalary = calculateNetSalary(grossSalary, totalDeductions)

        const { data: record, error: recordError } = await supabase
          .from('payroll_records')
          .insert({
            payroll_period_id: periodId,
            employee_id: employee.id,
            basic_salary: periodBasicSalary,
            currency: employee.currency,
            total_allowances: totalAllowances,
            overtime_pay: overtimePay,
            holiday_pay: holidayPay,
            gross_salary: grossSalary,
            late_deduction: lateDeduction,
            undertime_deduction: undertimeDeduction,
            leave_deduction: leaveDeduction,
            other_deductions: 0,
            total_deductions: totalDeductions,
            net_salary: netSalary,
            working_days: workingDays,
            days_present: daysPresent,
            absent_days: absentDays,
            late_minutes: lateMinutes,
            undertime_minutes: undertimeMinutes,
            overtime_hours: overtimeHours,
            paid_leave_days: paidLeaveDays,
            unpaid_leave_days: unpaidLeaveDays,
            status: 'draft',
          })
          .select('id')
          .single()
        if (recordError) throw recordError

        const lineItems: TablesInsert<'payroll_line_items'>[] = []
        if (overtimePay > 0) lineItems.push({ payroll_record_id: record.id, item_type: 'allowance', label: 'Overtime Pay', amount: overtimePay })
        if (holidayPay > 0) lineItems.push({ payroll_record_id: record.id, item_type: 'allowance', label: 'Holiday Pay', amount: holidayPay })
        if (lateDeduction > 0) lineItems.push({ payroll_record_id: record.id, item_type: 'deduction', label: 'Late Deduction', amount: lateDeduction })
        if (undertimeDeduction > 0) lineItems.push({ payroll_record_id: record.id, item_type: 'deduction', label: 'Undertime Deduction', amount: undertimeDeduction })
        if (absenceDeduction > 0) lineItems.push({ payroll_record_id: record.id, item_type: 'deduction', label: 'Absences', amount: absenceDeduction })
        if (leaveDeduction > 0) lineItems.push({ payroll_record_id: record.id, item_type: 'deduction', label: 'Leave Without Pay', amount: leaveDeduction })
        if (lineItems.length > 0) {
          const { error: lineItemsError } = await supabase.from('payroll_line_items').insert(lineItems)
          if (lineItemsError) throw lineItemsError
        }

        includedCount++
      }

      await supabase.from('audit_logs').insert({
        actor_id: profile?.id,
        action: 'Payroll Generated',
        table_name: 'payroll_periods',
        record_id: periodId,
        new_data: { employees_included: includedCount },
      })

      return { includedCount }
    },
    onSuccess: ({ includedCount }, { periodId }) => {
      invalidate(periodId)
      toast.success(`Payroll generated for ${includedCount} employee${includedCount === 1 ? '' : 's'}.`)
    },
    onError: (error) => toast.error(error.message),
  })
}

// ---- Steps 11-12: HR Reviews Payroll ----

export function useReviewPayroll() {
  const { profile } = useAuth()
  const invalidate = useInvalidatePayroll()
  return useMutation({
    mutationFn: async ({ periodId }: { periodId: string }) => {
      const { error: recordsError } = await supabase
        .from('payroll_records')
        .update({ status: 'reviewed', reviewed_by: profile?.id })
        .eq('payroll_period_id', periodId)
      if (recordsError) throw recordsError

      const { error: periodError } = await supabase.from('payroll_periods').update({ status: 'reviewed' }).eq('id', periodId)
      if (periodError) throw periodError

      await supabase.from('audit_logs').insert({
        actor_id: profile?.id,
        action: 'Payroll Reviewed',
        table_name: 'payroll_periods',
        record_id: periodId,
      })
    },
    onSuccess: (_data, { periodId }) => {
      invalidate(periodId)
      toast.success('Payroll reviewed and approved.')
    },
    onError: (error) => toast.error(error.message),
  })
}

// ---- Step 13: Edit / Adjust Payroll ----

export interface AddPayrollLineItemInput {
  recordId: string
  periodId: string
  itemType: 'allowance' | 'deduction'
  label: string
  amount: number
  reason: string
  notes?: string
}

export function useAddPayrollLineItem() {
  const { profile } = useAuth()
  const invalidate = useInvalidatePayroll()
  return useMutation({
    mutationFn: async (input: AddPayrollLineItemInput) => {
      const { data: record, error: recordError } = await supabase
        .from('payroll_records')
        .select('gross_salary, total_deductions, net_salary, total_allowances, other_deductions')
        .eq('id', input.recordId)
        .single()
      if (recordError) throw recordError

      const { error: lineItemError } = await supabase.from('payroll_line_items').insert({
        payroll_record_id: input.recordId,
        item_type: input.itemType,
        label: input.label,
        amount: input.amount,
      })
      if (lineItemError) throw lineItemError

      const isAllowance = input.itemType === 'allowance'
      const newAllowances = isAllowance ? Number(record.total_allowances) + input.amount : Number(record.total_allowances)
      const newOtherDeductions = isAllowance ? Number(record.other_deductions) : Number(record.other_deductions) + input.amount
      const newDeductions = isAllowance ? Number(record.total_deductions) : Number(record.total_deductions) + input.amount
      const newGross = isAllowance ? Number(record.gross_salary) + input.amount : Number(record.gross_salary)
      const newNet = calculateNetSalary(newGross, newDeductions)

      const { error: updateError } = await supabase
        .from('payroll_records')
        .update({
          total_allowances: newAllowances,
          other_deductions: newOtherDeductions,
          total_deductions: newDeductions,
          gross_salary: newGross,
          net_salary: newNet,
          notes: input.notes || null,
          status: 'draft',
        })
        .eq('id', input.recordId)
      if (updateError) throw updateError

      // Adjusting after review means the whole batch needs re-approval.
      await supabase.from('payroll_periods').update({ status: 'draft' }).eq('id', input.periodId).eq('status', 'reviewed')

      await supabase.from('audit_logs').insert({
        actor_id: profile?.id,
        action: 'Payroll Adjusted',
        table_name: 'payroll_records',
        record_id: input.recordId,
        old_data: { net_salary: record.net_salary },
        new_data: { net_salary: newNet, added: { type: input.itemType, label: input.label, amount: input.amount }, reason: input.reason },
      })
    },
    onSuccess: (_data, { periodId, recordId }) => {
      invalidate(periodId, recordId)
      toast.success('Payroll record adjusted')
    },
    onError: (error) => toast.error(error.message),
  })
}

// ---- Steps 14-16: Generate Payslip, Release, Save ----

export function useReleasePayroll() {
  const { profile } = useAuth()
  const invalidate = useInvalidatePayroll()
  return useMutation({
    mutationFn: async ({ periodId }: { periodId: string }) => {
      const { data: period, error: periodError } = await supabase.from('payroll_periods').select('status').eq('id', periodId).single()
      if (periodError) throw periodError
      if (period.status !== 'reviewed') throw new Error('Payroll must be reviewed before it can be released.')

      const { data: records, error: recordsError } = await supabase
        .from('payroll_records')
        .select('id')
        .eq('payroll_period_id', periodId)
      if (recordsError) throw recordsError

      const now = new Date().toISOString()
      for (const record of records) {
        await supabase.from('payslips').insert({ payroll_record_id: record.id, released_at: now })
      }

      const { error: recordsUpdateError } = await supabase
        .from('payroll_records')
        .update({ status: 'released', released_at: now })
        .eq('payroll_period_id', periodId)
      if (recordsUpdateError) throw recordsUpdateError

      const { error: periodUpdateError } = await supabase.from('payroll_periods').update({ status: 'released' }).eq('id', periodId)
      if (periodUpdateError) throw periodUpdateError

      await supabase.from('audit_logs').insert([
        { actor_id: profile?.id, action: 'Payslip Generated', table_name: 'payroll_periods', record_id: periodId },
        { actor_id: profile?.id, action: 'Payslip Released', table_name: 'payroll_periods', record_id: periodId },
      ])
    },
    onSuccess: (_data, { periodId }) => {
      invalidate(periodId)
      toast.success('Payroll successfully completed.')
    },
    onError: (error) => toast.error(error.message),
  })
}

export function usePayrollAuditLog(recordId: string | undefined) {
  return useQuery({
    queryKey: ['payroll-audit-log', recordId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*, actor:profiles(full_name)')
        .eq('table_name', 'payroll_records')
        .eq('record_id', recordId as string)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
    enabled: !!recordId,
  })
}

export function usePayrollRealtimeAlerts() {
  const queryClient = useQueryClient()
  React.useEffect(() => {
    const refresh = () => {
      queryClient.invalidateQueries({ queryKey: ['payroll-periods'] })
      queryClient.invalidateQueries({ queryKey: ['payroll-records'] })
      queryClient.invalidateQueries({ queryKey: ['payroll-period-stats'] })
    }
    const channel = supabase
      .channel('payroll-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payroll_records' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payroll_periods' }, refresh)
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [queryClient])
}
