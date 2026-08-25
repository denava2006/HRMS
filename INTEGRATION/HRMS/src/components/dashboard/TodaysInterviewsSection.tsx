import { useNavigate } from 'react-router-dom'
import { CalendarSearch } from 'lucide-react'
import { DashboardSectionCard, DashboardEmptyState, DashboardListSkeleton } from '@/components/dashboard/DashboardPrimitives'
import { Badge } from '@/components/ui/badge'
import { useTodaysInterviews } from '@/hooks/useDashboard'

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })
}

export function TodaysInterviewsSection({ interviewerId, title = "Today's Interviews" }: { interviewerId?: string; title?: string }) {
  const navigate = useNavigate()
  const { data, isLoading } = useTodaysInterviews(interviewerId)

  return (
    <DashboardSectionCard title={title} icon={CalendarSearch} onClick={() => navigate('/dashboard/interviews')}>
      {isLoading ? (
        <DashboardListSkeleton />
      ) : !data || data.length === 0 ? (
        <DashboardEmptyState message="No interviews scheduled today." />
      ) : (
        <div className="flex flex-col gap-2">
          {data.map((interview) => (
            <div key={interview.id} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5 text-sm">
              <div className="min-w-0">
                <p className="truncate font-medium text-foreground">{interview.applicantName}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {interview.position} · {interview.interviewerName ?? 'Unassigned'}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Badge variant={interview.interviewType === 'final' ? 'secondary' : 'outline'}>
                  {interview.interviewType === 'final' ? 'Final' : 'Initial'}
                </Badge>
                <span className="font-mono text-xs text-foreground">{formatTime(interview.scheduledAt)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </DashboardSectionCard>
  )
}
