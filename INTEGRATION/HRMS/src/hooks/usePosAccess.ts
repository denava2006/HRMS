import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { toast } from '@/components/ui/sonner'
import { useAuth } from '@/contexts/AuthContext'
import type { PosRole, UserRole } from '@/lib/enums'
import { describeAssignmentError, type AssignmentStatus, type ProfileOption } from '@/lib/posAccess'

/**
 * POS access administration.
 *
 * Every call here goes through the anon key with RLS doing the enforcement --
 * pos_branch_assignments_admin_manage is `is_admin()` on both USING and WITH
 * CHECK, so a non-Administrator's insert is refused by Postgres and their
 * update simply matches no rows. No edge function and no service-role key: this
 * screen creates no auth users, unlike HR Accounts.
 */

export interface PosAssignment {
  id: string
  profile_id: string
  branch_id: string
  pos_role: PosRole
  status: AssignmentStatus
  created_by: string | null
  created_at: string
  updated_at: string
  profile: { id: string; full_name: string; email: string; role: UserRole; status: AssignmentStatus } | null
  branch: { id: string; name: string } | null
  granted_by: { full_name: string } | null
}

const ASSIGNMENTS_KEY = ['pos-branch-assignments']
const ASSIGNABLE_KEY = ['pos-assignable-profiles']

// Two of these columns point at `profiles`, so the embed has to name the
// constraint rather than the table -- PostgREST cannot guess which one.
const ASSIGNMENT_SELECT = `
  id, profile_id, branch_id, pos_role, status, created_by, created_at, updated_at,
  profile:profiles!pos_branch_assignments_profile_id_fkey(id, full_name, email, role, status),
  branch:branches!pos_branch_assignments_branch_id_fkey(id, name),
  granted_by:profiles!pos_branch_assignments_created_by_fkey(full_name)
`

/**
 * Every assignment, revoked ones included.
 *
 * History is deliberately not filtered out here: revoking sets status to
 * 'inactive' instead of deleting, and the screen's whole point is that the
 * trail survives. Filtering is the reader's choice, applied in the component.
 */
export function usePosAssignments() {
  return useQuery({
    queryKey: ASSIGNMENTS_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pos_branch_assignments')
        .select(ASSIGNMENT_SELECT)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as unknown as PosAssignment[]
    },
  })
}

/**
 * Who may be granted POS access.
 *
 * Administrators and inactive accounts are excluded in the query as well as in
 * assignableProfiles() -- the helper is what the tests pin, this keeps the
 * rows off the wire in the first place.
 */
export function useAssignableProfiles() {
  return useQuery({
    queryKey: ASSIGNABLE_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, role, status')
        .eq('status', 'active')
        .neq('role', 'admin')
        .order('full_name')
      if (error) throw error
      return data as unknown as ProfileOption[]
    },
  })
}

function useInvalidateAssignments() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: ASSIGNMENTS_KEY })
}

export interface GrantPosAccessInput {
  profileId: string
  branchId: string
  posRole: PosRole
}

/**
 * Grant, and re-grant, both insert a new row.
 *
 * Re-granting deliberately does not flip a revoked row back to active: that
 * would overwrite the only record that the access was ever taken away. A second
 * row costs nothing and keeps the sequence readable -- which is what the
 * partial unique index (active rows only) was written to allow.
 */
export function useGrantPosAccess() {
  const invalidate = useInvalidateAssignments()
  const { profile } = useAuth()
  return useMutation({
    mutationFn: async ({ profileId, branchId, posRole }: GrantPosAccessInput) => {
      const { data, error } = await supabase
        .from('pos_branch_assignments')
        .insert({
          profile_id: profileId,
          branch_id: branchId,
          pos_role: posRole,
          // Redundant since 20260825010000: a BEFORE INSERT trigger stamps
          // created_by with auth.uid() and ignores whatever is sent. Kept so
          // the payload still says what it means, but the database is the
          // authority on who granted the access, not this line.
          created_by: profile?.id ?? null,
        })
        .select('id')
        .single()
      if (error) throw new Error(describeAssignmentError(error))

      // No audit write here. Phase 7C moved it into the database: an AFTER
      // INSERT trigger writes an assignment_granted event atomically with the
      // row, deriving the actor from auth.uid(). A browser insert could name
      // any actor_id it liked and could succeed or fail independently of the
      // grant it claims to describe.
      return data
    },
    onSuccess: () => {
      invalidate()
      toast.success('POS access granted')
    },
    onError: (error) => toast.error(error.message),
  })
}

/**
 * Revoking never deletes. The `status = 'active'` filter makes a double-click
 * a no-op instead of stamping updated_at on an already-revoked row.
 */
export function useRevokePosAccess() {
  const invalidate = useInvalidateAssignments()
  return useMutation({
    mutationFn: async (assignment: PosAssignment) => {
      const { error } = await supabase
        .from('pos_branch_assignments')
        .update({ status: 'inactive' })
        .eq('id', assignment.id)
        .eq('status', 'active')
      if (error) throw new Error(describeAssignmentError(error))
      // See useGrantPosAccess: the assignment_revoked event is written by the
      // database, on the active -> inactive transition only.
    },
    onSuccess: () => {
      invalidate()
      toast.success('POS access revoked')
    },
    onError: (error) => toast.error(error.message),
  })
}
