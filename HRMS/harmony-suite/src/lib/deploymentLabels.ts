import type { Enums } from '@/lib/database.types'
import type { ApplicationStatus } from '@/lib/applicationStatusLabels'
import type { BadgeProps } from '@/components/ui/badge'

export type OfferStatus = Enums<'offer_status'>
export type ContractStatus = Enums<'contract_status'>

/** Why an applicant turned an offer down. Fixed list rather than free text so
 * it stays a reportable dimension — "we lose people on salary" is only
 * knowable if the answers are comparable. Mirrored by a check constraint on
 * job_offers.decline_reason; keep the two in step. */
export const OFFER_DECLINE_REASONS = [
  'Accepted another job offer',
  'Salary expectation',
  'Personal reason',
  'Location',
  'Schedule conflict',
  'Other',
] as const

export const OFFER_STATUS_LABEL: Record<OfferStatus, string> = {
  pending: 'Waiting for Offer Acceptance',
  accepted: 'Offer Accepted',
  declined: 'Offer Declined',
}

export const OFFER_STATUS_VARIANT: Record<OfferStatus, BadgeProps['variant']> = {
  pending: 'secondary',
  accepted: 'success',
  declined: 'destructive',
}

/** 'printed' is the underlying enum value for what the product calls "Contract Ready". */
export const CONTRACT_STATUS_LABEL: Record<ContractStatus, string> = {
  draft: 'Contract Draft',
  printed: 'Contract Ready',
  signed: 'Contract Signed',
}

export const CONTRACT_STATUS_VARIANT: Record<ContractStatus, BadgeProps['variant']> = {
  draft: 'muted',
  printed: 'warning',
  signed: 'success',
}

/** The Deployment pipeline stage an applicant is at, derived from their latest
 * job offer / contract / deployment record — no persisted "stage" column,
 * mirroring how Interview Management derives its own stage. */
export type DeploymentStage =
  | 'pending_offer'
  | 'awaiting_offer_response'
  | 'offer_declined'
  | 'offer_accepted'
  | 'contract_draft'
  | 'contract_ready'
  | 'contract_signed'
  | 'deployed'

export const DEPLOYMENT_STAGE_LABEL: Record<DeploymentStage, string> = {
  pending_offer: 'Pending Job Offer',
  awaiting_offer_response: 'Awaiting Offer Response',
  offer_declined: 'Offer Declined',
  offer_accepted: 'Offer Accepted',
  contract_draft: 'Contract Draft',
  contract_ready: 'Contract Ready',
  contract_signed: 'Contract Signed',
  deployed: 'Deployed',
}

export const DEPLOYMENT_STAGE_VARIANT: Record<DeploymentStage, BadgeProps['variant']> = {
  pending_offer: 'muted',
  awaiting_offer_response: 'secondary',
  offer_declined: 'destructive',
  offer_accepted: 'secondary',
  contract_draft: 'secondary',
  contract_ready: 'warning',
  contract_signed: 'warning',
  deployed: 'success',
}

export interface DeploymentStageInput {
  applicationStatus: ApplicationStatus
  offerStatus: OfferStatus | null
  contractStatus: ContractStatus | null
  hasDeploymentRecord: boolean
}

export function deriveDeploymentStage({
  applicationStatus,
  offerStatus,
  contractStatus,
  hasDeploymentRecord,
}: DeploymentStageInput): DeploymentStage {
  // A declined offer stays visible in Deployment until HR closes it — checked
  // before 'closed' so the stage is the same whether HR has acted yet or not.
  if (offerStatus === 'declined') return 'offer_declined'
  if (applicationStatus === 'closed') return 'offer_declined'
  if (hasDeploymentRecord || applicationStatus === 'deployed') return 'deployed'
  if (contractStatus === 'signed') return 'contract_signed'
  if (contractStatus === 'printed') return 'contract_ready'
  if (contractStatus === 'draft') return 'contract_draft'
  if (offerStatus === 'accepted') return 'offer_accepted'
  if (offerStatus === 'pending') return 'awaiting_offer_response'
  return 'pending_offer'
}

/** The application statuses an applicant can hold while inside the Deployment
 * pipeline — used for the page's Status filter. 'closed' is included so a
 * declined offer HR has already closed stays reviewable in context rather than
 * vanishing to Recruitment the moment the applicant clicks Decline. */
export const DEPLOYMENT_PIPELINE_STATUSES = ['hired', 'offered', 'deployed', 'closed'] as const
