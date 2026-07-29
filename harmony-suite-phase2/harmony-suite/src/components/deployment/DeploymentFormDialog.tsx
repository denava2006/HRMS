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
  const { data: branches } = useBranches()

  const [deploymentDate, setDeploymentDate] = React.useState('')
  const [branchId, setBranchId] = React.useState('')
  const [workLocationId, setWorkLocationId] = React.useState('')
  const [remarks, setRemarks] = React.useState('')
  const [errors, setErrors] = React.useState<Record<string, string>>({})

  // Locations are scoped to the chosen branch — picking a location that
  // belongs to a different branch is not a valid combination.
  const { data: locations } = useWorkLocations(branchId || null)

  React.useEffect(() => {
    if (open) {
      const today = todayISODate()
      setDeploymentDate(minDate && minDate > today ? minDate : today)
      setBranchId('')
      setWorkLocationId('')
      setRemarks('')
      setErrors({})
    }
  }, [open, minDate])

  const selectedBranch = branches?.find((b) => b.id === branchId) ?? null
  const selectedLocation = locations?.find((l) => l.id === workLocationId) ?? null

  const onSubmit = () => {
    const nextErrors: Record<string, string> = {}
    if (!deploymentDate) {
      nextErrors.deploymentDate = 'Deployment date is required.'
    } else if (minDate && deploymentDate < minDate) {
      nextErrors.deploymentDate = `Deployment date cannot be earlier than ${minDate}${minDateReason ? ` (${minDateReason})` : ''}.`
    }
    if (!branchId) nextErrors.branchId = 'Assigned branch is required.'
    if (!workLocationId) nextErrors.workLocationId = 'Work location is required.'
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }

    completeDeployment.mutate(
      {
        applicationId,
        deploymentDate,
        branchId,
        workLocationId,
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
