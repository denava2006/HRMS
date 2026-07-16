import type { Tables } from '@/lib/database.types'

export type WorkSchedule = Pick<Tables<'work_schedules'>, 'working_days' | 'start_time' | 'end_time' | 'break_minutes'>

/** Statuses HR sets explicitly and that calculation must never overwrite —
 * only present/late/half_day are derived from time_in/time_out. */
export const EXPLICIT_ATTENDANCE_STATUSES = [
  'absent',
  'on_leave',
  'holiday',
  'rest_day',
  'official_business',
  'work_from_home',
] as const

/** `start_time`/`end_time` are schedule wall-clock times (no timezone, e.g.
 * "08:00:00"); `attendanceDate` is the plain calendar date. Combined and
 * parsed as browser-local time, matching how the rest of the app treats
 * dates (no explicit timezone normalization anywhere else either). */
function scheduledDateTime(attendanceDate: string, time: string): Date {
  return new Date(`${attendanceDate}T${time}`)
}

export function getScheduledHours(schedule: WorkSchedule): number {
  const start = scheduledDateTime('2000-01-01', schedule.start_time)
  const end = scheduledDateTime('2000-01-01', schedule.end_time)
  const minutes = Math.max(0, (end.getTime() - start.getTime()) / 60000 - schedule.break_minutes)
  return minutes / 60
}

export function isScheduledWorkingDay(attendanceDate: string, schedule: WorkSchedule): boolean {
  const day = new Date(`${attendanceDate}T00:00:00`).getDay()
  return schedule.working_days.includes(day)
}

export function calculateLateMinutes(attendanceDate: string, timeIn: Date, schedule: WorkSchedule): number {
  const scheduledStart = scheduledDateTime(attendanceDate, schedule.start_time)
  const diffMinutes = (timeIn.getTime() - scheduledStart.getTime()) / 60000
  return diffMinutes > 0 ? Math.round(diffMinutes) : 0
}

export function calculateWorkingHours(timeIn: Date, timeOut: Date, breakMinutes: number): number {
  const minutes = Math.max(0, (timeOut.getTime() - timeIn.getTime()) / 60000 - breakMinutes)
  return Math.round((minutes / 60) * 100) / 100
}

export function calculateUndertimeMinutes(attendanceDate: string, timeOut: Date, schedule: WorkSchedule): number {
  const scheduledEnd = scheduledDateTime(attendanceDate, schedule.end_time)
  const diffMinutes = (scheduledEnd.getTime() - timeOut.getTime()) / 60000
  return diffMinutes > 0 ? Math.round(diffMinutes) : 0
}

export function calculateOvertimeMinutes(attendanceDate: string, timeOut: Date, schedule: WorkSchedule): number {
  const scheduledEnd = scheduledDateTime(attendanceDate, schedule.end_time)
  const diffMinutes = (timeOut.getTime() - scheduledEnd.getTime()) / 60000
  return diffMinutes > 0 ? Math.round(diffMinutes) : 0
}

/** Present/Late/Half Day are the only statuses derived from time entries —
 * everything else (Absent, On Leave, Holiday, Rest Day, Official Business,
 * Work From Home) is an explicit HR choice, never inferred. */
export function deriveAttendanceStatus(workingHours: number, lateMinutes: number, scheduledHours: number): 'present' | 'late' | 'half_day' {
  if (scheduledHours > 0 && workingHours > 0 && workingHours < scheduledHours / 2) return 'half_day'
  if (lateMinutes > 0) return 'late'
  return 'present'
}

export interface AttendanceMetrics {
  workingHours: number
  lateMinutes: number
  undertimeMinutes: number
  overtimeMinutes: number
  status: 'present' | 'late' | 'half_day'
}

/** The Step 3-6 calculation chain from the attendance flow, run as one pass
 * once both Time In and Time Out are known. */
export function calculateAttendanceMetrics(attendanceDate: string, timeIn: Date, timeOut: Date, schedule: WorkSchedule): AttendanceMetrics {
  const workingHours = calculateWorkingHours(timeIn, timeOut, schedule.break_minutes)
  const lateMinutes = calculateLateMinutes(attendanceDate, timeIn, schedule)
  const undertimeMinutes = calculateUndertimeMinutes(attendanceDate, timeOut, schedule)
  const overtimeMinutes = calculateOvertimeMinutes(attendanceDate, timeOut, schedule)
  const scheduledHours = getScheduledHours(schedule)
  const status = deriveAttendanceStatus(workingHours, lateMinutes, scheduledHours)
  return { workingHours, lateMinutes, undertimeMinutes, overtimeMinutes, status }
}

export function formatMinutesAsDuration(minutes: number): string {
  if (minutes <= 0) return '0m'
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

export function formatHoursAsDuration(hours: number): string {
  return formatMinutesAsDuration(Math.round(hours * 60))
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function formatWorkingDays(days: number[]): string {
  const sorted = [...days].sort((a, b) => a - b)
  return sorted.map((d) => DAY_LABELS[d]).join(', ')
}

export function formatScheduleTime(time: string): string {
  const [h, m] = time.split(':').map(Number)
  const period = h >= 12 ? 'PM' : 'AM'
  const hour12 = h % 12 === 0 ? 12 : h % 12
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`
}
