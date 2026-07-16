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
import { useRejectLeaveRequest, type LeaveRequest } from '@/hooks/useLeave'
import { LEAVE_REJECTION_REASON_PRESETS } from '@/lib/leaveLabels'

export function RejectLeaveDialog({
  open,
  onOpenChange,
  request,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  request: LeaveRequest | null
}) {
  const rejectLeave = useRejectLeaveRequest()

  const [reasonPreset, setReasonPreset] = React.useState<string>(LEAVE_REJECTION_REASON_PRESETS[0])
  const [customReason, setCustomReason] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)
  const [confirmOpen, setConfirmOpen] = React.useState(false)

  React.useEffect(() => {
    if (open) {
      setReasonPreset(LEAVE_REJECTION_REASON_PRESETS[0])
      setCustomReason('')
      setError(null)
    }
  }, [open])

  if (!request) return null

  const reason = reasonPreset === 'Other' ? customReason.trim() : reasonPreset

  const onSubmit = () => {
    if (!reason) {
      setError('A rejection reason is required.')
      return
    }
    setConfirmOpen(true)
  }

  const onConfirm = () => {
    setConfirmOpen(false)
    rejectLeave.mutate({ requestId: request.id, reason }, { onSuccess: () => onOpenChange(false) })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reject Leave Request</DialogTitle>
          <DialogDescription>
            {request.employees.first_name} {request.employees.last_name} — {request.leave_types.name}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>
              Rejection Reason <span className="text-destructive">*</span>
            </Label>
            <Select value={reasonPreset} onValueChange={setReasonPreset}>
              <SelectTrigger invalid={!!error}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LEAVE_REJECTION_REASON_PRESETS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {reasonPreset === 'Other' && (
              <Textarea invalid={!!error} value={customReason} onChange={(e) => setCustomReason(e.target.value)} placeholder="Describe the rejection reason" rows={2} />
            )}
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" variant="destructive" loading={rejectLeave.isPending} onClick={onSubmit}>
            Reject Request
          </Button>
        </DialogFooter>
      </DialogContent>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject this leave request?</AlertDialogTitle>
            <AlertDialogDescription>
              {request.employees.first_name} {request.employees.last_name} will be marked as rejected with reason "{reason}". This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onConfirm}>Confirm Rejection</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  )
}
