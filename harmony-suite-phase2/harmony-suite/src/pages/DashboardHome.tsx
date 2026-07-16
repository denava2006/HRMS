import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Users, UserCheck, Building2, Layers, Briefcase, Clock } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

function useDashboardCounts() {
  return useQuery({
    queryKey: ['dashboard-counts'],
    queryFn: async () => {
      const [employees, activeEmployees, departments, positions] = await Promise.all([
        supabase.from('employees').select('*', { count: 'exact', head: true }),
        supabase.from('employees').select('*', { count: 'exact', head: true }).eq('employment_status', 'active'),
        supabase.from('departments').select('*', { count: 'exact', head: true }),
        supabase.from('positions').select('*', { count: 'exact', head: true }),
      ])
      return {
        employees: employees.count ?? 0,
        activeEmployees: activeEmployees.count ?? 0,
        departments: departments.count ?? 0,
        positions: positions.count ?? 0,
      }
    },
  })
}

function StatCard({
  label,
  value,
  icon: Icon,
  isLoading,
  index,
}: {
  label: string
  value: number
  icon: React.ComponentType<{ className?: string }>
  isLoading: boolean
  index: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
    >
      <Card>
        <CardContent className="flex items-center gap-4 p-5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            {isLoading ? (
              <Skeleton className="mt-1 h-7 w-12" />
            ) : (
              <p className="font-display text-2xl font-bold text-foreground">{value}</p>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

function ComingSoonCard({ label, icon: Icon, phase }: { label: string; icon: React.ComponentType<{ className?: string }>; phase: string }) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex items-center gap-4 p-5">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-sm font-medium text-muted-foreground/70">{phase}</p>
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
  const { data, isLoading } = useDashboardCounts()

  if (profile?.role === 'employee') {
    return <EmployeePortalPlaceholder />
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-display text-xl font-semibold text-foreground">
          Welcome back, {profile?.full_name?.split(' ')[0]}.
        </h2>
        <p className="text-sm text-muted-foreground">Here's the current state of your organization.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Employees" value={data?.employees ?? 0} icon={Users} isLoading={isLoading} index={0} />
        <StatCard label="Active Employees" value={data?.activeEmployees ?? 0} icon={UserCheck} isLoading={isLoading} index={1} />
        <StatCard label="Departments" value={data?.departments ?? 0} icon={Building2} isLoading={isLoading} index={2} />
        <StatCard label="Positions" value={data?.positions ?? 0} icon={Layers} isLoading={isLoading} index={3} />
      </div>

      <div>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">On the way</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <ComingSoonCard label="New Applicants" icon={Briefcase} phase="Phase 3 \u2014 Recruitment" />
        </div>
      </div>
    </div>
  )
}
