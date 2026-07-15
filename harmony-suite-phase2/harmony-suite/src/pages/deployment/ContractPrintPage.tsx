import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useSystemSettings } from '@/hooks/useSystemSettings'
import { useDeploymentApplicationDetail, getLatestOffer, getLatestContract } from '@/hooks/useDeployment'
import { EMPLOYMENT_TYPE_LABEL } from '@/lib/jobPostingLabels'
import { formatMoney, type CurrencyCode } from '@/lib/currency'

function formatDate(value: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })
}

export default function ContractPrintPage() {
  const { applicationId } = useParams<{ applicationId: string }>()
  const { data: application, isLoading } = useDeploymentApplicationDetail(applicationId)
  const { data: settings } = useSystemSettings()

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-16">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="mt-6 h-96 w-full" />
      </div>
    )
  }

  const offer = application ? getLatestOffer(application) : null
  const contract = offer ? getLatestContract(offer) : null

  if (!application || !offer || !contract) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col items-center gap-4 px-6 py-24 text-center">
        <h1 className="font-display text-2xl font-bold text-foreground">Contract not available</h1>
        <p className="text-muted-foreground">This applicant doesn't have a prepared employment contract yet.</p>
        <Button asChild variant="outline">
          <Link to="/dashboard/deployment">
            <ArrowLeft className="h-4 w-4" />
            Back to Deployment
          </Link>
        </Button>
      </div>
    )
  }

  const applicant = application.applicants
  const jobPosting = application.job_postings
  const companyName = settings?.company_name || 'Harmony Suite'

  return (
    <div className="mx-auto max-w-3xl px-6 py-10 print:p-0">
      <div className="mb-6 flex items-center justify-between print:hidden">
        <Button asChild variant="outline" size="sm">
          <Link to="/dashboard/deployment">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
        </Button>
        <Button size="sm" onClick={() => window.print()}>
          <Printer className="h-4 w-4" />
          Print / Save as PDF
        </Button>
      </div>

      <article className="flex flex-col gap-8 rounded-xl border border-border bg-card p-10 shadow-sm print:rounded-none print:border-0 print:shadow-none">
        <header className="flex flex-col items-center gap-1 border-b border-border pb-6 text-center">
          <h1 className="font-display text-2xl font-bold text-foreground">{companyName}</h1>
          <p className="text-sm text-muted-foreground">Employment Contract</p>
        </header>

        <section className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Employee Name</p>
            <p className="text-foreground">
              {applicant?.first_name} {applicant?.last_name}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Email</p>
            <p className="text-foreground">{applicant?.email ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Address</p>
            <p className="text-foreground">{applicant?.address ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Phone</p>
            <p className="text-foreground">{applicant?.phone ?? '—'}</p>
          </div>
        </section>

        <section className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Position</p>
            <p className="text-foreground">{jobPosting?.positions?.title ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Department</p>
            <p className="text-foreground">{jobPosting?.departments?.name ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Employment Type</p>
            <p className="text-foreground">{EMPLOYMENT_TYPE_LABEL[offer.employment_type]}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Salary</p>
            <p className="text-foreground">{formatMoney(offer.proposed_salary, offer.currency as CurrencyCode)}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Start Date</p>
            <p className="text-foreground">{formatDate(contract.start_date ?? offer.start_date)}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Probation Period</p>
            <p className="text-foreground">{offer.probation_period ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Working Hours</p>
            <p className="text-foreground">{offer.working_hours ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Working Days</p>
            <p className="text-foreground">{offer.working_days ?? '—'}</p>
          </div>
        </section>

        <section className="flex flex-col gap-2 text-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Benefits</p>
          <p className="whitespace-pre-line text-foreground">{offer.benefits ?? '—'}</p>
        </section>

        {offer.additional_compensation && (
          <section className="flex flex-col gap-2 text-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Additional Compensation</p>
            <p className="whitespace-pre-line text-foreground">{offer.additional_compensation}</p>
          </section>
        )}

        {contract.company_policies && (
          <section className="flex flex-col gap-2 text-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Company Policies</p>
            <p className="whitespace-pre-line text-foreground">{contract.company_policies}</p>
          </section>
        )}

        {contract.terms && (
          <section className="flex flex-col gap-2 text-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Terms &amp; Conditions</p>
            <p className="whitespace-pre-line text-foreground">{contract.terms}</p>
          </section>
        )}

        {contract.additional_notes && (
          <section className="flex flex-col gap-2 text-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Additional Notes</p>
            <p className="whitespace-pre-line text-foreground">{contract.additional_notes}</p>
          </section>
        )}

        <section className="mt-8 grid grid-cols-2 gap-10 text-sm">
          <div className="flex flex-col gap-8">
            <div className="border-b border-foreground/40 pb-1" />
            <div>
              <p className="font-medium text-foreground">HR Signature</p>
              <p className="text-xs text-muted-foreground">
                {contract.signer?.full_name ? `Signed by ${contract.signer.full_name}` : 'Harmony Suite HR'}
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-8">
            <div className="border-b border-foreground/40 pb-1" />
            <div>
              <p className="font-medium text-foreground">
                Employee Signature — {applicant?.first_name} {applicant?.last_name}
              </p>
              <p className="text-xs text-muted-foreground">
                {contract.signed_at ? `Signed on ${formatDate(contract.signed_at)}` : 'Date signed'}
              </p>
            </div>
          </div>
        </section>
      </article>
    </div>
  )
}
