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
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { MoneyInput } from '@/components/MoneyInput'
import { useAddPayrollLineItem, type PayrollRecord } from '@/hooks/usePayroll'
import { ALLOWANCE_LABEL_PRESETS, DEDUCTION_LABEL_PRESETS } from '@/lib/payrollLabels'
import type { CurrencyCode } from '@/lib/currency'

export function AdjustPayrollRecordDialog({
  open,
  onOpenChange,
  record,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  record: PayrollRecord | null
}) {
  const addLineItem = useAddPayrollLineItem()

  const [itemType, setItemType] = React.useState<'allowance' | 'deduction'>('allowance')
  const [label, setLabel] = React.useState<string>(ALLOWANCE_LABEL_PRESETS[0])
  const [amount, setAmount] = React.useState('')
  const [reason, setReason] = React.useState('')
  const [notes, setNotes] = React.useState('')
  const [errors, setErrors] = React.useState<Record<string, string>>({})
  const [confirmOpen, setConfirmOpen] = React.useState(false)

  React.useEffect(() => {
    if (open && record) {
      setItemType('allowance')
      setLabel(ALLOWANCE_LABEL_PRESETS[0])
      setAmount('')
      setReason('')
      setNotes(record.notes ?? '')
      setErrors({})
    }
  }, [open, record])

  if (!record) return null

  const presets = itemType === 'allowance' ? ALLOWANCE_LABEL_PRESETS : DEDUCTION_LABEL_PRESETS

  const onSubmit = () => {
    const nextErrors: Record<string, string> = {}
    if (!amount || Number(amount) <= 0) nextErrors.amount = 'Enter an amount greater than zero.'
    if (!reason.trim()) nextErrors.reason = 'An adjustment reason is required.'
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }
    setConfirmOpen(true)
  }

  const onConfirm = () => {
    setConfirmOpen(false)
    addLineItem.mutate(
      {
        recordId: record.id,
        periodId: record.payroll_period_id,
        itemType,
        label,
        amount: Number(amount),
        reason: reason.trim(),
        notes: notes.trim() || undefined,
      },
      { onSuccess: () => onOpenChange(false) }
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adjust Payroll</DialogTitle>
          <DialogDescription>
            {record.employees.first_name} {record.employees.last_name} — add an allowance or deduction. A reason is required and this is logged to the audit trail.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>Type</Label>
              <Select
                value={itemType}
                onValueChange={(v) => {
                  setItemType(v as 'allowance' | 'deduction')
                  setLabel(v === 'allowance' ? ALLOWANCE_LABEL_PRESETS[0] : DEDUCTION_LABEL_PRESETS[0])
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="allowance">Allowance</SelectItem>
                  <SelectItem value="deduction">Deduction</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Description</Label>
              <Select value={label} onValueChange={setLabel}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {presets.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="amount">
              Amount <span className="text-destructive">*</span>
            </Label>
            <MoneyInput id="amount" currency={record.currency as CurrencyCode} invalid={!!errors.amount} value={amount} onValueChange={setAmount} />
            {errors.amount && <p className="text-xs text-destructive">{errors.amount}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="reason">
              Adjustment Reason <span className="text-destructive">*</span>
            </Label>
            <Textarea id="reason" invalid={!!errors.reason} value={reason} onChange={(e) => setReason(e.target.value)} rows={2} />
            {errors.reason && <p className="text-xs text-destructive">{errors.reason}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" loading={addLineItem.isPending} onClick={onSubmit}>
            Save Adjustment
          </Button>
        </DialogFooter>
      </DialogContent>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apply this adjustment?</AlertDialogTitle>
            <AlertDialogDescription>
              {itemType === 'allowance' ? 'Adding' : 'Deducting'} {label} for {record.employees.first_name} {record.employees.last_name}. If this payroll
              was already reviewed, it will return to draft for re-approval.
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
