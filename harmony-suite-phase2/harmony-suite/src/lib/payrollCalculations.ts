import { isScheduledWorkingDay, getScheduledHours, type WorkSchedule } from '@/lib/attendanceCalculations'

export function dateRangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart <= bEnd && bStart <= aEnd
}

/** Scheduled working days within [periodStart, periodEnd], inclusive, per the
 * employee's work schedule — the denominator for daily/hourly rate. */
export function countScheduledWorkingDays(periodStart: string, periodEnd: string, schedule: WorkSchedule): number {
  let count = 0
  const cursor = new Date(`${periodStart}T00:00:00`)
  const end = new Date(`${periodEnd}T00:00:00`)
  while (cursor.getTime() <= end.getTime()) {
    const iso = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`
    if (isScheduledWorkingDay(iso, schedule)) count++
    cursor.setDate(cursor.getDate() + 1)
  }
  return count
}

export function calculateDailyRate(basicSalary: number, workingDaysInPeriod: number): number {
  return workingDaysInPeriod > 0 ? basicSalary / workingDaysInPeriod : 0
}

export function calculateHourlyRate(dailyRate: number, schedule: WorkSchedule): number {
  const scheduledHours = getScheduledHours(schedule)
  return scheduledHours > 0 ? dailyRate / scheduledHours : 0
}

/** Standard Philippine ordinary-overtime premium (125% of the hourly rate). */
export function calculateOvertimePay(overtimeHours: number, hourlyRate: number, multiplier = 1.25): number {
  return round2(overtimeHours * hourlyRate * multiplier)
}

/** Regular holidays are paid in full whether worked or not; special/company
 * holidays follow "no work, no pay" unless HR adds pay manually as an
 * allowance line item during Step 13 (Edit/Adjust Payroll). */
export function calculateHolidayPay(regularHolidayCount: number, dailyRate: number): number {
  return round2(regularHolidayCount * dailyRate)
}

export function calculateLateDeduction(lateMinutes: number, hourlyRate: number): number {
  return round2((lateMinutes / 60) * hourlyRate)
}

export function calculateUndertimeDeduction(undertimeMinutes: number, hourlyRate: number): number {
  return round2((undertimeMinutes / 60) * hourlyRate)
}

export function calculateAbsenceDeduction(absentDays: number, dailyRate: number): number {
  return round2(absentDays * dailyRate)
}

export function calculateLeaveWithoutPayDeduction(unpaidLeaveDays: number, dailyRate: number): number {
  return round2(unpaidLeaveDays * dailyRate)
}

export function calculateGrossSalary(basicSalary: number, totalAllowances: number): number {
  return round2(basicSalary + totalAllowances)
}

export function calculateNetSalary(grossSalary: number, totalDeductions: number): number {
  return round2(grossSalary - totalDeductions)
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

function todayISODate(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export { todayISODate }
