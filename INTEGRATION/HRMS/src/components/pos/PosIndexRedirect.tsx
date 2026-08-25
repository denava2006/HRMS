import { Navigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { hasAnyManagerAssignment } from '@/lib/portals'

/**
 * Where `/pos` sends someone.
 *
 * A cashier opens the app to sell, so they land on the till. A manager opens it
 * to see how the branch is doing, so they land on the dashboard.
 *
 * This is the single place that decision is made: `PORTALS.pos.path` is `/pos`
 * rather than a specific screen, so `defaultPortalPath()` does not have to know
 * anything about POS roles and there is no second copy of this test to drift.
 *
 * `hasAnyManagerAssignment` is the right question here precisely because it is
 * the one that is not branch-scoped -- "is there a manager dashboard worth
 * landing on at all". Every branch-sensitive decision after this point uses
 * `managerBranchIds` / `isPosManagerAt`, and the database re-decides per branch
 * regardless.
 */
export function PosIndexRedirect() {
  const { posAccess } = useAuth()
  return <Navigate to={hasAnyManagerAssignment(posAccess) ? 'dashboard' : 'till'} replace />
}
