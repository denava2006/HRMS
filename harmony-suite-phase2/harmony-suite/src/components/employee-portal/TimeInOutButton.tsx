import * as React from 'react'
import { AlertCircle, LogIn, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useMyEmployeeRecord, useMyTodayAttendance } from '@/hooks/useEmployeePortal'
import { useRecordAttendance } from '@/hooks/useAttendance'
import { useWorkSchedules } from '@/hooks/useWorkSchedules'
import { validateTimeIn, validateTimeOut } from '@/lib/attendanceCalculations'

function InfoBanner({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning">
      <AlertCircle className="h-4 w-4 shrink-0" />
      <span>{message}</span>
    </div>
  )
}

/** The single Time In / Time Out action, shared by the Employee Dashboard's
 * Today's Attendance widget and the Attendance page itself so the button's
 * state (leave/time-in/time-out/done) is derived exactly once. */
export function TimeInOutButton() {
  const { data: myEmployee, isLoading: isLoadingEmployee } = useMyEmployeeRecord()
  const { data: today, isLoading: isLoadingToday } = useMyTodayAttendance()
  const { data: workSchedules } = useWorkSchedules()
  const recordAttendance = useRecordAttendance()

  // Re-evaluated every half minute so the button unlocks on its own when the
  // window opens, instead of only after the employee reloads the page.
  const [now, setNow] = React.useState(() => new Date())
  React.useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(id)
  }, [])

  const defaultSchedule = workSchedules?.find((s) => s.is_default) ?? null

  if (isLoadingEmployee || isLoadingToday || !myEmployee) {
    return <Skeleton className="h-9 w-32" />
  }

  if (today?.onApprovedLeave) {
    return <InfoBanner message={`You are currently on approved leave${today.leaveTypeName ? ` (${today.leaveTypeName})` : ''}.`} />
  }

  const record = today?.record
  const schedule = myEmployee.work_schedules ?? defaultSchedule ?? null

  if (!record) {
    const todayISODate = new Date().toISOString().slice(0, 10)
    // The mutation refuses an out-of-window entry regardless; checking here too
    // means the employee reads *why* before clicking, not after.
    const blocked = schedule ? validateTimeIn(todayISODate, now, schedule) : null
    return (
      <div className="flex flex-col items-end gap-1.5">
        <Button
          disabled={!!blocked}
          loading={recordAttendance.isPending}
          onClick={() =>
            recordAttendance.mutate({
              employeeId: myEmployee.id,
              attendanceDate: todayISODate,
              timeIn: new Date().toISOString(),
            })
          }
        >
          <LogIn className="h-4 w-4" />
          Time In
        </Button>
        {blocked && <p className="max-w-xs text-right text-xs text-muted-foreground">{blocked}</p>}
      </div>
    )
  }

  if (!record.time_out) {
    const blocked = schedule ? validateTimeOut(record.attendance_date, now, schedule) : null
    return (
      <div className="flex flex-col items-end gap-1.5">
        <Button
          variant="secondary"
          disabled={!!blocked}
          loading={recordAttendance.isPending}
          onClick={() =>
            recordAttendance.mutate({
              employeeId: myEmployee.id,
              attendanceDate: record.attendance_date,
              timeOut: new Date().toISOString(),
            })
          }
        >
          <LogOut className="h-4 w-4" />
          Time Out
        </Button>
        {blocked && <p className="max-w-xs text-right text-xs text-muted-foreground">{blocked}</p>}
      </div>
    )
  }

  return <Badge variant="success">Attendance recorded for today</Badge>
}
