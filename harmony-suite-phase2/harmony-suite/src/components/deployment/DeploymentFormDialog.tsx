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
import { useCompleteDeployment, type CompleteDeploymentInput } from '@/hooks/useDeployment'

type EmploymentStatus = CompleteDeploymentInput['employmentStatus']

const EMPLOYMENT_STATUS_LABEL: Record<EmploymentStatus, string> = {
  active: 'Active',
  on_leave: 'On Leave',
  suspended: 'Suspended',
  resigned: 'Resigned',
  terminated: 'Terminated',
}

function todayISODate(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function DeploymentFormDialog({
  open,
  onOpenChange,
  applicationId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  applicationId: string
}) {
  const completeDeployment = useCompleteDeployment()

  const [deploymentDate, setDeploymentDate] = React.useState('')
  const [reportingManager, setReportingManager] = React.useState('')
  const [assignedBranch, setAssignedBranch] = React.useState('')
  const [employmentStatus, setEmploymentStatus] = React.useState<EmploymentStatus>('active')
  const [workLocation, setWorkLocation] = React.useState('')
  const [reportingTime, setReportingTime] = React.useState('')
  const [remarks, setRemarks] = React.useState('')
  const [errors, setErrors] = React.useState<Record<string, string>>({})

  React.useEffect(() => {
    if (open) {
      setDeploymentDate(todayISODate())
      setReportingManager('')
      setAssignedBranch('')
      setEmploymentStatus('active')
      setWorkLocation('')
      setReportingTime('')
      setRemarks('')
      setErrors({})
    }
  }, [open])

  const onSubmit = () => {
    if (!deploymentDate) {
      setErrors({ deploymentDate: 'Deployment date is required.' })
      return
    }

    completeDeployment.mutate(
      {
        applicationId,
        deploymentDate,
        reportingManager: reportingManager.trim() || undefined,
        assignedBranch: assignedBranch.trim() || undefined,
        employmentStatus,
        workLocation: workLocation.trim() || undefined,
        reportingTime: reportingTime.trim() || undefined,
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
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="deployment_date">
                Deployment Date <span className="text-destructive">*</span>
              </Label>
              <Input
                id="deployment_date"
                type="date"
                invalid={!!errors.deploymentDate}
                value={deploymentDate}
                onChange={(e) => {
                  setDeploymentDate(e.target.value)
                  if (errors.deploymentDate) setErrors({})
                }}
              />
              {errors.deploymentDate && <p className="text-xs text-destructive">{errors.deploymentDate}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Employment Status</Label>
              <Select value={employmentStatus} onValueChange={(v) => setEmploymentStatus(v as EmploymentStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(EMPLOYMENT_STATUS_LABEL).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="reporting_manager">Reporting Manager</Label>
              <Input id="reporting_manager" value={reportingManager} onChange={(e) => setReportingManager(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="assigned_branch">Assigned Branch</Label>
              <Input id="assigned_branch" value={assignedBranch} onChange={(e) => setAssignedBranch(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="work_location">Work Location</Label>
              <Input id="work_location" value={workLocation} onChange={(e) => setWorkLocation(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="reporting_time">Reporting Time</Label>
              <Input id="reporting_time" value={reportingTime} onChange={(e) => setReportingTime(e.target.value)} placeholder="e.g. 8:00 AM" />
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
