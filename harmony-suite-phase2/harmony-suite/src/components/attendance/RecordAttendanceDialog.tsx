import * as React from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { useEmployees } from '@/hooks/useEmployees'
import { useRecordAttendance } from '@/hooks/useAttendance'
import { EXPLICIT_ATTENDANCE_STATUSES } from '@/lib/attendanceCalculations'
import { ATTENDANCE_STATUS_LABEL } from '@/lib/attendanceLabels'

function todayISODate(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const NONE = 'none'

export function RecordAttendanceDialog({
  open,
  onOpenChange,
  defaultEmployeeId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultEmployeeId?: string
}) {
  const { data: employees } = useEmployees()
  const recordAttendance = useRecordAttendance()

  const [employeeId, setEmployeeId] = React.useState('')
  const [attendanceDate, setAttendanceDate] = React.useState(todayISODate())
  const [timeIn, setTimeIn] = React.useState('')
  const [timeOut, setTimeOut] = React.useState('')
  const [status, setStatus] = React.useState(NONE)
  const [errors, setErrors] = React.useState<Record<string, string>>({})

  React.useEffect(() => {
    if (open) {
      setEmployeeId(defaultEmployeeId ?? '')
      setAttendanceDate(todayISODate())
      setTimeIn('')
      setTimeOut('')
      setStatus(NONE)
      setErrors({})
    }
  }, [open, defaultEmployeeId])

  const onSubmit = () => {
    const nextErrors: Record<string, string> = {}
    if (!employeeId) nextErrors.employeeId = 'Select an employee.'
    if (!attendanceDate) nextErrors.attendanceDate = 'Date is required.'
    const isExplicitStatus = status !== NONE
    if (!isExplicitStatus && !timeIn && !timeOut) {
      nextErrors.timeIn = 'Enter a Time In, a Time Out, or choose a status.'
    }
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }

    recordAttendance.mutate(
      {
        employeeId,
        attendanceDate,
        timeIn: timeIn ? `${attendanceDate}T${timeIn}` : undefined,
        timeOut: timeOut ? `${attendanceDate}T${timeOut}` : undefined,
        status: isExplicitStatus ? (status as (typeof EXPLICIT_ATTENDANCE_STATUSES)[number]) : undefined,
      },
      { onSuccess: () => onOpenChange(false) }
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record Attendance</DialogTitle>
          <DialogDescription>Working hours, late, undertime, and overtime are calculated automatically.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>
                Employee <span className="text-destructive">*</span>
              </Label>
              <Select value={employeeId} onValueChange={setEmployeeId} disabled={!!defaultEmployeeId}>
                <SelectTrigger invalid={!!errors.employeeId}>
                  <SelectValue placeholder="Select employee" />
                </SelectTrigger>
                <SelectContent>
                  {employees?.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.first_name} {e.last_name} ({e.employee_number})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.employeeId && <p className="text-xs text-destructive">{errors.employeeId}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="attendance_date">
                Date <span className="text-destructive">*</span>
              </Label>
              <Input
                id="attendance_date"
                type="date"
                max={todayISODate()}
                invalid={!!errors.attendanceDate}
                value={attendanceDate}
                onChange={(e) => setAttendanceDate(e.target.value)}
              />
              {errors.attendanceDate && <p className="text-xs text-destructive">{errors.attendanceDate}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="time_in">Time In</Label>
              <Input id="time_in" type="time" invalid={!!errors.timeIn} value={timeIn} onChange={(e) => setTimeIn(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="time_out">Time Out</Label>
              <Input id="time_out" type="time" value={timeOut} onChange={(e) => setTimeOut(e.target.value)} />
            </div>
          </div>
          {errors.timeIn && <p className="-mt-2 text-xs text-destructive">{errors.timeIn}</p>}

          <div className="flex flex-col gap-1.5">
            <Label>Status Override (optional)</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Auto-calculated from time entries" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Auto-calculated from time entries</SelectItem>
                {EXPLICIT_ATTENDANCE_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {ATTENDANCE_STATUS_LABEL[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Use this for Absent, On Leave, Holiday, Rest Day, Official Business, or Work From Home.</p>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" loading={recordAttendance.isPending} onClick={onSubmit}>
            Save Attendance
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
