import { CheckCircle2, Download } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetBody, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { useLeaveRequest, useEmployeeLeaveBalances, useLeaveDocumentSignedUrl } from '@/hooks/useLeave'
import { LEAVE_STATUS_LABEL, LEAVE_STATUS_VARIANT } from '@/lib/leaveLabels'

function formatDate(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })
}

function formatDateTime(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-PH', { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm text-foreground">{value || '—'}</p>
    </div>
  )
}

function TimelineStep({ label, timestamp }: { label: string; timestamp: string | null }) {
  if (!timestamp) return null
  return (
    <li className="flex gap-3">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
        <CheckCircle2 className="h-3.5 w-3.5" />
      </div>
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">{formatDateTime(timestamp)}</p>
      </div>
    </li>
  )
}

export function LeaveDetailsSheet({
  requestId,
  open,
  onOpenChange,
}: {
  requestId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { data: request, isLoading } = useLeaveRequest(requestId ?? undefined)
  const year = request ? new Date(`${request.start_date}T00:00:00`).getFullYear() : undefined
  const { data: balances } = useEmployeeLeaveBalances(request?.employee_id, year)
  const { data: documentUrl } = useLeaveDocumentSignedUrl(request?.supporting_document_url)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        {isLoading || !request ? (
          <SheetBody>
            <Skeleton className="h-8 w-1/2" />
            <Skeleton className="mt-4 h-64 w-full" />
          </SheetBody>
        ) : (
          <>
            <SheetHeader>
              <SheetTitle>
                {request.employees.first_name} {request.employees.last_name}
              </SheetTitle>
              <SheetDescription>
                {request.leave_types.name} — {formatDate(request.start_date)} to {formatDate(request.end_date)}
              </SheetDescription>
            </SheetHeader>
            <SheetBody>
              <div className="flex flex-col gap-6">
                <section className="flex flex-col gap-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Employee Information</h3>
                  <div className="grid grid-cols-2 gap-4 rounded-lg border border-border p-3">
                    <Field label="Employee ID" value={request.employees.employee_number} />
                    <Field label="Employee Name" value={`${request.employees.first_name} ${request.employees.last_name}`} />
                    <Field label="Department" value={request.employees.departments?.name ?? ''} />
                    <Field label="Position" value={request.employees.positions?.title ?? ''} />
                  </div>
                </section>

                <section className="flex flex-col gap-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Leave Information</h3>
                  <div className="rounded-lg border border-border p-3">
                    <div className="mb-3 flex items-center justify-between">
                      <Badge variant={LEAVE_STATUS_VARIANT[request.status]}>{LEAVE_STATUS_LABEL[request.status]}</Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <Field label="Leave Type" value={request.leave_types.name} />
                      <Field label="Total Days" value={String(Number(request.days_requested))} />
                      <Field label="Start Date" value={formatDate(request.start_date)} />
                      <Field label="End Date" value={formatDate(request.end_date)} />
                    </div>
                    {request.reason && (
                      <div className="mt-3 border-t border-border pt-3">
                        <Field label="Reason" value={request.reason} />
                      </div>
                    )}
                    {request.rejection_reason && (
                      <div className="mt-3 border-t border-border pt-3">
                        <Field label="Rejection Reason" value={request.rejection_reason} />
                      </div>
                    )}
                    {request.supporting_document_url && (
                      <div className="mt-3 border-t border-border pt-3">
                        <p className="mb-1 text-xs text-muted-foreground">Supporting Document</p>
                        <Button variant="outline" size="sm" disabled={!documentUrl} onClick={() => documentUrl && window.open(documentUrl, '_blank')}>
                          <Download className="h-3.5 w-3.5" />
                          View Document
                        </Button>
                      </div>
                    )}
                  </div>
                </section>

                <section className="flex flex-col gap-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Leave Balance</h3>
                  <div className="grid grid-cols-1 gap-2 rounded-lg border border-border p-3 sm:grid-cols-2">
                    {balances?.map((b) => (
                      <div key={b.id} className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{b.leave_types.name}</span>
                        <span className="font-medium text-foreground">{Number(b.remaining_credits)} remaining</span>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="flex flex-col gap-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Leave Timeline</h3>
                  <ol className="flex flex-col gap-4">
                    <TimelineStep label="Leave Request Submitted" timestamp={request.created_at} />
                    {request.status !== 'pending' && <TimelineStep label="Leave Reviewed" timestamp={request.reviewed_at} />}
                    {request.status === 'approved' && (
                      <>
                        <TimelineStep label="Leave Approved" timestamp={request.reviewed_at} />
                        <TimelineStep label="Leave Credits Deducted" timestamp={request.reviewed_at} />
                        <TimelineStep label="Leave Balance Updated" timestamp={request.reviewed_at} />
                        <TimelineStep label="Leave Record Saved" timestamp={request.reviewed_at} />
                      </>
                    )}
                    {request.status === 'rejected' && (
                      <>
                        <TimelineStep label="Leave Rejected" timestamp={request.reviewed_at} />
                        <TimelineStep label="Employee Notified" timestamp={request.reviewed_at} />
                      </>
                    )}
                  </ol>
                </section>
              </div>
            </SheetBody>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
