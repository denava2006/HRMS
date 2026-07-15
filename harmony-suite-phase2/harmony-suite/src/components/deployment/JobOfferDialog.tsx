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
import { usePrepareJobOffer } from '@/hooks/useDeployment'
import { useCurrency } from '@/hooks/useSystemSettings'
import { EMPLOYMENT_TYPE_LABEL, type EmploymentType } from '@/lib/jobPostingLabels'
import { CURRENCY_LABEL, formatMoney, type CurrencyCode } from '@/lib/currency'

/** Local calendar date (not UTC) in YYYY-MM-DD form, matching what a date input's own picker considers "today". */
function todayISODate(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function JobOfferDialog({
  open,
  onOpenChange,
  applicationId,
  positionTitle,
  departmentName,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  applicationId: string
  positionTitle: string
  departmentName: string
}) {
  const defaultCurrency = useCurrency()
  const { data: salaryGrades } = useSalaryGrades()
  const prepareOffer = usePrepareJobOffer()

  const [employmentType, setEmploymentType] = React.useState<EmploymentType>('full_time')
  const [salaryGradeId, setSalaryGradeId] = React.useState('')
  const [salary, setSalary] = React.useState('')
  const [currency, setCurrency] = React.useState<CurrencyCode>('PHP')
  const [workingHours, setWorkingHours] = React.useState('')
  const [workingDays, setWorkingDays] = React.useState('')
  const [startDate, setStartDate] = React.useState('')
  const [probationPeriod, setProbationPeriod] = React.useState('')
  const [benefits, setBenefits] = React.useState('')
  const [additionalCompensation, setAdditionalCompensation] = React.useState('')
  const [notes, setNotes] = React.useState('')
  const [errors, setErrors] = React.useState<Record<string, string>>({})

  React.useEffect(() => {
    if (open) {
      setEmploymentType('full_time')
      setSalaryGradeId('')
      setSalary('')
      setCurrency(defaultCurrency)
      setWorkingHours('')
      setWorkingDays('')
      setStartDate('')
      setProbationPeriod('')
      setBenefits('')
      setAdditionalCompensation('')
      setNotes('')
      setErrors({})
    }
  }, [open, defaultCurrency])

  const selectedGrade = salaryGrades?.find((g) => g.id === salaryGradeId) ?? null

  const onSubmit = () => {
    const nextErrors: Record<string, string> = {}
    if (!salary || Number(salary) <= 0) {
      nextErrors.salary = 'Salary is required.'
    } else if (selectedGrade && (Number(salary) < selectedGrade.min_salary || Number(salary) > selectedGrade.max_salary)) {
      nextErrors.salary = `Salary must be between ${formatMoney(selectedGrade.min_salary, currency)} and ${formatMoney(selectedGrade.max_salary, currency)} for ${selectedGrade.grade_name}.`
    }
    if (!benefits.trim()) nextErrors.benefits = 'Benefits is required.'
    if (!startDate) nextErrors.startDate = 'Start date is required.'
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
        currency,
        workingHours: workingHours.trim() || undefined,
        workingDays: workingDays.trim() || undefined,
        startDate,
        probationPeriod: probationPeriod.trim() || undefined,
        benefits: benefits.trim(),
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
              <Select value={employmentType} onValueChange={(v) => setEmploymentType(v as EmploymentType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(EMPLOYMENT_TYPE_LABEL).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                  {salaryGrades?.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.grade_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedGrade && (
                <p className="text-xs text-muted-foreground">
                  Range: {formatMoney(selectedGrade.min_salary, currency)} – {formatMoney(selectedGrade.max_salary, currency)}
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
                currency={currency}
                invalid={!!errors.salary}
                value={salary}
                onValueChange={(v) => {
                  setSalary(v)
                  if (errors.salary) setErrors((prev) => ({ ...prev, salary: '' }))
                }}
              />
              {errors.salary && <p className="text-xs text-destructive">{errors.salary}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Currency</Label>
              <Select value={currency} onValueChange={(v) => setCurrency(v as CurrencyCode)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.entries(CURRENCY_LABEL) as [CurrencyCode, string][]).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="working_hours">Working Hours</Label>
              <Input
                id="working_hours"
                autoComplete="off"
                value={workingHours}
                onChange={(e) => setWorkingHours(e.target.value)}
                placeholder="e.g. 8:00 AM - 5:00 PM"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="working_days">Working Days</Label>
              <Input
                id="working_days"
                autoComplete="off"
                value={workingDays}
                onChange={(e) => setWorkingDays(e.target.value)}
                placeholder="e.g. Monday to Friday"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="start_date">
                Start Date <span className="text-destructive">*</span>
              </Label>
              <Input
                id="start_date"
                type="date"
                min={todayISODate()}
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
              <Label htmlFor="probation_period">Probation Period</Label>
              <Input
                id="probation_period"
                autoComplete="off"
                value={probationPeriod}
                onChange={(e) => setProbationPeriod(e.target.value)}
                placeholder="e.g. 6 months"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="benefits">
              Benefits <span className="text-destructive">*</span>
            </Label>
            <Textarea id="benefits" invalid={!!errors.benefits} value={benefits} onChange={(e) => {
              setBenefits(e.target.value)
              if (errors.benefits) setErrors((prev) => ({ ...prev, benefits: '' }))
            }} rows={2} />
            {errors.benefits && <p className="text-xs text-destructive">{errors.benefits}</p>}
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
