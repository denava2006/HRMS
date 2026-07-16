import type { AttendanceStatus } from '@/lib/database.types'
import type { BadgeProps } from '@/components/ui/badge'

export const ATTENDANCE_STATUS_LABEL: Record<AttendanceStatus, string> = {
  present: 'Present',
  late: 'Late',
  absent: 'Absent',
  half_day: 'Half Day',
  on_leave: 'On Leave',
  holiday: 'Holiday',
  rest_day: 'Rest Day',
  official_business: 'Official Business',
  work_from_home: 'Work From Home',
}

export const ATTENDANCE_STATUS_VARIANT: Record<AttendanceStatus, BadgeProps['variant']> = {
  present: 'success',
  late: 'warning',
  absent: 'destructive',
  half_day: 'secondary',
  on_leave: 'outline',
  holiday: 'muted',
  rest_day: 'muted',
  official_business: 'secondary',
  work_from_home: 'secondary',
}

export const HOLIDAY_TYPE_LABEL: Record<string, string> = {
  regular: 'Regular Holiday',
  special: 'Special Holiday',
  company: 'Company Holiday',
}

export const ATTENDANCE_HISTORY_EVENT_LABEL: Record<string, string> = {
  time_in_recorded: 'Time In Recorded',
  time_out_recorded: 'Time Out Recorded',
  attendance_calculated: 'Attendance Calculated & Saved',
  attendance_corrected: 'Attendance Corrected',
}
