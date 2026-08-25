import * as React from 'react'
import { useSearchParams } from 'react-router-dom'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAuth } from '@/contexts/AuthContext'
import { useBranches } from '@/hooks/useBranches'
import { managerBranchIds } from '@/lib/portals'

/**
 * Which branch a manager screen is looking at.
 *
 * The list is `managerBranchIds` and nothing else. An account that manages
 * Cavite and works a till at Main Office must not find Main Office here: at
 * Main Office they are a cashier, and a cashier has no branch-wide view of
 * anything. The database says the same independently -- every dashboard and
 * category RPC checks `has_pos_role(branch, ['manager'])` -- so this is about
 * not offering a door that would not open.
 *
 * The choice lives in `?branch=` so a manager can bookmark or share the branch
 * they were looking at, and so the back button behaves. An id in the URL that
 * the account does not manage is ignored rather than honoured.
 */
export function useManagerBranch() {
  const { posAccess } = useAuth()
  const { data: branches, isLoading } = useBranches()
  const [params, setParams] = useSearchParams()

  const managed = React.useMemo(() => {
    const ids = new Set(managerBranchIds(posAccess))
    // useBranches orders by name, so "the first one" is a stable answer rather
    // than whichever assignment happened to be created first.
    return (branches ?? []).filter((b) => b.is_active && ids.has(b.id))
  }, [branches, posAccess])

  const requested = params.get('branch')
  const branchId = React.useMemo(() => {
    if (requested && managed.some((b) => b.id === requested)) return requested
    return managed[0]?.id ?? ''
  }, [requested, managed])

  const setBranchId = React.useCallback(
    (id: string) => {
      const next = new URLSearchParams(params)
      next.set('branch', id)
      // replace, not push: flipping between branches is not a history trail
      // anyone wants to walk back through.
      setParams(next, { replace: true })
    },
    [params, setParams]
  )

  return { branchId, setBranchId, managed, isLoading }
}

export function ManagerBranchPicker({
  branchId,
  onChange,
  branches,
}: {
  branchId: string
  onChange: (id: string) => void
  branches: { id: string; name: string }[]
}) {
  // One branch needs no choosing, and a select with a single option is just
  // furniture.
  if (branches.length < 2) return null

  return (
    <Select value={branchId} onValueChange={onChange}>
      <SelectTrigger className="w-52" aria-label="Branch">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {branches.map((branch) => (
          <SelectItem key={branch.id} value={branch.id}>
            {branch.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
