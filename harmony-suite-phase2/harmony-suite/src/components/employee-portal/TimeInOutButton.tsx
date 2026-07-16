import { AlertCircle, LogIn, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useMyEmployeeRecord, useMyTodayAttendance } from '@/hooks/useEmployeePortal'
import { useRecordAttendance } from '@/hooks/useAttendance'

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
 * state (holiday/leave/time-in/time-out/done) is derived exactly once. */
export function TimeInOutButton() {
  const { data: myEmployee, isLoading: isLoadingEmployee } = useMyEmployeeRecord()
  const { data: today, isLoading: isLoadingToday } = useMyTodayAttendance()
  const recordAttendance = useRecordAttendance()

  if (isLoadingEmployee || isLoadingToday || !myEmployee) {
    return <Skeleton className="h-9 w-32" />
  }

  if (today?.isHoliday) {
    return <InfoBanner message={`Today is a company holiday${today.holidayName ? ` — ${today.holidayName}` : ''}.`} />
  }

  if (today?.onApprovedLeave) {
    return <InfoBanner message={`You are currently on approved leave${today.leaveTypeName ? ` (${today.leaveTypeName})` : ''}.`} />
  }

  const record = today?.record

  if (!record) {
    const todayISODate = new Date().toISOString().slice(0, 10)
    return (
      <Button
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
    )
  }

  if (!record.time_out) {
    return (
      <Button
        variant="secondary"
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
    )
  }

  return <Badge variant="success">Attendance recorded for today</Badge>
}
