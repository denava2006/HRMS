import * as React from 'react'
import { useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  AlertCircle,
  Briefcase,
  Building2,
  CalendarClock,
  CheckCircle2,
  ExternalLink,
  LogOut,
  MapPin,
  Search,
  Video,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
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
import { toast } from '@/components/ui/sonner'
import {
  useApplicationTracking,
  useRespondToOfferAsApplicant,
  APPLICANT_STATUS_COPY,
  type ApplicantCredentials,
  type ApplicationTrackingRecord,
} from '@/hooks/useApplicantPortal'
import { formatMoney, type CurrencyCode } from '@/lib/currency'
import { EMPLOYMENT_TYPE_LABEL } from '@/lib/jobPostingLabels'

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('en-PH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function formatDate(value: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm text-foreground">{value}</p>
    </div>
  )
}

function LookupForm({ onSubmit, isLoading }: { onSubmit: (c: ApplicantCredentials) => void; isLoading: boolean }) {
  const [searchParams] = useSearchParams()
  const [referenceCode, setReferenceCode] = React.useState(searchParams.get('ref') ?? '')
  const [email, setEmail] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!referenceCode.trim() || !email.trim()) {
      setError('Enter both your reference number and the email you applied with.')
      return
    }
    setError(null)
    onSubmit({ referenceCode: referenceCode.trim().toUpperCase(), email: email.trim() })
  }

  return (
    <Card>
      <CardContent className="p-6">
        <form className="flex flex-col gap-4" onSubmit={submit} noValidate>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="reference_code">
              Reference Number <span className="text-destructive">*</span>
            </Label>
            <Input
              id="reference_code"
              autoComplete="off"
              placeholder="APP-2026-0001"
              className="font-mono"
              value={referenceCode}
              onChange={(e) => setReferenceCode(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="applicant_email">
              Email Address <span className="text-destructive">*</span>
            </Label>
            <Input
              id="applicant_email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">Use the same email you applied with.</p>
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <Button type="submit" loading={isLoading} className="mt-1">
            <Search className="h-4 w-4" />
            Track Application
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

function InterviewCard({ record }: { record: ApplicationTrackingRecord }) {
  if (!record.interview_scheduled_at) return null
  const isOnline = record.interview_mode === 'online'
  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-6">
        <div className="flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-secondary" />
          <h2 className="font-display text-base font-semibold text-foreground">
            {record.interview_type === 'final' ? 'Final Interview' : 'Initial Interview'}
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Date & Time" value={formatDateTime(record.interview_scheduled_at)} />
          <Field label="Format" value={isOnline ? 'Online' : 'Face-to-face'} />
        </div>
        {isOnline && record.interview_meeting_link && (
          <div className="flex flex-col gap-1.5">
            <p className="text-xs text-muted-foreground">Meeting Link</p>
            <Button asChild variant="outline" size="sm" className="self-start">
              <a href={record.interview_meeting_link} target="_blank" rel="noreferrer noopener">
                <Video className="h-4 w-4" />
                Join Meeting
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </Button>
          </div>
        )}
        {!isOnline && record.interview_location && (
          <div className="flex items-start gap-2">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Location</p>
              <p className="text-sm text-foreground">{record.interview_location}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function OfferCard({
  record,
  credentials,
}: {
  record: ApplicationTrackingRecord
  credentials: ApplicantCredentials
}) {
  const respond = useRespondToOfferAsApplicant()
  const [confirmDecline, setConfirmDecline] = React.useState(false)
  if (!record.offer_id) return null

  const currency: CurrencyCode = record.offer_currency === 'USD' ? 'USD' : 'PHP'
  const isPending = record.offer_status === 'pending'

  const submit = (decision: 'accepted' | 'declined') => {
    respond.mutate(
      { credentials, decision },
      {
        onSuccess: () =>
          toast.success(decision === 'accepted' ? 'Offer accepted — welcome aboard!' : 'Offer declined.'),
        onError: (e) => toast.error(e.message),
      }
    )
  }

  return (
    <>
      <Card>
        <CardContent className="flex flex-col gap-4 p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-secondary" />
              <h2 className="font-display text-base font-semibold text-foreground">Your Job Offer</h2>
            </div>
            {record.offer_status === 'accepted' && <Badge variant="success">Accepted</Badge>}
            {record.offer_status === 'declined' && <Badge variant="muted">Declined</Badge>}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Position" value={record.position_title ?? '—'} />
            <Field label="Department" value={record.department_name ?? '—'} />
            <Field
              label="Employment Type"
              value={record.offer_employment_type ? EMPLOYMENT_TYPE_LABEL[record.offer_employment_type] : '—'}
            />
            <Field label="Salary" value={record.offer_salary != null ? formatMoney(record.offer_salary, currency) : '—'} />
            <Field label="Start Date" value={formatDate(record.offer_start_date)} />
            <Field label="Working Days" value={record.offer_working_days ?? '—'} />
            <Field label="Working Hours" value={record.offer_working_hours ?? '—'} />
          </div>

          {record.offer_benefits && (
            <div className="border-t border-border pt-3">
              <p className="text-xs text-muted-foreground">Benefits</p>
              <p className="whitespace-pre-line text-sm text-foreground">{record.offer_benefits}</p>
            </div>
          )}
          {record.offer_additional_compensation && (
            <div>
              <p className="text-xs text-muted-foreground">Additional Compensation</p>
              <p className="whitespace-pre-line text-sm text-foreground">{record.offer_additional_compensation}</p>
            </div>
          )}

          {isPending ? (
            <div className="flex flex-col gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                className="text-destructive hover:text-destructive"
                disabled={respond.isPending}
                onClick={() => setConfirmDecline(true)}
              >
                Decline Offer
              </Button>
              <Button type="button" variant="accent" loading={respond.isPending} onClick={() => submit('accepted')}>
                <CheckCircle2 className="h-4 w-4" />
                Accept Offer
              </Button>
            </div>
          ) : (
            <p className="border-t border-border pt-4 text-xs text-muted-foreground">
              You responded to this offer on {formatDate(record.offer_start_date)}. Contact HR if you need to change
              anything.
            </p>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={confirmDecline} onOpenChange={setConfirmDecline}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Decline this job offer?</AlertDialogTitle>
            <AlertDialogDescription>
              This closes your application and can’t be undone. If you’re unsure, contact HR before declining.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                submit('declined')
                setConfirmDecline(false)
              }}
            >
              Confirm Decline
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function StatusResult({
  credentials,
  onSignOut,
}: {
  credentials: ApplicantCredentials
  onSignOut: () => void
}) {
  const { data: record, isLoading, error } = useApplicationTracking(credentials)

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }

  if (error || !record) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <AlertCircle className="h-6 w-6" />
          </div>
          <p className="text-sm text-muted-foreground">
            {error instanceof Error ? error.message : 'No application matches those details.'}
          </p>
          <Button variant="outline" onClick={onSignOut}>
            Try Again
          </Button>
        </CardContent>
      </Card>
    )
  }

  const copy = APPLICANT_STATUS_COPY[record.status]

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="flex flex-col gap-4 p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-mono text-xs text-muted-foreground">{record.reference_code}</p>
              <h1 className="font-display text-xl font-bold text-foreground">{record.applicant_name}</h1>
              <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
                <Building2 className="h-3.5 w-3.5" />
                {record.position_title ?? 'Position'} · {record.department_name ?? 'Department'}
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={onSignOut}>
              <LogOut className="h-4 w-4" />
              Sign out
            </Button>
          </div>

          <div className="rounded-lg border border-secondary/30 bg-secondary/5 p-4">
            <p className="font-display text-base font-semibold text-foreground">{copy.label}</p>
            <p className="mt-1 text-sm text-muted-foreground">{copy.detail}</p>
          </div>

          <p className="text-xs text-muted-foreground">Submitted {formatDateTime(record.submitted_at)}</p>
        </CardContent>
      </Card>

      <InterviewCard record={record} />
      <OfferCard record={record} credentials={credentials} />
    </div>
  )
}

export default function TrackApplicationPage() {
  // Deliberately not persisted: the reference code plus email are enough to
  // read personal details and respond to an offer, so they live only for this
  // tab's session rather than in localStorage.
  const [credentials, setCredentials] = React.useState<ApplicantCredentials | null>(null)

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-12 sm:px-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <h1 className="font-display text-2xl font-bold text-foreground sm:text-3xl">Track Your Application</h1>
        <p className="mt-2 text-muted-foreground">
          Enter the reference number from your confirmation screen to see where your application stands, view interview
          details, and respond to a job offer.
        </p>
      </motion.div>

      {credentials ? (
        <StatusResult credentials={credentials} onSignOut={() => setCredentials(null)} />
      ) : (
        <LookupForm onSubmit={setCredentials} isLoading={false} />
      )}
    </div>
  )
}
