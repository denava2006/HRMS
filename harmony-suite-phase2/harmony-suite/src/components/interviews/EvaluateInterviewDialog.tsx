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
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { MoneyInput } from '@/components/MoneyInput'
import { useSubmitInitialEvaluation, useSubmitFinalEvaluation } from '@/hooks/useInterviews'
import { useCurrency } from '@/hooks/useSystemSettings'
import type { InterviewType } from '@/lib/database.types'
import { RATING_OPTIONS } from '@/lib/interviewLabels'

function RatingSelect({
  label,
  value,
  onChange,
  invalid,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  invalid?: boolean
}) {
  return (
    <div className="flex flex-col gap-1.5">
      {/* min-h + items-end reserves space for a 2-line label (e.g. "Technical
       * Evaluation") so single-line labels ("Leadership") still bottom-align,
       * keeping every Select in the row starting at the same Y position. */}
      <Label className="flex min-h-[2.5rem] items-end">
        {label} <span className="text-destructive">*</span>
      </Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger invalid={invalid}>
          <SelectValue placeholder="Rate 1-5" />
        </SelectTrigger>
        <SelectContent>
          {RATING_OPTIONS.map((n) => (
            <SelectItem key={n} value={String(n)}>
              {n} / 5
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

export function EvaluateInterviewDialog({
  open,
  onOpenChange,
  applicationId,
  interviewId,
  stage,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  applicationId: string
  interviewId: string
  stage: InterviewType
}) {
  const currency = useCurrency()
  const submitInitial = useSubmitInitialEvaluation()
  const submitFinal = useSubmitFinalEvaluation()
  const isPending = submitInitial.isPending || submitFinal.isPending

  // Initial-stage fields
  const [communication, setCommunication] = React.useState('')
  const [technicalSkills, setTechnicalSkills] = React.useState('')
  const [confidence, setConfidence] = React.useState('')
  const [experience, setExperience] = React.useState('')
  const [problemSolving, setProblemSolving] = React.useState('')
  const [overallImpression, setOverallImpression] = React.useState('')
  const [interviewNotes, setInterviewNotes] = React.useState('')

  // Final-stage fields
  const [technicalEvaluation, setTechnicalEvaluation] = React.useState('')
  const [cultureFit, setCultureFit] = React.useState('')
  const [leadership, setLeadership] = React.useState('')
  const [finalRemarks, setFinalRemarks] = React.useState('')
  const [recommendedSalary, setRecommendedSalary] = React.useState('')

  const [showRejectionReason, setShowRejectionReason] = React.useState(false)
  const [rejectionReason, setRejectionReason] = React.useState('')
  const [reasonError, setReasonError] = React.useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({})

  React.useEffect(() => {
    if (open) {
      setCommunication('')
      setTechnicalSkills('')
      setConfidence('')
      setExperience('')
      setProblemSolving('')
      setOverallImpression('')
      setInterviewNotes('')
      setTechnicalEvaluation('')
      setCultureFit('')
      setLeadership('')
      setFinalRemarks('')
      setRecommendedSalary('')
      setShowRejectionReason(false)
      setRejectionReason('')
      setReasonError(null)
      setFieldErrors({})
    }
  }, [open])

  const toNumber = (v: string) => (v ? Number(v) : undefined)

  /** No evaluation should be saved without its ratings and a comment on file —
   * required regardless of whether the applicant passes or is rejected. */
  const validateEvaluationFields = (): boolean => {
    const nextErrors: Record<string, string> = {}
    if (stage === 'initial') {
      if (!communication) nextErrors.communication = 'Required'
      if (!technicalSkills) nextErrors.technicalSkills = 'Required'
      if (!confidence) nextErrors.confidence = 'Required'
      if (!experience) nextErrors.experience = 'Required'
      if (!problemSolving) nextErrors.problemSolving = 'Required'
      if (!overallImpression.trim()) nextErrors.overallImpression = 'Overall impression is required.'
    } else {
      if (!technicalEvaluation) nextErrors.technicalEvaluation = 'Required'
      if (!cultureFit) nextErrors.cultureFit = 'Required'
      if (!leadership) nextErrors.leadership = 'Required'
      if (!finalRemarks.trim()) nextErrors.finalRemarks = 'Final remarks are required.'
    }
    setFieldErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const onRejectClick = () => {
    if (!showRejectionReason) {
      setShowRejectionReason(true)
      return
    }
    if (!validateEvaluationFields()) return
    if (!rejectionReason.trim()) {
      setReasonError('A rejection reason is required.')
      return
    }
    submitDecision('failed')
  }

  const onPassClick = () => {
    if (!validateEvaluationFields()) return
    submitDecision('passed')
  }

  const submitDecision = (decision: 'passed' | 'failed') => {
    if (stage === 'initial') {
      submitInitial.mutate(
        {
          interviewId,
          applicationId,
          decision,
          ratings: {
            communication: toNumber(communication),
            technicalSkills: toNumber(technicalSkills),
            confidence: toNumber(confidence),
            experience: toNumber(experience),
            problemSolving: toNumber(problemSolving),
          },
          overallImpression: overallImpression.trim() || undefined,
          interviewNotes: interviewNotes.trim() || undefined,
          rejectionReason: decision === 'failed' ? rejectionReason.trim() : undefined,
        },
        { onSuccess: () => onOpenChange(false) }
      )
    } else {
      submitFinal.mutate(
        {
          interviewId,
          applicationId,
          decision,
          ratings: {
            technicalEvaluation: toNumber(technicalEvaluation),
            cultureFit: toNumber(cultureFit),
            leadership: toNumber(leadership),
          },
          finalRemarks: finalRemarks.trim() || undefined,
          recommendedSalary: toNumber(recommendedSalary),
          rejectionReason: decision === 'failed' ? rejectionReason.trim() : undefined,
        },
        { onSuccess: () => onOpenChange(false) }
      )
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{stage === 'initial' ? 'Initial Interview Evaluation' : 'Final Interview Evaluation'}</DialogTitle>
          <DialogDescription>Record the evaluation and decide whether the applicant advances.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-5">
          {Object.keys(fieldErrors).length > 0 && (
            <p className="text-xs text-destructive">Every rating and the required comment must be filled in before this evaluation can be saved.</p>
          )}

          {stage === 'initial' ? (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <RatingSelect label="Communication" value={communication} onChange={setCommunication} invalid={!!fieldErrors.communication} />
                <RatingSelect label="Technical Skills" value={technicalSkills} onChange={setTechnicalSkills} invalid={!!fieldErrors.technicalSkills} />
                <RatingSelect label="Confidence" value={confidence} onChange={setConfidence} invalid={!!fieldErrors.confidence} />
                <RatingSelect label="Experience" value={experience} onChange={setExperience} invalid={!!fieldErrors.experience} />
                <RatingSelect label="Problem Solving" value={problemSolving} onChange={setProblemSolving} invalid={!!fieldErrors.problemSolving} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="overall_impression">
                  Overall Impression <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="overall_impression"
                  invalid={!!fieldErrors.overallImpression}
                  value={overallImpression}
                  onChange={(e) => {
                    setOverallImpression(e.target.value)
                    if (fieldErrors.overallImpression) setFieldErrors((prev) => ({ ...prev, overallImpression: '' }))
                  }}
                  rows={2}
                />
                {fieldErrors.overallImpression && <p className="text-xs text-destructive">{fieldErrors.overallImpression}</p>}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="interview_notes">Interview Notes</Label>
                <Textarea id="interview_notes" value={interviewNotes} onChange={(e) => setInterviewNotes(e.target.value)} rows={3} />
              </div>
            </>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <RatingSelect label="Technical Evaluation" value={technicalEvaluation} onChange={setTechnicalEvaluation} invalid={!!fieldErrors.technicalEvaluation} />
                <RatingSelect label="Culture Fit" value={cultureFit} onChange={setCultureFit} invalid={!!fieldErrors.cultureFit} />
                <RatingSelect label="Leadership" value={leadership} onChange={setLeadership} invalid={!!fieldErrors.leadership} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="final_remarks">
                  Final Remarks <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="final_remarks"
                  invalid={!!fieldErrors.finalRemarks}
                  value={finalRemarks}
                  onChange={(e) => {
                    setFinalRemarks(e.target.value)
                    if (fieldErrors.finalRemarks) setFieldErrors((prev) => ({ ...prev, finalRemarks: '' }))
                  }}
                  rows={3}
                />
                {fieldErrors.finalRemarks && <p className="text-xs text-destructive">{fieldErrors.finalRemarks}</p>}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="recommended_salary">Recommended Salary (optional)</Label>
                <MoneyInput
                  id="recommended_salary"
                  currency={currency}
                  value={recommendedSalary}
                  onValueChange={setRecommendedSalary}
                />
              </div>
            </>
          )}

          {showRejectionReason && (
            <div className="flex flex-col gap-1.5 border-t border-border pt-4">
              <Label htmlFor="rejection_reason">
                Rejection Reason <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="rejection_reason"
                invalid={!!reasonError}
                autoFocus
                value={rejectionReason}
                onChange={(e) => {
                  setRejectionReason(e.target.value)
                  if (reasonError) setReasonError(null)
                }}
                rows={2}
              />
              {reasonError && <p className="text-xs text-destructive">{reasonError}</p>}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" variant="destructive" loading={isPending} onClick={onRejectClick}>
            {showRejectionReason ? 'Confirm Rejection' : 'Reject Applicant'}
          </Button>
          <Button type="button" variant="accent" loading={isPending} onClick={onPassClick}>
            {stage === 'initial' ? 'Pass Initial Interview' : 'Hire Applicant'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
