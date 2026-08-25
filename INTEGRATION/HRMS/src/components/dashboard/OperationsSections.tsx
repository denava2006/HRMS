import { useNavigate } from 'react-router-dom'
import { CalendarClock, CalendarCheck, Truck, Wallet } from 'lucide-react'
import { DashboardSectionCard, MiniStat, DashboardEmptyState } from '@/components/dashboard/DashboardPrimitives'
import { Badge } from '@/components/ui/badge'
import { useAttendanceStats } from '@/hooks/useAttendance'
import { usePendingLeaveBreakdown, useDashboardPayrollSummary } from '@/hooks/useDashboard'
import { PAYROLL_STATUS_VARIANT } from '@/lib/payrollLabels'
import type { PayrollStatus } from '@/lib/enums'
import { useDeploymentApplications, useDeploymentStats } from '@/hooks/useDeployment'
import { usePendingEmployees } from '@/hooks/useEmployees'
import { formatMoney } from '@/lib/currency'

export function AttendanceSummarySection() {
  const navigate = useNavigate()
  const { data, isLoading } = useAttendanceStats()
  return (
    <DashboardSectionCard title="Attendance Summary" icon={CalendarClock} onClick={() => navigate('/dashboard/attendance')}>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MiniStat label="Present" value={data?.presentCount ?? 0} isLoading={isLoading} />
        <MiniStat label="Late" value={data?.lateCount ?? 0} isLoading={isLoading} />
        <MiniStat label="Absent" value={data?.absentCount ?? 0} isLoading={isLoading} />
        <MiniStat label="On Leave" value={data?.onLeaveCount ?? 0} isLoading={isLoading} />
      </div>
    </DashboardSectionCard>
  )
}

export function LeaveRequestsSection() {
  const navigate = useNavigate()
  const { data, isLoading } = usePendingLeaveBreakdown()
  return (
    <DashboardSectionCard title="Leave Requests" icon={CalendarCheck} onClick={() => navigate('/dashboard/leave')}>
      <div className="flex flex-col gap-3">
        <MiniStat label="Pending Leave Requests" value={data?.total ?? 0} isLoading={isLoading} />
        {!isLoading && data && data.breakdown.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {data.breakdown.map((item) => (
              <Badge key={item.name} variant="outline">
                {item.name}: {item.count}
              </Badge>
            ))}
          </div>
        )}
        {!isLoading && (!data || data.total === 0) && <DashboardEmptyState message="No pending leave requests." />}
      </div>
    </DashboardSectionCard>
  )
}

export function DeploymentStatusSection() {
  const navigate = useNavigate()
  const { data: applications, isLoading } = useDeploymentApplications()
  const stats = useDeploymentStats(applications)
  const { data: pending, isLoading: pendingLoading } = usePendingEmployees()

  return (
    <DashboardSectionCard title="Deployment Status" icon={Truck} onClick={() => navigate('/dashboard/deployment')}>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <MiniStat label="Pending Job Offers" value={stats.pendingOffersCount} isLoading={isLoading} />
        <MiniStat label="Awaiting Response" value={stats.awaitingOfferResponseCount} isLoading={isLoading} />
        <MiniStat label="Contracts Ready" value={stats.contractsReadyCount} isLoading={isLoading} />
        <MiniStat label="Waiting for Signature" value={stats.waitingForSignatureCount} isLoading={isLoading} />
        <MiniStat label="Pending Employee Creation" value={pending?.length ?? 0} isLoading={pendingLoading} />
        <MiniStat label="Ready for Deployment" value={stats.readyForDeploymentCount} isLoading={isLoading} />
      </div>
    </DashboardSectionCard>
  )
}

/** Dashboard shorthand for payroll status. The payroll page's own labels are
 * step names ("Pending Approval"), which read as process jargon on a summary
 * card that only answers "where is payroll up to".
 *
 * Typed against PayrollStatus, not string. The previous Record<string, …> told
 * the compiler every key existed, so when the workflow gained three states this
 * map silently returned undefined and threw on .variant — the dashboard failed
 * to render at all. Keyed this way, a new status fails the build here instead. */
const PAYROLL_STATUS_DISPLAY: Record<PayrollStatus, string> = {
  draft: 'Not started',
  generated: 'Processing',
  pending_approval: 'For approval',
  approved: 'Ready to release',
  rejected: 'Needs correction',
  released: 'Completed',
}

export function PayrollSummarySection() {
  const navigate = useNavigate()
  const { data, isLoading } = useDashboardPayrollSummary()

  return (
    <DashboardSectionCard title="Payroll Summary" icon={Wallet} onClick={() => navigate('/dashboard/payroll')}>
      {!isLoading && !data ? (
        <DashboardEmptyState message="No payroll currently being processed." />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MiniStat
            label="Current Payroll Period"
            value={data ? `${data.periodStart} – ${data.periodEnd}` : '—'}
            isLoading={isLoading}
          />
          <MiniStat label="Employees Included" value={data?.employeesIncluded ?? 0} isLoading={isLoading} />
          <MiniStat label="Estimated Payroll" value={data ? formatMoney(data.estimatedPayroll, data.currency) : '—'} isLoading={isLoading} />
          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <p className="text-xs text-muted-foreground">Payroll Status</p>
            {isLoading ? null : (
              <Badge variant={data ? PAYROLL_STATUS_VARIANT[data.status] : 'muted'} className="mt-1">
                {data ? PAYROLL_STATUS_DISPLAY[data.status] : '—'}
              </Badge>
            )}
          </div>
        </div>
      )}
    </DashboardSectionCard>
  )
}
