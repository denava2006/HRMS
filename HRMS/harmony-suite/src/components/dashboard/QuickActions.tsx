import { useNavigate } from 'react-router-dom'
import { Briefcase, UserPlus, ShieldPlus, Wallet, FileBarChart, ClipboardList, CalendarSearch, Truck, CalendarClock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'
import { canAccessModule } from '@/lib/roles'

interface QuickAction {
  label: string
  to: string
  icon: React.ComponentType<{ className?: string }>
}

const ADMIN_ACTIONS: QuickAction[] = [
  { label: 'Create Job Posting', to: '/dashboard/job-postings', icon: Briefcase },
  { label: 'Create Employee', to: '/dashboard/employees/new', icon: UserPlus },
  { label: 'Add HR Account', to: '/dashboard/admin/accounts', icon: ShieldPlus },
  { label: 'Generate Payroll', to: '/dashboard/payroll', icon: Wallet },
  { label: 'Generate Report', to: '/dashboard/reports/new', icon: FileBarChart },
]

const HR_ACTIONS: QuickAction[] = [
  { label: 'Create Job Posting', to: '/dashboard/job-postings', icon: Briefcase },
  { label: 'Recruitment', to: '/dashboard/recruitment', icon: ClipboardList },
  { label: 'Interview Management', to: '/dashboard/interviews', icon: CalendarSearch },
  { label: 'Deployment', to: '/dashboard/deployment', icon: Truck },
  { label: 'Attendance', to: '/dashboard/attendance', icon: CalendarClock },
  { label: 'Reports', to: '/dashboard/reports', icon: FileBarChart },
]

export function QuickActions({ isAdmin }: { isAdmin: boolean }) {
  const navigate = useNavigate()
  const { profile } = useAuth()
  // Shortcuts to a module the role can't open would just bounce off the route
  // guard, so they're dropped along with the sidebar entry.
  const actions = (isAdmin ? ADMIN_ACTIONS : HR_ACTIONS).filter((a) => canAccessModule(profile?.role, a.to))

  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((action) => (
        <Button key={action.label} variant="outline" size="sm" onClick={() => navigate(action.to)}>
          <action.icon className="h-4 w-4" />
          {action.label}
        </Button>
      ))}
    </div>
  )
}
