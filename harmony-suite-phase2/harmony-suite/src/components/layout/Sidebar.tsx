import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  Briefcase,
  ClipboardList,
  CalendarSearch,
  Truck,
  Building2,
  Layers,
  DollarSign,
  Settings,
  ShieldCheck,
  CalendarClock,
  CalendarCheck,
  Wallet,
  FileBarChart,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'

interface NavItem {
  label: string
  to: string
  icon: React.ComponentType<{ className?: string }>
  disabled?: boolean
}

const mainNav: NavItem[] = [
  { label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard },
  { label: 'Job Posting', to: '/dashboard/job-postings', icon: Briefcase },
  { label: 'Recruitment', to: '/dashboard/recruitment', icon: ClipboardList },
  { label: 'Interview Management', to: '/dashboard/interviews', icon: CalendarSearch },
  { label: 'Deployment', to: '/dashboard/deployment', icon: Truck },
  { label: 'Employees', to: '/dashboard/employees', icon: Users },
  { label: 'Attendance', to: '/dashboard/attendance', icon: CalendarClock },
  { label: 'Leave', to: '/dashboard/leave', icon: CalendarCheck, disabled: true },
  { label: 'Payroll', to: '/dashboard/payroll', icon: Wallet, disabled: true },
  { label: 'Reports', to: '/dashboard/reports', icon: FileBarChart, disabled: true },
]

const adminNav: NavItem[] = [
  { label: 'HR Accounts', to: '/dashboard/admin/accounts', icon: ShieldCheck },
  { label: 'Departments', to: '/dashboard/admin/departments', icon: Building2 },
  { label: 'Positions', to: '/dashboard/admin/positions', icon: Layers },
  { label: 'Salary Grades', to: '/dashboard/admin/salary-grades', icon: DollarSign },
  { label: 'Work Schedules', to: '/dashboard/admin/work-schedules', icon: CalendarClock },
  { label: 'Holidays', to: '/dashboard/admin/holidays', icon: CalendarCheck },
  { label: 'Settings', to: '/dashboard/admin/settings', icon: Settings },
]

function NavRow({ item }: { item: NavItem }) {
  const Icon = item.icon
  if (item.disabled) {
    return (
      <div className="flex cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground/50">
        <Icon className="h-4 w-4" />
        {item.label}
        <span className="ml-auto rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium">Soon</span>
      </div>
    )
  }
  return (
    <NavLink
      to={item.to}
      end={item.to === '/dashboard'}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
          isActive ? 'bg-primary text-primary-foreground shadow-sm' : 'text-foreground hover:bg-muted'
        )
      }
    >
      <Icon className="h-4 w-4" />
      {item.label}
    </NavLink>
  )
}

export function Sidebar() {
  const { profile } = useAuth()
  // Employee logins have no internal HR back-office access yet (see
  // DashboardHome's EmployeePortalPlaceholder) — every other route redirects
  // them straight back to /dashboard, so there's nothing for these links to do.
  const visibleMainNav = profile?.role === 'employee' ? mainNav.filter((item) => item.to === '/dashboard') : mainNav

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-card md:flex print:hidden">
      <div className="flex h-16 items-center gap-2 border-b border-border px-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary font-display text-sm font-bold text-primary-foreground">
          H
        </div>
        <span className="font-display text-lg font-semibold text-foreground">Harmony Suite</span>
      </div>

      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
        {visibleMainNav.map((item) => (
          <NavRow key={item.to} item={item} />
        ))}

        {profile?.role === 'admin' && (
          <>
            <p className="mb-1 mt-5 px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Administration
            </p>
            {adminNav.map((item) => (
              <NavRow key={item.to} item={item} />
            ))}
          </>
        )}
      </nav>
    </aside>
  )
}
