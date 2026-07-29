import * as React from 'react'
import { CheckCircle2, XCircle, Inbox, Clock, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { useAuth } from '@/contexts/AuthContext'
import { canApproveWork } from '@/lib/roles'
import {
  useChangeRequests,
  useApproveChangeRequest,
  useRejectChangeRequest,
  CHANGE_TARGET_LABEL,
  CHANGE_OPERATION_LABEL,
  type ChangeRequest,
  type ChangeRequestStatus,
} from '@/hooks/useChangeRequests'

const STATUS_VARIANT: Record<ChangeRequestStatus, 'warning' | 'success' | 'destructive'> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'destructive',
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function PayloadPreview({ payload }: { payload: Record<string, unknown> }) {
  const entries = Object.entries(payload ?? {})
  if (!entries.length) return null
  return (
    <div className="mt-3 grid grid-cols-1 gap-2 rounded-md bg-muted/40 p-3 sm:grid-cols-2">
      {entries.map(([key, value]) => (
        <div key={key}>
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{key.replace(/_/g, ' ')}</p>
          <p className="text-sm text-foreground">{Array.isArray(value) ? value.join(', ') : String(value ?? '—')}</p>
        </div>
      ))}
    </div>
  )
}

function RejectDialog({
  request,
  onOpenChange,
}: {
  request: ChangeRequest | null
  onOpenChange: (o: boolean) => void
}) {
  const reject = useRejectChangeRequest()
  const [reason, setReason] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (request) {
      setReason('')
      setError(null)
    }
  }, [request])

  return (
    <Dialog open={!!request} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reject this change?</DialogTitle>
          <DialogDescription>
            The author sees your reason so they can correct it and resubmit. Nothing is written to the record.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="reject_reason">
            Reason <span className="text-destructive">*</span>
          </Label>
          <Textarea
            id="reject_reason"
            invalid={!!error}
            value={reason}
            onChange={(e) => {
              setReason(e.target.value)
              if (error) setError(null)
            }}
            rows={3}
            placeholder="e.g. Department name duplicates an existing record"
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            loading={reject.isPending}
            onClick={() => {
              if (!reason.trim()) {
                setError('A reason is required.')
                return
              }
              if (request) {
                reject.mutate({ requestId: request.id, reason: reason.trim() }, { onSuccess: () => onOpenChange(false) })
              }
            }}
          >
            Confirm Rejection
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function ApprovalsPage() {
  const { profile } = useAuth()
  const canReview = canApproveWork(profile?.role)
  const [statusFilter, setStatusFilter] = React.useState<ChangeRequestStatus>('pending')
  const { data: requests, isLoading } = useChangeRequests(statusFilter)
  const approve = useApproveChangeRequest()
  const [rejecting, setRejecting] = React.useState<ChangeRequest | null>(null)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold text-foreground">Change Approvals</h2>
          <p className="text-sm text-muted-foreground">
            {canReview
              ? 'Reference-data changes submitted by HR Staff. Approved changes are written to the record; rejected ones go back for correction.'
              : 'Changes you submitted for HR Manager review.'}
          </p>
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as ChangeRequestStatus)}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : !requests?.length ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border py-16 text-center">
          <Inbox className="h-6 w-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            {statusFilter === 'pending' ? 'Nothing waiting for review.' : `No ${statusFilter} changes.`}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {requests.map((r) => {
            const isOwnRequest = r.requested_by === profile?.id
            return (
              <Card key={r.id}>
                <CardContent className="flex flex-col gap-3 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
                        <ShieldCheck className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium text-foreground">{r.summary}</p>
                          <Badge variant={STATUS_VARIANT[r.status]}>
                            {r.status.charAt(0).toUpperCase() + r.status.slice(1)}
                          </Badge>
                        </div>
                        <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {CHANGE_OPERATION_LABEL[r.operation]} · {CHANGE_TARGET_LABEL[r.target_table]} · requested by{' '}
                          {r.requester?.full_name ?? 'Unknown'} on {formatDateTime(r.requested_at)}
                        </p>
                      </div>
                    </div>

                    {r.status === 'pending' && canReview && (
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setRejecting(r)}
                        >
                          <XCircle className="h-4 w-4" />
                          Reject
                        </Button>
                        <Button
                          variant="accent"
                          size="sm"
                          // A manager can't rubber-stamp their own submission —
                          // the database rejects it too.
                          disabled={isOwnRequest}
                          loading={approve.isPending}
                          onClick={() => approve.mutate(r.id)}
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          Approve
                        </Button>
                      </div>
                    )}
                    {r.status === 'pending' && !canReview && (
                      <Badge variant="muted">Waiting for HR Manager</Badge>
                    )}
                  </div>

                  {r.operation !== 'delete' && <PayloadPreview payload={r.payload} />}

                  {r.status === 'pending' && canReview && isOwnRequest && (
                    <p className="text-xs text-muted-foreground">
                      You submitted this change — another HR Manager or an Administrator has to review it.
                    </p>
                  )}

                  {r.status === 'rejected' && r.rejection_reason && (
                    <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3">
                      <p className="text-xs font-medium text-destructive">Rejected</p>
                      <p className="mt-0.5 text-sm text-foreground">{r.rejection_reason}</p>
                    </div>
                  )}

                  {r.status !== 'pending' && r.reviewed_at && (
                    <p className="text-xs text-muted-foreground">
                      Reviewed by {r.reviewer?.full_name ?? 'Unknown'} on {formatDateTime(r.reviewed_at)}
                    </p>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <RejectDialog request={rejecting} onOpenChange={(o) => !o && setRejecting(null)} />
    </div>
  )
}
