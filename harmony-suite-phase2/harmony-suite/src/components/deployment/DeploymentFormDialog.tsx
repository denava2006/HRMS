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
import { useCompleteDeployment } from '@/hooks/useDeployment'

function todayISODate(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function DeploymentFormDialog({
  open,
  onOpenChange,
  applicationId,
  minDate,
  minDateReason,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  applicationId: string
  /** Earliest allowable deployment date — the later of the agreed offer start
   * date and the contract signing date, whichever landed last. Deploying
   * someone before either of those happened is an impossible date order. */
  minDate?: string | null
  minDateReason?: string
}) {
  const completeDeployment = useCompleteDeployment()

  const [deploymentDate, setDeploymentDate] = React.useState('')
  const [assignedBranch, setAssignedBranch] = React.useState('')
  const [workLocation, setWorkLocation] = React.useState('')
  const [remarks, setRemarks] = React.useState('')
  const [errors, setErrors] = React.useState<Record<string, string>>({})

  React.useEffect(() => {
    if (open) {
      const today = todayISODate()
      setDeploymentDate(minDate && minDate > today ? minDate : today)
      setAssignedBranch('')
      setWorkLocation('')
      setRemarks('')
      setErrors({})
    }
  }, [open, minDate])

  const onSubmit = () => {
    if (!deploymentDate) {
      setErrors({ deploymentDate: 'Deployment date is required.' })
      return
    }
    if (minDate && deploymentDate < minDate) {
      setErrors({
        deploymentDate: `Deployment date cannot be earlier than ${minDate}${minDateReason ? ` (${minDateReason})` : ''}.`,
      })
      return
    }

    completeDeployment.mutate(
      {
        applicationId,
        deploymentDate,
        assignedBranch: assignedBranch.trim() || undefined,
        workLocation: workLocation.trim() || undefined,
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
            <Label htmlFor="deployment_date">
              Deployment Date <span className="text-destructive">*</span>
            </Label>
            <Input
              id="deployment_date"
              type="date"
              min={minDate ?? undefined}
              invalid={!!errors.deploymentDate}
              value={deploymentDate}
              onChange={(e) => {
                setDeploymentDate(e.target.value)
                if (errors.deploymentDate) setErrors({})
              }}
            />
            {errors.deploymentDate && <p className="text-xs text-destructive">{errors.deploymentDate}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="assigned_branch">Assigned Branch</Label>
              <Input
                id="assigned_branch"
                autoComplete="off"
                value={assignedBranch}
                onChange={(e) => setAssignedBranch(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="work_location">Work Location</Label>
              <Input
                id="work_location"
                autoComplete="off"
                value={workLocation}
                onChange={(e) => setWorkLocation(e.target.value)}
              />
            </div>
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
