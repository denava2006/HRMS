import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

/** A single dated item shown on the global calendar widget. Currently only
 * Interview Management produces these — Deployment, Leave, and Payroll will
 * add their own 'type' once those modules exist, reusing this same shape. */
export interface CalendarEvent {
  date: string
  label: string
  type: 'interview' | 'deployment' | 'leave' | 'payroll'
}

interface UpcomingInterviewRow {
  scheduled_at: string
  interview_type: 'initial' | 'final'
  applications: {
    applicants: { first_name: string; last_name: string } | null
  } | null
}

/** Every upcoming scheduled interview org-wide — the calendar is a shared
 * awareness widget, not an action surface, so it isn't scoped to "my"
 * interviews the way the ownership-gated action buttons are. */
export function useUpcomingEvents() {
  return useQuery({
    queryKey: ['upcoming-events'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('interviews')
        .select('scheduled_at, interview_type, applications(applicants(first_name, last_name))')
        .eq('status', 'scheduled')
        .gte('scheduled_at', new Date().toISOString())
        .order('scheduled_at', { ascending: true })
        .limit(20)
      if (error) throw error

      return (data as unknown as UpcomingInterviewRow[]).map(
        (row): CalendarEvent => ({
          date: row.scheduled_at,
          label: `${row.interview_type === 'initial' ? 'Initial' : 'Final'} Interview — ${row.applications?.applicants?.first_name ?? ''} ${row.applications?.applicants?.last_name ?? ''}`.trim(),
          type: 'interview',
        })
      )
    },
    staleTime: 60_000,
  })
}
