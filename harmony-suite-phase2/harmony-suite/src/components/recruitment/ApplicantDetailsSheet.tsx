import * as React from 'react'
import {
  Mail,
  Phone,
  MapPin,
  Briefcase,
  Building2,
  CalendarDays,
  FileText,
  CheckCircle2,
  XCircle,
  Send,
  Inbox,
  ClipboardCheck,
} from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetBody, SheetFooter, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { ResumeViewer } from '@/components/recruitment/ResumeViewer'
import {
  useApplicationDetail,
  useApplicationHistory,
  useStartReview,
  useMarkQualified,
  useRejectApplicant,
} from '@/hooks/useRecruitment'
import { APPLICATION_STATUS_LABEL, APPLICATION_STATUS_VARIANT } from '@/lib/applicationStatusLabels'

const HISTORY_EVENT_LABEL: Record<string, string> = {
  submitted: 'Application Submitted',
  reviewed: 'Application Reviewed',
  qualified: 'Qualified',
  rejected: 'Rejected',
  rejection_email_queued: 'Rejection Notification Queued',
}

const HISTORY_EVENT_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  submitted: Inbox,
  reviewed: ClipboardCheck,
  qualified: CheckCircle2,
  rejected: XCircle,
  rejection_email_queued: Send,
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

function InfoRow({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm text-foreground">{value}</p>
      </div>
    </div>
  )
}

function RejectDialog({
  open,
  onOpenChange,
  onConfirm,
  isSubmitting,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (reason: string) => void
  isSubmitting: boolean
}) {
  const [reason, setReason] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (open) {
      setReason('')
      setError(null)
    }
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reject applicant</DialogTitle>
          <DialogDescription>This ends recruitment for this applicant. A reason is required for the record.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="rejection_reason">
            Rejection reason <span className="text-destructive">*</span>
          </Label>
          <Textarea
            id="rejection_reason"
            invalid={!!error}
            value={reason}
            onChange={(e) => {
              setReason(e.target.value)
              if (error) setError(null)
            }}
            placeholder="e.g. Does not meet minimum experience requirements"
            rows={3}
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            loading={isSubmitting}
            onClick={() => {
              if (!reason.trim()) {
                setError('A rejection reason is required.')
                return
              }
              onConfirm(reason.trim())
            }}
          >
            Confirm Rejection
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function DetailsSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-5 w-1/3" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  )
}

export function ApplicantDetailsSheet({
  applicationId,
  open,
  onOpenChange,
}: {
  applicationId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { data: application, isLoading } = useApplicationDetail(applicationId ?? undefined)
  const { data: history } = useApplicationHistory(applicationId ?? undefined)
  const startReview = useStartReview()
  const markQualified = useMarkQualified()
  const rejectApplicant = useRejectApplicant()
  const [rejectOpen, setRejectOpen] = React.useState(false)

  if (!application && !isLoading) return null

  const isDecided = application?.status === 'qualified' || application?.status === 'rejected'
  const wasNew = application?.status === 'submitted'
  const applicant = application?.applicants
  const jobPosting = application?.job_postings

  const onStartReview = () => {
    if (!applicationId) return
    startReview.mutate({ applicationId })
  }

  const onMarkQualified = () => {
    if (!applicationId) return
    markQualified.mutate({ applicationId })
  }

  const onReject = (reason: string) => {
    if (!applicationId) return
    rejectApplicant.mutate(
      { applicationId, rejectionReason: reason },
      { onSuccess: () => setRejectOpen(false) }
    )
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent>
          {isLoading || !application ? (
            <SheetBody>
              <DetailsSkeleton />
            </SheetBody>
          ) : (
            <>
              <SheetHeader>
                <div className="flex items-center gap-2">
                  <SheetTitle>
                    {applicant?.first_name} {applicant?.last_name}
                  </SheetTitle>
                  <Badge variant={APPLICATION_STATUS_VARIANT[application.status]}>
                    {APPLICATION_STATUS_LABEL[application.status]}
                  </Badge>
                </div>
                <SheetDescription>Applied for {jobPosting?.positions?.title ?? 'a position'}</SheetDescription>
              </SheetHeader>

              <SheetBody>
                <div className="flex flex-col gap-8">
                  <section className="flex flex-col gap-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Personal Information
                    </h3>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <InfoRow icon={Mail} label="Email" value={applicant?.email ?? '—'} />
                      <InfoRow icon={Phone} label="Phone" value={applicant?.phone ?? '—'} />
                      <InfoRow icon={MapPin} label="Address" value={applicant?.address ?? '—'} />
                    </div>
                  </section>

                  <section className="flex flex-col gap-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Application Information
                    </h3>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <InfoRow icon={Briefcase} label="Position Applied" value={jobPosting?.positions?.title ?? '—'} />
                      <InfoRow icon={Building2} label="Department" value={jobPosting?.departments?.name ?? '—'} />
                      <InfoRow icon={CalendarDays} label="Application Date" value={formatDateTime(application.created_at)} />
                    </div>
                  </section>

                  <section className="flex flex-col gap-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Documents</h3>
                    <div className="flex flex-col gap-1.5">
                      <Label>Resume</Label>
                      <ResumeViewer resumePath={applicant?.resume_url ?? null} />
                    </div>
                    {applicant?.cover_letter && (
                      <div className="flex flex-col gap-1.5">
                        <Label className="flex items-center gap-1.5">
                          <FileText className="h-3.5 w-3.5" />
                          Cover Letter
                        </Label>
                        <p className="whitespace-pre-line rounded-lg border border-border bg-muted/30 p-3 text-sm text-foreground">
                          {applicant.cover_letter}
                        </p>
                      </div>
                    )}
                  </section>

                  <section className="flex flex-col gap-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Review Status
                    </h3>
                    <div className="grid grid-cols-1 gap-4">
                      {application.rejection_reason && (
                        <div className="flex flex-col gap-1.5">
                          <Label>Rejection Reason</Label>
                          <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                            {application.rejection_reason}
                          </p>
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground">
                        <span>Reviewed by: {application.reviewer?.full_name ?? '—'}</span>
                        <span>
                          Review date: {application.reviewed_at ? formatDateTime(application.reviewed_at) : '—'}
                        </span>
                      </div>
                    </div>
                  </section>

                  <section className="flex flex-col gap-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Recruitment History
                    </h3>
                    <ol className="flex flex-col gap-4">
                      {history?.map((entry) => {
                        const Icon = HISTORY_EVENT_ICON[entry.event] ?? Inbox
                        return (
                          <li key={entry.id} className="flex gap-3">
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
                              <Icon className="h-3.5 w-3.5" />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-foreground">
                                {HISTORY_EVENT_LABEL[entry.event] ?? entry.event}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {formatDateTime(entry.created_at)}
                                {entry.actor?.full_name ? ` · ${entry.actor.full_name}` : ''}
                              </p>
                              {entry.notes && <p className="mt-1 text-xs text-muted-foreground">{entry.notes}</p>}
                            </div>
                          </li>
                        )
                      })}
                    </ol>
                  </section>
                </div>
              </SheetBody>

              <SheetFooter>
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Back
                </Button>
                {!isDecided && (
                  <>
                    <Button
                      type="button"
                      variant="destructive"
                      onClick={() => setRejectOpen(true)}
                      disabled={startReview.isPending || markQualified.isPending}
                    >
                      Reject Applicant
                    </Button>
                    <Button type="button" variant="accent" loading={markQualified.isPending} onClick={onMarkQualified}>
                      Mark as Qualified
                    </Button>
                    {wasNew && (
                      <Button type="button" loading={startReview.isPending} onClick={onStartReview}>
                        Start Review
                      </Button>
                    )}
                  </>
                )}
              </SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>

      <RejectDialog
        open={rejectOpen}
        onOpenChange={setRejectOpen}
        onConfirm={onReject}
        isSubmitting={rejectApplicant.isPending}
      />
    </>
  )
}
