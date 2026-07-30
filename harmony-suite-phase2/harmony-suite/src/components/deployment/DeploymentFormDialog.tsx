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
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { useCompleteDeployment } from '@/hooks/useDeployment'
import { useBranches, useWorkLocations } from '@/hooks/useBranches'
import { useWorkSchedules } from '@/hooks/useWorkSchedules'
import { formatScheduleTime, formatWorkingDays } from '@/lib/attendanceCalculations'

export function DeploymentFormDialog({
  open,
  onOpenChange,
  applicationId,
  startDate,
  contractSignedDate,
  offerWorkScheduleId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  applicationId: string
  /** The start date the accepted job offer promised. This *is* the deployment
   * date — the two used to be separate fields that could disagree about the
   * day someone joined, which is the kind of thing that only surfaces when
   * payroll runs. Shown here, not editable; changing it means changing the
   * offer. */
  startDate?: string | null
  /** Only used to warn when the contract was signed after the promised start
   * date. The date isn't adjusted for it: the offer is what both sides agreed
   * to, and quietly moving it would hide the conflict rather than show it. */
  contractSignedDate?: string | null
  /** Shift agreed on the accepted job offer — pre-selected here so deployment
   * confirms what was offered rather than starting from a blank field. */
  offerWorkScheduleId?: string | null
}) {
  const completeDeployment = useCompleteDeployment()
  const { data: branches } = useBranches()
  const { data: workSchedules } = useWorkSchedules()

  const [branchId, setBranchId] = React.useState('')
  const [workLocationId, setWorkLocationId] = React.useState('')
  const [workScheduleId, setWorkScheduleId] = React.useState('')
  const [remarks, setRemarks] = React.useState('')
  const [errors, setErrors] = React.useState<Record<string, string>>({})

  // Locations are scoped to the chosen branch — picking a location that
  // belongs to a different branch is not a valid combination.
  const { data: locations } = useWorkLocations(branchId || null)

  React.useEffect(() => {
    if (open) {
      setBranchId('')
      setWorkLocationId('')
      setWorkScheduleId(offerWorkScheduleId ?? workSchedules?.find((s) => s.is_default)?.id ?? '')
      setRemarks('')
      setErrors({})
    }
  }, [open, offerWorkScheduleId, workSchedules])

  const selectedBranch = branches?.find((b) => b.id === branchId) ?? null
  const selectedLocation = locations?.find((l) => l.id === workLocationId) ?? null
  const selectedSchedule = workSchedules?.find((s) => s.id === workScheduleId) ?? null

  const onSubmit = () => {
    const nextErrors: Record<string, string> = {}
    if (!startDate) nextErrors.deploymentDate = 'This offer has no start date, so there is no day to deploy on.'
    if (!branchId) nextErrors.branchId = 'Assigned branch is required.'
    if (!workLocationId) nextErrors.workLocationId = 'Work location is required.'
    if (!workScheduleId) nextErrors.workScheduleId = 'Work schedule is required.'
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }

    completeDeployment.mutate(
      {
        applicationId,
        deploymentDate: startDate as string,
        branchId,
        workLocationId,
        workScheduleId,
        // The text columns stay populated so existing views and any historical
        // record keep reading the same way.
        assignedBranch: selectedBranch?.name,
        workLocation: selectedLocation?.name,
        remarks: remarks.trim() || undefined,
      },
      { onSuccess: () => onOpenChange(false) }
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Complete Deployment</DialogTitle>
          <DialogDescription>Confirms the applicant has officially joined the company.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="deployment_date">Deployment Date</Label>
            <Input id="deployment_date" type="date" value={startDate ?? ''} disabled readOnly />
            <p className="text-xs text-muted-foreground">
              This is the start date agreed on the job offer. To change it, change the offer.
            </p>
            {contractSignedDate && startDate && contractSignedDate > startDate && (
              <p className="text-xs text-warning">
                The contract was signed on {contractSignedDate}, after the agreed start date. Deploying on the agreed date
                records a first day that has already passed.
              </p>
            )}
            {errors.deploymentDate && <p className="text-xs text-destructive">{errors.deploymentDate}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="assigned_branch">
                Assigned Branch <span className="text-destructive">*</span>
              </Label>
              <Select
                value={branchId}
                onValueChange={(v) => {
                  setBranchId(v)
                  setWorkLocationId('')
                  if (errors.branchId) setErrors((prev) => ({ ...prev, branchId: '' }))
                }}
              >
                <SelectTrigger id="assigned_branch" invalid={!!errors.branchId}>
                  <SelectValue placeholder={branches?.length ? 'Select a branch' : 'No branches configured'} />
                </SelectTrigger>
                <SelectContent>
                  {branches?.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.branchId && <p className="text-xs text-destructive">{errors.branchId}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="work_location">
                Work Location <span className="text-destructive">*</span>
              </Label>
              <Select
                value={workLocationId}
                onValueChange={(v) => {
                  setWorkLocationId(v)
                  if (errors.workLocationId) setErrors((prev) => ({ ...prev, workLocationId: '' }))
                }}
                disabled={!branchId}
              >
                <SelectTrigger id="work_location" invalid={!!errors.workLocationId}>
                  <SelectValue placeholder={branchId ? 'Select a location' : 'Select a branch first'} />
                </SelectTrigger>
                <SelectContent>
                  {locations?.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.workLocationId && <p className="text-xs text-destructive">{errors.workLocationId}</p>}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="deployment_work_schedule">
              Work Schedule <span className="text-destructive">*</span>
            </Label>
            <Select
              value={workScheduleId}
              onValueChange={(v) => {
                setWorkScheduleId(v)
                if (errors.workScheduleId) setErrors((prev) => ({ ...prev, workScheduleId: '' }))
              }}
            >
              <SelectTrigger id="deployment_work_schedule" invalid={!!errors.workScheduleId}>
                <SelectValue placeholder={workSchedules?.length ? 'Select a shift' : 'No work schedules configured'} />
              </SelectTrigger>
              <SelectContent>
                {workSchedules?.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                    {s.is_default ? ' (default)' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.workScheduleId ? (
              <p className="text-xs text-destructive">{errors.workScheduleId}</p>
            ) : selectedSchedule ? (
              <p className="text-xs text-muted-foreground">
                {formatWorkingDays(selectedSchedule.working_days)} ·{' '}
                {formatScheduleTime(selectedSchedule.start_time)} – {formatScheduleTime(selectedSchedule.end_time)}
                {' · '}the employee&apos;s attendance is measured against this shift
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="deployment_remarks">Remarks</Label>
            <Textarea id="deployment_remarks" value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={2} placeholder="Optional" />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" loading={completeDeployment.isPending} onClick={onSubmit}>
            Complete Deployment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
