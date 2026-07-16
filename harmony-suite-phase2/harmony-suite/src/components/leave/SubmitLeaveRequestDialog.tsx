import * as React from 'react'
import { FileText, Upload, X } from 'lucide-react'
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
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { useEmployees } from '@/hooks/useEmployees'
import { useLeaveTypes, useCreateLeaveRequest, validateLeaveDocumentFile } from '@/hooks/useLeave'
import { calculateLeaveDays, todayISODate } from '@/lib/leaveCalculations'

function formatFileSize(bytes: number) {
  return bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function SubmitLeaveRequestDialog({
  open,
  onOpenChange,
  defaultEmployeeId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultEmployeeId?: string
}) {
  const { data: employees } = useEmployees()
  const { data: leaveTypes } = useLeaveTypes()
  const createLeaveRequest = useCreateLeaveRequest()

  const [employeeId, setEmployeeId] = React.useState('')
  const [leaveTypeId, setLeaveTypeId] = React.useState('')
  const [startDate, setStartDate] = React.useState('')
  const [endDate, setEndDate] = React.useState('')
  const [reason, setReason] = React.useState('')
  const [file, setFile] = React.useState<File | null>(null)
  const [fileError, setFileError] = React.useState<string | null>(null)
  const [errors, setErrors] = React.useState<Record<string, string>>({})
  const inputRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    if (open) {
      setEmployeeId(defaultEmployeeId ?? '')
      setLeaveTypeId('')
      setStartDate('')
      setEndDate('')
      setReason('')
      setFile(null)
      setFileError(null)
      setErrors({})
    }
  }, [open, defaultEmployeeId])

  const handleFile = (files: FileList | null) => {
    const picked = files?.[0]
    if (!picked) return
    const error = validateLeaveDocumentFile(picked)
    setFileError(error)
    setFile(error ? null : picked)
  }

  const dayCount = startDate && endDate && startDate <= endDate ? calculateLeaveDays(startDate, endDate) : null

  const onSubmit = () => {
    const nextErrors: Record<string, string> = {}
    if (!employeeId) nextErrors.employeeId = 'Select an employee.'
    if (!leaveTypeId) nextErrors.leaveTypeId = 'Select a leave type.'
    if (!startDate) nextErrors.startDate = 'Start date is required.'
    if (!endDate) nextErrors.endDate = 'End date is required.'
    if (startDate && endDate && startDate > endDate) nextErrors.endDate = 'End date cannot be before start date.'
    if (!reason.trim()) nextErrors.reason = 'Reason is required.'
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }

    createLeaveRequest.mutate(
      {
        employeeId,
        leaveTypeId,
        startDate,
        endDate,
        reason,
        supportingDocument: file ?? undefined,
      },
      { onSuccess: () => onOpenChange(false) }
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Submit Leave Request</DialogTitle>
          <DialogDescription>Leave days and balance checks are calculated automatically.</DialogDescription>
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
              <Label>
                Leave Type <span className="text-destructive">*</span>
              </Label>
              <Select value={leaveTypeId} onValueChange={setLeaveTypeId}>
                <SelectTrigger invalid={!!errors.leaveTypeId}>
                  <SelectValue placeholder="Select leave type" />
                </SelectTrigger>
                <SelectContent>
                  {leaveTypes?.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.leaveTypeId && <p className="text-xs text-destructive">{errors.leaveTypeId}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="start_date">
                Start Date <span className="text-destructive">*</span>
              </Label>
              <Input id="start_date" type="date" min={todayISODate()} invalid={!!errors.startDate} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              {errors.startDate && <p className="text-xs text-destructive">{errors.startDate}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="end_date">
                End Date <span className="text-destructive">*</span>
              </Label>
              <Input id="end_date" type="date" min={startDate || todayISODate()} invalid={!!errors.endDate} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              {errors.endDate && <p className="text-xs text-destructive">{errors.endDate}</p>}
            </div>
          </div>
          {dayCount !== null && <p className="-mt-2 text-xs text-muted-foreground">Total leave days: {dayCount}</p>}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="reason">
              Reason <span className="text-destructive">*</span>
            </Label>
            <Textarea id="reason" invalid={!!errors.reason} value={reason} onChange={(e) => setReason(e.target.value)} rows={3} />
            {errors.reason && <p className="text-xs text-destructive">{errors.reason}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Supporting Document (optional)</Label>
            {file ? (
              <div className="flex items-center justify-between gap-3 rounded-md border border-input bg-card px-3 py-2.5">
                <div className="flex min-w-0 items-center gap-2">
                  <FileText className="h-4 w-4 shrink-0 text-secondary" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{file.name}</p>
                    <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setFile(null)}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label="Remove selected file"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div
                role="button"
                tabIndex={0}
                onClick={() => inputRef.current?.click()}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && inputRef.current?.click()}
                className={cn(
                  'flex cursor-pointer flex-col items-center gap-2 rounded-md border-2 border-dashed px-4 py-6 text-center transition-colors',
                  'border-input hover:border-secondary/50',
                  fileError && 'border-destructive'
                )}
              >
                <Upload className="h-5 w-5 text-muted-foreground" />
                <p className="text-sm text-foreground">
                  <span className="font-medium text-secondary">Click to upload</span> a file
                </p>
                <p className="text-xs text-muted-foreground">PDF, DOC, DOCX, JPG, or PNG — max 10 MB</p>
                <input
                  ref={inputRef}
                  type="file"
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/jpeg,image/png"
                  className="sr-only"
                  onChange={(e) => handleFile(e.target.files)}
                />
              </div>
            )}
            {fileError && <p className="text-xs text-destructive">{fileError}</p>}
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" loading={createLeaveRequest.isPending} onClick={onSubmit}>
            Submit Request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
