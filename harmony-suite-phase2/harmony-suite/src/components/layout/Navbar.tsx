import { LogOut, User } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { CalendarWidget } from '@/components/layout/CalendarWidget'
import { ClockWidget } from '@/components/layout/ClockWidget'
import { useMyEmployeeRecord } from '@/hooks/useEmployeePortal'

const ROLE_LABEL: Record<string, string> = {
  admin: 'Administrator',
  hr_staff: 'HR Staff',
}

function initials(name: string) {
  return name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export function Navbar({ title }: { title: string }) {
  const { profile, signOut } = useAuth()
  const { data: myEmployee } = useMyEmployeeRecord()
  const isEmployee = profile?.role === 'employee'

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-card px-6 print:hidden">
      <h1 className="font-display text-lg font-semibold text-foreground">{title}</h1>

      <div className="flex items-center gap-3">
        <CalendarWidget />
        <ClockWidget />
        <div className="h-8 w-px bg-border" />

        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2.5 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
            <div className="hidden text-right leading-tight sm:block">
              <p className="text-sm font-medium text-foreground">{profile?.full_name}</p>
              <p className="text-xs text-muted-foreground">
                {isEmployee && myEmployee
                  ? [myEmployee.positions?.title, myEmployee.departments?.name].filter(Boolean).join(' · ')
                  : profile
                    ? ROLE_LABEL[profile.role]
                    : ''}
              </p>
            </div>
            <Avatar>
              <AvatarFallback>{profile ? initials(profile.full_name) : <User className="h-4 w-4" />}</AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>{profile?.email}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem destructive onClick={() => void signOut()}>
              <LogOut className="h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
