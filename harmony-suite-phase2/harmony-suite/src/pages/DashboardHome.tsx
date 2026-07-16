import * as React from 'react'
import { Clock } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { Card, CardContent } from '@/components/ui/card'
import { QuickActions } from '@/components/dashboard/QuickActions'
import { OrganizationOverviewSection, RecruitmentOverviewSection, EmployeeOverviewSection } from '@/components/dashboard/OverviewSections'
import { TodaysInterviewsSection } from '@/components/dashboard/TodaysInterviewsSection'
import {
  AttendanceSummarySection,
  LeaveRequestsSection,
  DeploymentStatusSection,
  PayrollSummarySection,
} from '@/components/dashboard/OperationsSections'
import { NotificationsSection, RecentActivitySection, UpcomingScheduleSection } from '@/components/dashboard/ActivitySections'
import { DashboardCharts } from '@/components/dashboard/DashboardCharts'
import { HrAccountsSection, SystemStatusSection, RecentAuditLogsSection } from '@/components/dashboard/AdminWidgets'
import { useDashboardRealtimeAlerts } from '@/hooks/useDashboard'

function useLiveClock() {
  const [now, setNow] = React.useState(() => new Date())
  React.useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(interval)
  }, [])
  return now
}

function WelcomeSection({ name }: { name: string }) {
  const now = useLiveClock()
  return (
    <Card>
      <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
        <div>
          <h2 className="font-display text-xl font-semibold text-foreground">Welcome back, {name}.</h2>
          <p className="text-sm text-muted-foreground">Here's the current state of your organization.</p>
        </div>
        <div className="flex items-center gap-2 rounded-lg bg-accent/10 px-4 py-2.5 text-accent">
          <Clock className="h-4 w-4" />

        </div>
      </CardContent>
    </Card>
  )
}

/** No self-service portal exists yet for employee-role logins — they're
 * fully blocked from the internal HR dashboard routes, so this is the only
 * thing they ever see after activating their account. */
function EmployeePortalPlaceholder() {
  const { profile } = useAuth()
  return (
    <div className="flex flex-col items-center gap-3 py-24 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent/10 text-accent">
        <Clock className="h-6 w-6" />
      </div>
      <h2 className="font-display text-xl font-semibold text-foreground">
        Welcome, {profile?.full_name?.split(' ')[0]}.
      </h2>
      <p className="max-w-sm text-sm text-muted-foreground">
        Your employee self-service portal is coming soon. Contact HR if you need anything in the meantime.
      </p>
    </div>
  )
}

export default function DashboardHome() {
  const { profile } = useAuth()
  useDashboardRealtimeAlerts()

  if (profile?.role === 'employee') {
    return <EmployeePortalPlaceholder />
  }

  const isAdmin = profile?.role === 'admin'

  return (
    <div className="flex flex-col gap-4">
      <WelcomeSection name={profile?.full_name ?? 'there'} />

      <QuickActions isAdmin={isAdmin} />

      <OrganizationOverviewSection />
      <RecruitmentOverviewSection />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <TodaysInterviewsSection interviewerId={isAdmin ? undefined : profile?.id} />
        <AttendanceSummarySection />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <LeaveRequestsSection />
        <PayrollSummarySection />
      </div>

      <DeploymentStatusSection />
      <EmployeeOverviewSection />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <NotificationsSection />
        <UpcomingScheduleSection />
      </div>

      <RecentActivitySection />

      <div>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Analytics</h3>
        <DashboardCharts />
      </div>

      {isAdmin && (
        <div className="flex flex-col gap-4">
          <h3 className="mt-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Administration</h3>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <HrAccountsSection />
            <SystemStatusSection />
          </div>
          <RecentAuditLogsSection />
        </div>
      )}
    </div>
  )
}
