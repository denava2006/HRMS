import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import type { UserRole } from '@/lib/database.types'
import { needsPasswordSetup } from '@/lib/passwordSetup'

interface ProtectedRouteProps {
  children: React.ReactNode
  /** Omit to allow any authenticated, active user regardless of role. */
  allowedRoles?: UserRole[]
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { session, profile, initializing } = useAuth()
  const location = useLocation()

  if (initializing) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <div
          className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-secondary"
          role="status"
          aria-label="Loading"
        />
      </div>
    )
  }

  if (!session || !profile) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // An employee still on the password HR handed them has to choose their own
  // before going anywhere. activated_at is null from account creation until the
  // password actually changes, and HR resetting it puts them back here.
  if (needsPasswordSetup(profile)) {
    return <Navigate to="/auth/setup-password" replace />
  }

  if (allowedRoles && !allowedRoles.includes(profile.role)) {
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}
