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
import { useApproveLeaveRequest, useEmployeeLeaveBalances, type LeaveRequest } from '@/hooks/useLeave'

export function ApproveLeaveDialog({
  open,
  onOpenChange,
  request,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  request: LeaveRequest | null
}) {
  const approveLeave = useApproveLeaveRequest()
  const year = request ? new Date(`${request.start_date}T00:00:00`).getFullYear() : undefined
  const { data: balances } = useEmployeeLeaveBalances(request?.employee_id, year)
  const balance = balances?.find((b) => b.leave_type_id === request?.leave_type_id)

  if (!request) return null

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Approve this leave request?</AlertDialogTitle>
          <AlertDialogDescription>
            {request.employees.first_name} {request.employees.last_name} — {request.leave_types.name}, {Number(request.days_requested)} day
            {Number(request.days_requested) === 1 ? '' : 's'}.
            {balance && (
              <>
                {' '}
                Current balance: {Number(balance.remaining_credits)} remaining of {Number(balance.total_credits)}. After approval:{' '}
                {Math.max(0, Number(balance.remaining_credits) - Number(request.days_requested))} remaining.
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              approveLeave.mutate({ requestId: request.id }, { onSuccess: () => onOpenChange(false) })
            }}
          >
            Approve
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
