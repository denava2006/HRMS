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
import { useCreatePayrollPeriod } from '@/hooks/usePayroll'
import { PAYROLL_FREQUENCY_LABEL } from '@/lib/payrollLabels'

export function CreatePayrollPeriodDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated?: (periodId: string) => void
}) {
  const createPeriod = useCreatePayrollPeriod()

  const [periodStart, setPeriodStart] = React.useState('')
  const [periodEnd, setPeriodEnd] = React.useState('')
  const [payDate, setPayDate] = React.useState('')
  const [frequency, setFrequency] = React.useState<'weekly' | 'biweekly' | 'semi_monthly' | 'monthly'>('monthly')
  const [errors, setErrors] = React.useState<Record<string, string>>({})

  React.useEffect(() => {
    if (open) {
      setPeriodStart('')
      setPeriodEnd('')
      setPayDate('')
      setFrequency('monthly')
      setErrors({})
    }
  }, [open])

  const onSubmit = () => {
    const nextErrors: Record<string, string> = {}
    if (!periodStart) nextErrors.periodStart = 'Start date is required.'
    if (!periodEnd) nextErrors.periodEnd = 'End date is required.'
    if (periodStart && periodEnd && periodStart > periodEnd) nextErrors.periodEnd = 'End date cannot be before start date.'
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }

    createPeriod.mutate(
      { periodStart, periodEnd, payDate: payDate || undefined, frequency },
      { onSuccess: (data) => { onOpenChange(false); onCreated?.(data.id) } }
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Payroll Period</DialogTitle>
          <DialogDescription>Employee records, attendance, and leave are retrieved automatically once payroll is generated.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>Payroll Frequency</Label>
            <Select value={frequency} onValueChange={(v) => setFrequency(v as typeof frequency)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(PAYROLL_FREQUENCY_LABEL).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="period_start">
                Payroll Start Date <span className="text-destructive">*</span>
              </Label>
              <Input id="period_start" type="date" invalid={!!errors.periodStart} value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
              {errors.periodStart && <p className="text-xs text-destructive">{errors.periodStart}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="period_end">
                Payroll End Date <span className="text-destructive">*</span>
              </Label>
              <Input id="period_end" type="date" min={periodStart || undefined} invalid={!!errors.periodEnd} value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
              {errors.periodEnd && <p className="text-xs text-destructive">{errors.periodEnd}</p>}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pay_date">Pay Date (optional)</Label>
            <Input id="pay_date" type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" loading={createPeriod.isPending} onClick={onSubmit}>
            Create Period
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
