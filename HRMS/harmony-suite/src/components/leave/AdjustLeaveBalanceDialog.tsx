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
import { useAdjustLeaveBalance, type LeaveType } from '@/hooks/useLeave'
import type { Tables } from '@/lib/database.types'
import { LEAVE_BALANCE_ADJUSTMENT_REASON_PRESETS } from '@/lib/leaveLabels'

type LeaveBalance = Tables<'leave_balances'> & { leave_types: LeaveType }

export function AdjustLeaveBalanceDialog({
  open,
  onOpenChange,
  balance,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  balance: LeaveBalance | null
}) {
  const adjustBalance = useAdjustLeaveBalance()

  const [newTotal, setNewTotal] = React.useState('')
  const [reasonPreset, setReasonPreset] = React.useState<string>(LEAVE_BALANCE_ADJUSTMENT_REASON_PRESETS[0])
  const [customReason, setCustomReason] = React.useState('')
  const [errors, setErrors] = React.useState<Record<string, string>>({})

  React.useEffect(() => {
    if (open && balance) {
      setNewTotal(String(balance.total_credits))
      setReasonPreset(LEAVE_BALANCE_ADJUSTMENT_REASON_PRESETS[0])
      setCustomReason('')
      setErrors({})
    }
  }, [open, balance])

  if (!balance) return null

  const onSubmit = () => {
    const nextErrors: Record<string, string> = {}
    const reason = reasonPreset === 'Other' ? customReason.trim() : reasonPreset
    if (!newTotal || Number(newTotal) < 0) nextErrors.newTotal = 'Enter a valid credit total.'
    if (Number(newTotal) < Number(balance.used_credits)) nextErrors.newTotal = `Cannot be less than ${Number(balance.used_credits)} already used.`
    if (!reason) nextErrors.reason = 'A reason is required.'
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }

    adjustBalance.mutate(
      { balanceId: balance.id, employeeId: balance.employee_id, newTotalCredits: Number(newTotal), reason },
      { onSuccess: () => onOpenChange(false) }
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adjust {balance.leave_types.name} Balance</DialogTitle>
          <DialogDescription>
            Currently {Number(balance.total_credits)} total, {Number(balance.used_credits)} used, {Number(balance.remaining_credits)} remaining.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new_total">
              New Total Credits <span className="text-destructive">*</span>
            </Label>
            <Input id="new_total" type="number" min="0" step="0.5" invalid={!!errors.newTotal} value={newTotal} onChange={(e) => setNewTotal(e.target.value)} />
            {errors.newTotal && <p className="text-xs text-destructive">{errors.newTotal}</p>}
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
                {LEAVE_BALANCE_ADJUSTMENT_REASON_PRESETS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {reasonPreset === 'Other' && (
              <Textarea invalid={!!errors.reason} value={customReason} onChange={(e) => setCustomReason(e.target.value)} placeholder="Describe the adjustment reason" rows={2} />
            )}
            {errors.reason && <p className="text-xs text-destructive">{errors.reason}</p>}
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" loading={adjustBalance.isPending} onClick={onSubmit}>
            Save Adjustment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
