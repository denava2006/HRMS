import * as React from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { useCorrectAttendance, type AttendanceRecord } from '@/hooks/useAttendance'
import { ATTENDANCE_STATUS_LABEL } from '@/lib/attendanceLabels'
import type { AttendanceStatus } from '@/lib/database.types'

const CORRECTION_REASON_PRESETS = ['Forgot Time In', 'Forgot Time Out', 'Device Failure', 'Manual Correction', 'Other'] as const

function toTimeInputValue(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toTimeString().slice(0, 5)
}

export function CorrectAttendanceDialog({
  open,
  onOpenChange,
  record,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  record: AttendanceRecord | null
}) {
  const correctAttendance = useCorrectAttendance()

  const [timeIn, setTimeIn] = React.useState('')
  const [timeOut, setTimeOut] = React.useState('')
  const [status, setStatus] = React.useState<AttendanceStatus>('present')
  const [reasonPreset, setReasonPreset] = React.useState<string>(CORRECTION_REASON_PRESETS[0])
  const [customReason, setCustomReason] = React.useState('')
  const [errors, setErrors] = React.useState<Record<string, string>>({})
  const [confirmOpen, setConfirmOpen] = React.useState(false)

  React.useEffect(() => {
    if (open && record) {
      setTimeIn(toTimeInputValue(record.time_in))
      setTimeOut(toTimeInputValue(record.time_out))
      setStatus(record.status)
      setReasonPreset(CORRECTION_REASON_PRESETS[0])
      setCustomReason('')
      setErrors({})
    }
  }, [open, record])

  if (!record) return null

  const reason = reasonPreset === 'Other' ? customReason.trim() : reasonPreset

  const onSubmit = () => {
    const nextErrors: Record<string, string> = {}
    if (!reason) nextErrors.reason = 'A reason is required.'
    if (timeIn && timeOut && timeOut <= timeIn) nextErrors.timeOut = 'Time Out must be later than Time In.'
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }
    setConfirmOpen(true)
  }

  const onConfirm = () => {
    setConfirmOpen(false)
    correctAttendance.mutate(
      {
        recordId: record.id,
        employeeId: record.employee_id,
        attendanceDate: record.attendance_date,
        timeIn: timeIn ? `${record.attendance_date}T${timeIn}` : null,
        timeOut: timeOut ? `${record.attendance_date}T${timeOut}` : null,
        status,
        reason,
      },
      { onSuccess: () => onOpenChange(false) }
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Correct Attendance</DialogTitle>
          <DialogDescription>
            {record.employees.first_name} {record.employees.last_name} — {new Date(`${record.attendance_date}T00:00:00`).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="correct_time_in">Time In</Label>
              <Input id="correct_time_in" type="time" value={timeIn} onChange={(e) => setTimeIn(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="correct_time_out">Time Out</Label>
              <Input id="correct_time_out" type="time" invalid={!!errors.timeOut} value={timeOut} onChange={(e) => setTimeOut(e.target.value)} />
              {errors.timeOut && <p className="text-xs text-destructive">{errors.timeOut}</p>}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Attendance Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as AttendanceStatus)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.entries(ATTENDANCE_STATUS_LABEL) as [AttendanceStatus, string][]).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>
              Reason <span className="text-destructive">*</span>
            </Label>
            <Select value={reasonPreset} onValueChange={setReasonPreset}>
              <SelectTrigger invalid={!!errors.reason}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CORRECTION_REASON_PRESETS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {reasonPreset === 'Other' && (
              <Textarea
                invalid={!!errors.reason}
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                placeholder="Describe the correction reason"
                rows={2}
              />
            )}
            {errors.reason && <p className="text-xs text-destructive">{errors.reason}</p>}
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" loading={correctAttendance.isPending} onClick={onSubmit}>
            Save Correction
          </Button>
        </DialogFooter>
      </DialogContent>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Save this correction?</AlertDialogTitle>
            <AlertDialogDescription>
              This will update the attendance record for {record.employees.first_name} {record.employees.last_name} and log the change with reason
              "{reason}" in the audit log.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onConfirm}>Confirm</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  )
}
