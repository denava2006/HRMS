import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

/**
 * The branch's own catalogue, filed under the enterprise taxonomy.
 *
 * Read-only, and there is no companion mutation hook here on purpose. Phase 3
 * made categories global: `pos_product_categories` carries a single
 * `is_admin()` policy, and `delete_pos_category` and `reorder_pos_category`
 * check `is_admin()` internally. The standalone POS gave managers
 * create/rename/archive/reorder plus a bulk product-move picker; none of that
 * is ported, and nothing here widens a policy.
 *
 * The counts arrive as a database aggregate rather than by letting managers
 * read `pos_product_categories` and `pos_branch_inventory` and tally in React,
 * which would have meant widening two RLS policies to render four numbers.
 */

export interface BranchCategorySummary {
  category_id: string
  name: string
  description: string | null
  color: string | null
  icon: string | null
  sort_order: number
  /** False for a retired category the branch still carries live products in.
   * The page labels those rather than mixing them in silently. */
  is_active: boolean
  /** Active enterprise products this branch carries. Draft and archived are
   * excluded -- they are not operational. */
  product_count: number
  offered_count: number
  low_stock_count: number
  out_of_stock_count: number
}

export const CATEGORY_SUMMARY_KEY = ['pos-categories', 'branch-summary'] as const

export function useBranchCategorySummary(branchId: string | undefined) {
  return useQuery({
    queryKey: [...CATEGORY_SUMMARY_KEY, branchId ?? 'none'],
    enabled: !!branchId,
    staleTime: 30_000,
    queryFn: async (): Promise<BranchCategorySummary[]> => {
      const { data, error } = await supabase.rpc('get_branch_category_summary', {
        _branch_id: branchId!,
      })
      if (error) throw error
      return (data ?? []) as unknown as BranchCategorySummary[]
    },
  })
}
