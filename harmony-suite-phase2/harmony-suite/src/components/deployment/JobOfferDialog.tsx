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
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { MoneyInput } from '@/components/MoneyInput'
import { useSalaryGrades } from '@/hooks/useSalaryGrades'
import { useWorkSchedules } from '@/hooks/useWorkSchedules'
import { usePrepareJobOffer } from '@/hooks/useDeployment'
import { formatScheduleTime, formatWorkingDays } from '@/lib/attendanceCalculations'
import { EMPLOYMENT_TYPE_LABEL, EMPLOYMENT_TYPE_SHORT_LABEL, type EmploymentType } from '@/lib/jobPostingLabels'
import { formatMoney, DEFAULT_CURRENCY } from '@/lib/currency'

/** Local calendar date (not UTC) in YYYY-MM-DD form, matching what a date input's own picker considers "today". */
function todayISODate(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** The earliest start date an offer may promise. An applicant still has to
 * receive the offer, accept it, and sign a contract, so a start date of today
 * is never actually achievable — the soonest real option is tomorrow. */
function earliestStartDate(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function JobOfferDialog({
  open,
  onOpenChange,
  applicationId,
  positionTitle,
  departmentName,
  employmentType,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  applicationId: string
  /** Inherited from the job posting the applicant applied to. HR does not get
   * to change it here — the applicant answered an advert for one kind of job,
   * and the salary grades and work schedules on offer follow from it. */
  employmentType: EmploymentType
  positionTitle: string
  departmentName: string
}) {
  const { data: salaryGrades } = useSalaryGrades()
  const { data: workSchedules } = useWorkSchedules()
  const prepareOffer = usePrepareJobOffer()

  const [salaryGradeId, setSalaryGradeId] = React.useState('')
  const [salary, setSalary] = React.useState('')
  const [workScheduleId, setWorkScheduleId] = React.useState('')
  const [startDate, setStartDate] = React.useState('')
  const [additionalCompensation, setAdditionalCompensation] = React.useState('')
  const [notes, setNotes] = React.useState('')
  const [errors, setErrors] = React.useState<Record<string, string>>({})

  React.useEffect(() => {
    if (open) {
      setSalaryGradeId('')
      setSalary('')
      // The default schedule is only a sensible starting point when it's of
      // the right type; otherwise start empty and make HR choose.
      const compatible = (workSchedules ?? []).filter((s) => s.employment_type === employmentType)
      setWorkScheduleId(compatible.find((s) => s.is_default)?.id ?? (compatible.length === 1 ? compatible[0].id : ''))
      setStartDate('')
      setAdditionalCompensation('')
      setNotes('')
      setErrors({})
    }
  }, [open, workSchedules, employmentType])

  // Only resources of the matching type are offerable. The database refuses
  // the pairing outright; filtering here means HR never sees the option.
  const offerableGrades = React.useMemo(
    () => (salaryGrades ?? []).filter((g) => g.employment_type === employmentType),
    [salaryGrades, employmentType]
  )
  const offerableSchedules = React.useMemo(
    () => (workSchedules ?? []).filter((s) => s.employment_type === employmentType),
    [workSchedules, employmentType]
  )

  const selectedGrade = offerableGrades.find((g) => g.id === salaryGradeId) ?? null
  const selectedSchedule = offerableSchedules.find((s) => s.id === workScheduleId) ?? null

  // Captured as text on the offer so the contract preserves the terms as
  // offered, even if Admin later edits the schedule itself.
  const scheduleHoursText = selectedSchedule
    ? `${formatScheduleTime(selectedSchedule.start_time)} - ${formatScheduleTime(selectedSchedule.end_time)}`
    : null
  const scheduleDaysText = selectedSchedule ? formatWorkingDays(selectedSchedule.working_days) : null

  const onSubmit = () => {
    const nextErrors: Record<string, string> = {}
    if (!salary || Number(salary) <= 0) {
      nextErrors.salary = 'Salary is required.'
    } else if (selectedGrade && (Number(salary) < selectedGrade.min_salary || Number(salary) > selectedGrade.max_salary)) {
      nextErrors.salary = `Salary must be between ${formatMoney(selectedGrade.min_salary)} and ${formatMoney(selectedGrade.max_salary)} for ${selectedGrade.grade_name}.`
    }
    if (!workScheduleId) nextErrors.workScheduleId = 'Work schedule is required.'
    if (!startDate) {
      nextErrors.startDate = 'Start date is required.'
    } else if (startDate <= todayISODate()) {
      // `min` on the input only guards the picker; a typed date still lands here.
      nextErrors.startDate = 'Start date must be tomorrow or later.'
    }
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }

    prepareOffer.mutate(
      {
        applicationId,
        employmentType,
        salaryGradeId: salaryGradeId || undefined,
        proposedSalary: Number(salary),
        currency: DEFAULT_CURRENCY,
        workScheduleId,
        workingHours: scheduleHoursText ?? undefined,
        workingDays: scheduleDaysText ?? undefined,
        startDate,
        additionalCompensation: additionalCompensation.trim() || undefined,
        notes: notes.trim() || undefined,
      },
      { onSuccess: () => onOpenChange(false) }
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-lg flex-col gap-0 p-0">
        <DialogHeader className="p-6 pb-4">
          <DialogTitle>Prepare Job Offer</DialogTitle>
          <DialogDescription>For {positionTitle} — {departmentName}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 overflow-y-auto px-6 py-1">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>Employment Type</Label>
              {/* Set by the job posting, shown for confirmation. Changing it
                * would mean offering a different job than the one applied for. */}
              <Input value={EMPLOYMENT_TYPE_LABEL[employmentType]} disabled />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Salary Grade (optional)</Label>
              <Select
                value={salaryGradeId}
                onValueChange={(v) => {
                  setSalaryGradeId(v)
                  if (errors.salary) setErrors((prev) => ({ ...prev, salary: '' }))
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  {offerableGrades.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.grade_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedGrade && (
                <p className="text-xs text-muted-foreground">
                  Range: {formatMoney(selectedGrade.min_salary)} – {formatMoney(selectedGrade.max_salary)}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="salary">
                Salary <span className="text-destructive">*</span>
              </Label>
              <MoneyInput
                id="salary"
                invalid={!!errors.salary}
                value={salary}
                onValueChange={(v) => {
                  setSalary(v)
                  if (errors.salary) setErrors((prev) => ({ ...prev, salary: '' }))
                }}
              />
              {errors.salary && <p className="text-xs text-destructive">{errors.salary}</p>}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="work_schedule">
              Work Schedule <span className="text-destructive">*</span>
            </Label>
            <Select
              value={workScheduleId}
              onValueChange={(v) => {
                setWorkScheduleId(v)
                if (errors.workScheduleId) setErrors((prev) => ({ ...prev, workScheduleId: '' }))
              }}
            >
              <SelectTrigger id="work_schedule" invalid={!!errors.workScheduleId}>
                <SelectValue
                  placeholder={
                    offerableSchedules.length
                      ? 'Select a work schedule'
                      : `No ${EMPLOYMENT_TYPE_SHORT_LABEL[employmentType]} work schedules configured`
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {offerableSchedules.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                    {s.is_default ? ' (default)' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.workScheduleId ? (
              <p className="text-xs text-destructive">{errors.workScheduleId}</p>
            ) : selectedSchedule ? (
              <p className="text-xs text-muted-foreground">
                {scheduleDaysText} · {scheduleHoursText}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">Working hours and days come from the schedules Admin configures.</p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="start_date">
              Start Date <span className="text-destructive">*</span>
            </Label>
            <Input
              id="start_date"
              type="date"
              min={earliestStartDate()}
              invalid={!!errors.startDate}
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value)
                if (errors.startDate) setErrors((prev) => ({ ...prev, startDate: '' }))
              }}
            />
            {errors.startDate && <p className="text-xs text-destructive">{errors.startDate}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="additional_compensation">Additional Compensation</Label>
            <Textarea id="additional_compensation" value={additionalCompensation} onChange={(e) => setAdditionalCompensation(e.target.value)} rows={2} placeholder="Optional" />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="offer_notes">Notes</Label>
            <Textarea id="offer_notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Optional" />
          </div>
        </div>

        <DialogFooter className="p-6 pt-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" loading={prepareOffer.isPending} onClick={onSubmit}>
            Prepare Job Offer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
