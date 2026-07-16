import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import type { Tables, TablesInsert, TablesUpdate, AttendanceStatus } from '@/lib/database.types'
import { toast } from '@/components/ui/sonner'
import {
  calculateAttendanceMetrics,
  isScheduledWorkingDay,
  EXPLICIT_ATTENDANCE_STATUSES,
  type WorkSchedule,
} from '@/lib/attendanceCalculations'

const ATTENDANCE_SELECT = `
  *,
  employees (
    id, employee_number, first_name, last_name, email, department_id, position_id, employment_status,
    departments (id, name),
    positions (id, title)
  )
`

export type AttendanceEmployee = Pick<
  Tables<'employees'>,
  'id' | 'employee_number' | 'first_name' | 'last_name' | 'email' | 'department_id' | 'position_id' | 'employment_status'
> & {
  departments: { id: string; name: string } | null
  positions: { id: string; title: string } | null
}

export type AttendanceRecord = Tables<'attendance_records'> & { employees: AttendanceEmployee }

const LIST_KEY = ['attendance-records']

export function useAttendanceRecords(dateFrom: string, dateTo: string) {
  return useQuery({
    queryKey: [...LIST_KEY, dateFrom, dateTo],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('attendance_records')
        .select(ATTENDANCE_SELECT)
        .gte('attendance_date', dateFrom)
        .lte('attendance_date', dateTo)
        .order('attendance_date', { ascending: false })
      if (error) throw error
      return data as unknown as AttendanceRecord[]
    },
  })
}

export function useAttendanceRecord(id: string | undefined) {
  return useQuery({
    queryKey: [...LIST_KEY, 'detail', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('attendance_records').select(ATTENDANCE_SELECT).eq('id', id as string).maybeSingle()
      if (error) throw error
      return data as unknown as AttendanceRecord | null
    },
    enabled: !!id,
  })
}

function todayISODate(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** The 6 dashboard summary cards, computed for a single day (defaults to
 * today). "Absent" isn't a status anyone sets directly here — it's derived as
 * active employees who were scheduled to work today but have no attendance
 * row at all (and today isn't a holiday). */
export function useAttendanceStats(dateISO: string = todayISODate()) {
  return useQuery({
    queryKey: ['attendance-stats', dateISO],
    queryFn: async () => {
      const [employeesRes, recordsRes, holidayRes] = await Promise.all([
        supabase
          .from('employees')
          .select('id, work_schedule_id, employment_status, work_schedules(working_days)')
          .in('employment_status', ['active', 'probationary', 'regular', 'contractual', 'temporary']),
        supabase.from('attendance_records').select('employee_id, status, overtime_minutes').eq('attendance_date', dateISO),
        supabase.from('holidays').select('id').eq('holiday_date', dateISO).limit(1),
      ])
      if (employeesRes.error) throw employeesRes.error
      if (recordsRes.error) throw recordsRes.error
      if (holidayRes.error) throw holidayRes.error

      const records = recordsRes.data
      const isHoliday = (holidayRes.data?.length ?? 0) > 0
      const weekday = new Date(`${dateISO}T00:00:00`).getDay()

      const presentCount = records.filter((r) => r.status === 'present').length
      const lateCount = records.filter((r) => r.status === 'late').length
      const onLeaveCount = records.filter((r) => r.status === 'on_leave').length
      const remoteCount = records.filter((r) => r.status === 'work_from_home').length
      const overtimeCount = records.filter((r) => r.overtime_minutes > 0).length

      const recordedEmployeeIds = new Set(records.map((r) => r.employee_id))
      const absentCount = isHoliday
        ? 0
        : employeesRes.data.filter((emp) => {
            const schedule = emp.work_schedules as unknown as { working_days: number[] } | null
            const workingDays = schedule?.working_days ?? [1, 2, 3, 4, 5]
            return workingDays.includes(weekday) && !recordedEmployeeIds.has(emp.id)
          }).length

      return { presentCount, absentCount, lateCount, onLeaveCount, overtimeCount, remoteCount }
    },
  })
}

function useInvalidateAttendance() {
  const queryClient = useQueryClient()
  return (employeeId?: string) => {
    queryClient.invalidateQueries({ queryKey: LIST_KEY })
    queryClient.invalidateQueries({ queryKey: ['attendance-stats'] })
    if (employeeId) queryClient.invalidateQueries({ queryKey: ['employee-attendance-summary', employeeId] })
  }
}

/** The employee's assigned schedule, falling back to whichever schedule is
 * marked default. Calculations must always use a schedule (spec's Work
 * Schedule section), so this throws a clear error if neither exists. */
export async function fetchEffectiveSchedule(employeeId: string): Promise<WorkSchedule> {
  const { data: employee, error: employeeError } = await supabase
    .from('employees')
    .select('work_schedule_id, work_schedules(working_days, start_time, end_time, break_minutes)')
    .eq('id', employeeId)
    .single()
  if (employeeError) throw employeeError

  const assigned = employee.work_schedules as unknown as WorkSchedule | null
  if (assigned) return assigned

  const { data: defaultSchedule, error: defaultError } = await supabase
    .from('work_schedules')
    .select('working_days, start_time, end_time, break_minutes')
    .eq('is_default', true)
    .maybeSingle()
  if (defaultError) throw defaultError
  if (!defaultSchedule) throw new Error('No default work schedule configured. Set one in Administration → Work Schedules.')
  return defaultSchedule
}

export interface RecordAttendanceInput {
  employeeId: string
  attendanceDate: string
  timeIn?: string
  timeOut?: string
  status?: (typeof EXPLICIT_ATTENDANCE_STATUSES)[number]
  remarks?: string
}

export function useRecordAttendance() {
  const invalidate = useInvalidateAttendance()
  return useMutation({
    mutationFn: async (input: RecordAttendanceInput) => {
      const { data: existing, error: existingError } = await supabase
        .from('attendance_records')
        .select('id, time_in, time_out')
        .eq('employee_id', input.employeeId)
        .eq('attendance_date', input.attendanceDate)
        .maybeSingle()
      if (existingError) throw existingError

      if (input.timeIn && existing?.time_in) {
        throw new Error('Time In has already been recorded for this date. Use Correct Attendance to change it.')
      }
      if (existing?.time_out && (input.timeIn || input.timeOut)) {
        throw new Error('Time Out has already been recorded for this date. Use Correct Attendance to change it.')
      }

      const timeIn = input.timeIn ? new Date(input.timeIn) : existing?.time_in ? new Date(existing.time_in) : null
      const timeOut = input.timeOut ? new Date(input.timeOut) : null
      if (timeIn && timeOut && timeOut.getTime() <= timeIn.getTime()) {
        throw new Error('Time Out must be later than Time In.')
      }

      const payload: TablesInsert<'attendance_records'> = {
        employee_id: input.employeeId,
        attendance_date: input.attendanceDate,
      }
      // time_in/time_out arrive as timezone-less local strings (e.g.
      // "2026-07-16T08:18") — Postgres would interpret those as UTC for a
      // timestamptz column, silently disagreeing with the browser-local Date
      // parsing used for calculation below. Converting through Date first and
      // sending .toISOString() keeps both interpretations of "local" in sync.
      if (input.timeIn) payload.time_in = new Date(input.timeIn).toISOString()
      if (input.timeOut) payload.time_out = new Date(input.timeOut).toISOString()

      if (input.status && EXPLICIT_ATTENDANCE_STATUSES.includes(input.status)) {
        payload.status = input.status
        if (timeIn && timeOut) {
          const schedule = await fetchEffectiveSchedule(input.employeeId)
          const metrics = calculateAttendanceMetrics(input.attendanceDate, timeIn, timeOut, schedule)
          payload.working_hours = metrics.workingHours
          payload.late_minutes = metrics.lateMinutes
          payload.undertime_minutes = metrics.undertimeMinutes
          payload.overtime_minutes = metrics.overtimeMinutes
        }
      } else if (timeIn && timeOut) {
        const schedule = await fetchEffectiveSchedule(input.employeeId)
        const metrics = calculateAttendanceMetrics(input.attendanceDate, timeIn, timeOut, schedule)
        payload.working_hours = metrics.workingHours
        payload.late_minutes = metrics.lateMinutes
        payload.undertime_minutes = metrics.undertimeMinutes
        payload.overtime_minutes = metrics.overtimeMinutes
        payload.status = metrics.status
      } else if (timeIn && !timeOut) {
        const schedule = await fetchEffectiveSchedule(input.employeeId)
        const lateMinutes = timeIn.getTime() > new Date(`${input.attendanceDate}T${schedule.start_time}`).getTime()
          ? Math.round((timeIn.getTime() - new Date(`${input.attendanceDate}T${schedule.start_time}`).getTime()) / 60000)
          : 0
        payload.late_minutes = lateMinutes
        payload.status = lateMinutes > 0 ? 'late' : 'present'
      }

      const { error } = await supabase.from('attendance_records').upsert(payload, { onConflict: 'employee_id,attendance_date' })
      if (error) throw error
    },
    onSuccess: (_data, { employeeId, timeOut }) => {
      invalidate(employeeId)
      toast.success(timeOut ? 'Time Out recorded successfully.' : 'Time In recorded successfully.')
    },
    onError: (error) => toast.error(error.message),
  })
}

export interface CorrectAttendanceInput {
  recordId: string
  employeeId: string
  attendanceDate: string
  timeIn: string | null
  timeOut: string | null
  status: AttendanceStatus
  reason: string
}

export function useCorrectAttendance() {
  const { profile } = useAuth()
  const invalidate = useInvalidateAttendance()
  return useMutation({
    mutationFn: async (input: CorrectAttendanceInput) => {
      const { data: previous, error: previousError } = await supabase
        .from('attendance_records')
        .select('*')
        .eq('id', input.recordId)
        .single()
      if (previousError) throw previousError

      // See useRecordAttendance for why these go through Date -> toISOString()
      // rather than being sent as the raw timezone-less local strings.
      const payload: TablesUpdate<'attendance_records'> = {
        time_in: input.timeIn ? new Date(input.timeIn).toISOString() : null,
        time_out: input.timeOut ? new Date(input.timeOut).toISOString() : null,
        status: input.status,
      }

      if (input.timeIn && input.timeOut) {
        const schedule = await fetchEffectiveSchedule(input.employeeId)
        const metrics = calculateAttendanceMetrics(input.attendanceDate, new Date(input.timeIn), new Date(input.timeOut), schedule)
        payload.working_hours = metrics.workingHours
        payload.late_minutes = metrics.lateMinutes
        payload.undertime_minutes = metrics.undertimeMinutes
        payload.overtime_minutes = metrics.overtimeMinutes
        if (!EXPLICIT_ATTENDANCE_STATUSES.includes(input.status as (typeof EXPLICIT_ATTENDANCE_STATUSES)[number])) {
          payload.status = metrics.status
        }
      } else {
        payload.working_hours = 0
        payload.late_minutes = 0
        payload.undertime_minutes = 0
        payload.overtime_minutes = 0
      }

      const { error } = await supabase.from('attendance_records').update(payload).eq('id', input.recordId)
      if (error) throw error

      await supabase.from('audit_logs').insert({
        actor_id: profile?.id,
        action: 'Attendance Corrected',
        table_name: 'attendance_records',
        record_id: input.recordId,
        old_data: { time_in: previous.time_in, time_out: previous.time_out, status: previous.status },
        new_data: { time_in: payload.time_in, time_out: payload.time_out, status: payload.status, reason: input.reason },
      })
    },
    onSuccess: (_data, { employeeId }) => {
      invalidate(employeeId)
      toast.success('Attendance record saved successfully.')
    },
    onError: (error) => toast.error(error.message),
  })
}

export function useAttendanceAuditLog(recordId: string | undefined) {
  return useQuery({
    queryKey: ['attendance-audit-log', recordId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*, actor:profiles(full_name)')
        .eq('table_name', 'attendance_records')
        .eq('record_id', recordId as string)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
    enabled: !!recordId,
  })
}

export interface EmployeeAttendanceSummary {
  present: number
  late: number
  absent: number
  onLeave: number
  overtimeHours: number
  workingHours: number
  attendancePercentage: number
}

function summarize(rows: Pick<Tables<'attendance_records'>, 'status' | 'working_hours' | 'overtime_minutes'>[]): EmployeeAttendanceSummary {
  const present = rows.filter((r) => r.status === 'present').length
  const late = rows.filter((r) => r.status === 'late').length
  const absent = rows.filter((r) => r.status === 'absent').length
  const onLeave = rows.filter((r) => r.status === 'on_leave').length
  const overtimeHours = rows.reduce((sum, r) => sum + r.overtime_minutes / 60, 0)
  const workingHours = rows.reduce((sum, r) => sum + Number(r.working_hours), 0)
  const trackedDays = rows.length
  const attendancePercentage = trackedDays > 0 ? Math.round(((present + late) / trackedDays) * 100) : 0
  return { present, late, absent, onLeave, overtimeHours, workingHours, attendancePercentage }
}

/** Today/This Week/This Month/Overall attendance stats for one employee —
 * shown on the Employee Details page per the Employee Attendance Summary spec. */
export function useEmployeeAttendanceSummary(employeeId: string | undefined) {
  return useQuery({
    queryKey: ['employee-attendance-summary', employeeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('attendance_records')
        .select('attendance_date, status, working_hours, overtime_minutes')
        .eq('employee_id', employeeId as string)
        .order('attendance_date', { ascending: false })
      if (error) throw error

      const today = todayISODate()
      const now = new Date()
      const startOfWeek = new Date(now)
      startOfWeek.setDate(now.getDate() - now.getDay())
      const weekStartISO = `${startOfWeek.getFullYear()}-${String(startOfWeek.getMonth() + 1).padStart(2, '0')}-${String(startOfWeek.getDate()).padStart(2, '0')}`
      const monthStartISO = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`

      return {
        today: summarize(data.filter((r) => r.attendance_date === today)),
        thisWeek: summarize(data.filter((r) => r.attendance_date >= weekStartISO)),
        thisMonth: summarize(data.filter((r) => r.attendance_date >= monthStartISO)),
        overall: summarize(data),
      }
    },
    enabled: !!employeeId,
  })
}

export function useAttendanceRealtimeAlerts() {
  const queryClient = useQueryClient()
  React.useEffect(() => {
    const refresh = () => {
      queryClient.invalidateQueries({ queryKey: LIST_KEY })
      queryClient.invalidateQueries({ queryKey: ['attendance-stats'] })
    }
    const channel = supabase
      .channel('attendance-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance_records' }, refresh)
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [queryClient])
}

export { isScheduledWorkingDay }
