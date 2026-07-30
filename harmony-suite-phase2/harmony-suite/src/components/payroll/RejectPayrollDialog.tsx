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
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { useRejectPayrollRecord, type PayrollRecord } from '@/hooks/usePayroll'
import { PAYROLL_REJECTION_REASONS } from '@/lib/payrollLabels'
import { formatMoney, type CurrencyCode } from '@/lib/currency'

const OTHER = 'Other'

/** Sending one employee's payroll back to HR Staff. The reason is the whole
 * point of the action — a record that returns without one just looks like it
 * moved backwards by itself — so it's required here, and again in a database
 * trigger for anything that doesn't come through this dialog. */
export function RejectPayrollDialog({
  record,
  open,
  onOpenChange,
}: {
  record: PayrollRecord | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const rejectRecord = useRejectPayrollRecord()
  const [reason, setReason] = React.useState('')
  const [notes, setNotes] = React.useState('')
  const [error, setError] = React.useState('')

  React.useEffect(() => {
    if (open) {
      setReason('')
      setNotes('')
      setError('')
    }
  }, [open])

  if (!record) return null

  const employee = record.employees
  const needsNotes = reason === OTHER

  const submit = () => {
    if (!reason) {
      setError('Select a reason.')
      return
    }
    if (needsNotes && !notes.trim()) {
      setError('Describe the problem so HR Staff knows what to correct.')
      return
    }
    // Both parts go into one line so the audit log and the badge HR Staff sees
    // read the same, rather than the detail living somewhere they have to dig for.
    const fullReason = notes.trim() ? `${reason} — ${notes.trim()}` : reason

    rejectRecord.mutate(
      { recordId: record.id, periodId: record.payroll_period_id, reason: fullReason },
      { onSuccess: () => onOpenChange(false) }
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Send this payroll back?</DialogTitle>
          <DialogDescription>
            {employee.first_name} {employee.last_name} — net{' '}
            {formatMoney(Number(record.net_salary), record.currency as CurrencyCode)}. Only this employee's record returns to
            HR Staff; everyone else in the period is unaffected.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="reject_reason">
              Reason <span className="text-destructive">*</span>
            </Label>
            <Select
              value={reason}
              onValueChange={(v) => {
                setReason(v)
                setError('')
              }}
            >
              <SelectTrigger id="reject_reason" invalid={!!error && !reason}>
                <SelectValue placeholder="Select a reason" />
              </SelectTrigger>
              <SelectContent>
                {PAYROLL_REJECTION_REASONS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="reject_notes">
              Details {needsNotes && <span className="text-destructive">*</span>}
            </Label>
            <Textarea
              id="reject_notes"
              rows={3}
              value={notes}
              invalid={!!error && needsNotes && !notes.trim()}
              placeholder="What should HR Staff correct?"
              onChange={(e) => {
                setNotes(e.target.value)
                setError('')
              }}
            />
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="outline"
            className="text-destructive hover:text-destructive"
            loading={rejectRecord.isPending}
            onClick={submit}
          >
            Reject Payroll
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
