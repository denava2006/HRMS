import { Bell, ListChecks, CalendarDays } from 'lucide-react'
import { DashboardSectionCard, DashboardEmptyState, DashboardListSkeleton } from '@/components/dashboard/DashboardPrimitives'
import { useRecentActivity, type ActivityItem } from '@/hooks/useDashboard'
import { useUpcomingEvents } from '@/hooks/useUpcomingEvents'

function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(diffMs / 60_000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })
}

function formatClockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', hour12: false })
}

function ActivityRow({ item, showClockTime }: { item: ActivityItem; showClockTime?: boolean }) {
  return (
    <div className="flex items-start gap-3 text-sm">
      <span className="mt-0.5 shrink-0 font-mono text-xs text-muted-foreground">
        {showClockTime ? formatClockTime(item.createdAt) : formatRelativeTime(item.createdAt)}
      </span>
      <p className="text-foreground">
        {item.actorName && <span className="font-medium">{item.actorName} — </span>}
        {item.message}
      </p>
    </div>
  )
}

export function NotificationsSection() {
  const { data, isLoading } = useRecentActivity(6)
  return (
    <DashboardSectionCard title="Notifications" icon={Bell}>
      {isLoading ? (
        <DashboardListSkeleton />
      ) : !data || data.length === 0 ? (
        <DashboardEmptyState message="No recent notifications." />
      ) : (
        <div className="flex flex-col gap-2.5">
          {data.map((item) => (
            <ActivityRow key={item.id} item={item} />
          ))}
        </div>
      )}
    </DashboardSectionCard>
  )
}

export function RecentActivitySection() {
  const { data, isLoading } = useRecentActivity(10)
  return (
    <DashboardSectionCard title="Recent Activity" icon={ListChecks}>
      {isLoading ? (
        <DashboardListSkeleton rows={5} />
      ) : !data || data.length === 0 ? (
        <DashboardEmptyState message="No recent activities." />
      ) : (
        <div className="flex flex-col gap-2.5">
          {data.map((item) => (
            <ActivityRow key={item.id} item={item} showClockTime />
          ))}
        </div>
      )}
    </DashboardSectionCard>
  )
}

const EVENT_TYPE_LABEL: Record<string, string> = {
  interview: 'Interview',
  deployment: 'Deployment',
  leave: 'Leave',
  payroll: 'Payroll',
  holiday: 'Holiday',
}

export function UpcomingScheduleSection() {
  const { data, isLoading } = useUpcomingEvents()
  const upcoming = (data ?? []).slice(0, 8)

  return (
    <DashboardSectionCard title="Upcoming Schedule" icon={CalendarDays}>
      {isLoading ? (
        <DashboardListSkeleton />
      ) : upcoming.length === 0 ? (
        <DashboardEmptyState message="No upcoming events." />
      ) : (
        <div className="flex flex-col gap-2">
          {upcoming.map((event, i) => (
            <div key={i} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm">
              <p className="min-w-0 truncate text-foreground">{event.label}</p>
              <span className="shrink-0 text-xs text-muted-foreground">
                {EVENT_TYPE_LABEL[event.type]} · {new Date(event.date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
              </span>
            </div>
          ))}
        </div>
      )}
    </DashboardSectionCard>
  )
}
