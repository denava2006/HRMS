import { Navigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { hasAnyManagerAssignment } from '@/lib/portals'

/**
 * Keeps Manager-only POS screens out of a Cashier's route surface.
 *
 * This is navigation-level enforcement. Every branch report RPC still checks
 * the caller's active Manager assignment for the requested branch, so a mixed
 * Manager/Cashier account cannot carry Manager authority to its Cashier branch.
 */
export function PosManagerRoute({ children }: { children: React.ReactNode }) {
  const { posAccess } = useAuth()

  if (!hasAnyManagerAssignment(posAccess)) {
    return <Navigate to="/pos/till" replace />
  }

  return <>{children}</>
}
