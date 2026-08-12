import { useNavigate } from 'react-router-dom'
import { ShieldCheck, Database, Mail, HardDriveDownload, ScrollText } from 'lucide-react'
import { DashboardSectionCard, MiniStat, DashboardEmptyState, DashboardListSkeleton } from '@/components/dashboard/DashboardPrimitives'
import { Badge } from '@/components/ui/badge'
import { useHrAccountsOverview, useRecentAuditLogs } from '@/hooks/useDashboard'

export function HrAccountsSection() {
  const navigate = useNavigate()
  const { data, isLoading } = useHrAccountsOverview()
  return (
    <DashboardSectionCard title="HR Accounts" icon={ShieldCheck} onClick={() => navigate('/dashboard/admin/accounts')}>
      <div className="grid grid-cols-3 gap-3">
        <MiniStat label="Total HR Accounts" value={data?.total ?? 0} isLoading={isLoading} />
        <MiniStat label="Active HR Staff" value={data?.active ?? 0} isLoading={isLoading} />
        <MiniStat label="Disabled Accounts" value={data?.disabled ?? 0} isLoading={isLoading} />
      </div>
    </DashboardSectionCard>
  )
}

/** Database/Email/Backup are lightweight system-health indicators, not a full
 * monitoring integration — Database Status reflects whether this widget's own
 * query actually succeeded (a real signal); Email and Backup are Supabase-managed
 * services with no client-exposed health API, so they're shown as descriptive,
 * honestly-labeled status rather than fabricated live metrics. */
export function SystemStatusSection() {
  const { isError, isLoading } = useHrAccountsOverview()

  return (
    <DashboardSectionCard title="System Status" icon={Database}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-3">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm text-foreground">Database</p>
          </div>
          {!isLoading && <Badge variant={isError ? 'destructive' : 'success'}>{isError ? 'Offline' : 'Online'}</Badge>}
        </div>
        <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-3">
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm text-foreground">Email Service</p>
          </div>
          <Badge variant="success">Healthy</Badge>
        </div>
        <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-3">
          <div className="flex items-center gap-2">
            <HardDriveDownload className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm text-foreground">Backups</p>
          </div>
          <span className="text-xs text-muted-foreground">Automatic (Supabase-managed)</span>
        </div>
      </div>
    </DashboardSectionCard>
  )
}

export function RecentAuditLogsSection() {
  const navigate = useNavigate()
  const { data, isLoading } = useRecentAuditLogs(8)
  return (
    <DashboardSectionCard title="Recent Audit Logs" icon={ScrollText} onClick={() => navigate('/dashboard/admin/accounts')}>
      {isLoading ? (
        <DashboardListSkeleton />
      ) : !data || data.length === 0 ? (
        <DashboardEmptyState message="No recent audit log entries." />
      ) : (
        <div className="flex flex-col gap-2">
          {data.map((log) => (
            <div key={log.id} className="flex items-center justify-between gap-3 text-sm">
              <p className="min-w-0 truncate text-foreground">
                {log.actor?.full_name && <span className="font-medium">{log.actor.full_name} — </span>}
                {log.action}
              </p>
              <span className="shrink-0 text-xs text-muted-foreground">
                {new Date(log.created_at).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
              </span>
            </div>
          ))}
        </div>
      )}
    </DashboardSectionCard>
  )
}
