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
import { usePrepareContract, type JobOfferRecord } from '@/hooks/useDeployment'
import { EMPLOYMENT_TYPE_LABEL } from '@/lib/jobPostingLabels'
import { formatMoney } from '@/lib/currency'

function SummaryField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm text-foreground">{value}</p>
    </div>
  )
}

export function ContractDialog({
  open,
  onOpenChange,
  applicationId,
  applicantName,
  positionTitle,
  departmentName,
  offer,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  applicationId: string
  applicantName: string
  positionTitle: string
  departmentName: string
  offer: JobOfferRecord
}) {
  const prepareContract = usePrepareContract()

  const [companyPolicies, setCompanyPolicies] = React.useState('')
  const [terms, setTerms] = React.useState('')
  const [additionalNotes, setAdditionalNotes] = React.useState('')

  React.useEffect(() => {
    if (open) {
      setCompanyPolicies('')
      setTerms('')
      setAdditionalNotes('')
    }
  }, [open])

  const onSubmit = () => {
    prepareContract.mutate(
      {
        applicationId,
        offerId: offer.id,
        startDate: offer.start_date,
        companyPolicies: companyPolicies.trim() || undefined,
        terms: terms.trim() || undefined,
        additionalNotes: additionalNotes.trim() || undefined,
      },
      { onSuccess: () => onOpenChange(false) }
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-lg flex-col gap-0 p-0">
        <DialogHeader className="p-6 pb-4">
          <DialogTitle>Prepare Employment Contract</DialogTitle>
          <DialogDescription>Auto-populated from the accepted job offer — review and add terms below.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 overflow-y-auto px-6 py-1">
          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <div className="grid grid-cols-2 gap-3">
              <SummaryField label="Applicant" value={applicantName} />
              <SummaryField label="Position" value={positionTitle} />
              <SummaryField label="Department" value={departmentName} />
              <SummaryField label="Employment Type" value={EMPLOYMENT_TYPE_LABEL[offer.employment_type]} />
              <SummaryField label="Salary" value={formatMoney(offer.proposed_salary, offer.currency === 'USD' ? 'USD' : 'PHP')} />
              <SummaryField label="Start Date" value={offer.start_date ?? '—'} />
              <SummaryField label="Working Hours" value={offer.working_hours ?? '—'} />
              <SummaryField label="Working Days" value={offer.working_days ?? '—'} />
              <SummaryField label="Probation Period" value={offer.probation_period ?? '—'} />
            </div>
            <div className="mt-3 border-t border-border pt-3">
              <SummaryField label="Benefits" value={offer.benefits ?? '—'} />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="company_policies">Company Policies</Label>
            <Textarea
              id="company_policies"
              value={companyPolicies}
              onChange={(e) => setCompanyPolicies(e.target.value)}
              rows={3}
              placeholder="Optional"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="terms">Terms</Label>
            <Textarea id="terms" value={terms} onChange={(e) => setTerms(e.target.value)} rows={3} placeholder="Optional" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="contract_additional_notes">Additional Notes</Label>
            <Textarea
              id="contract_additional_notes"
              value={additionalNotes}
              onChange={(e) => setAdditionalNotes(e.target.value)}
              rows={2}
              placeholder="Optional"
            />
          </div>
        </div>

        <DialogFooter className="p-6 pt-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" loading={prepareContract.isPending} onClick={onSubmit}>
            Prepare Contract
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
