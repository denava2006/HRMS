import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Receipt } from '@/hooks/usePosTill'
import {
  PAGE_SIZE,
  offsetFor,
  toTimestampRange,
  type DateRange,
  type TransactionRow,
  type TransactionScope,
} from '@/lib/posTransactions'

/**
 * Transaction history.
 *
 * Three read paths, chosen by what the screen is for, each authorised
 * independently by the database:
 *
 *   mine    get_my_transactions      -- takes no cashier argument at all, so
 *                                       "show me someone else's" cannot be
 *                                       expressed, let alone granted
 *   branch  get_branch_transactions  -- manager at THAT branch
 *   admin   get_admin_transactions   -- is_admin()
 *
 * None of them returns cost: the columns are absent from the function
 * signatures, not filtered out here. The sale tables themselves stay
 * Administrator-only and are never queried from these screens.
 */

export interface TransactionQuery {
  scope: TransactionScope
  branchId?: string
  range: DateRange
  page: number
}

export function usePosTransactions(query: TransactionQuery, enabled = true) {
  const { scope, branchId, range, page } = query
  const { from, to } = toTimestampRange(range)
  const offset = offsetFor(page)

  return useQuery({
    queryKey: ['pos-transactions', scope, branchId ?? 'all', from, to, page],
    // A branch scope with no branch would ask the database for everything at
    // "null", which it would refuse -- better not to ask.
    enabled: enabled && (scope !== 'branch' || !!branchId),
    queryFn: async (): Promise<TransactionRow[]> => {
      if (scope === 'mine') {
        const { data, error } = await supabase.rpc('get_my_transactions', {
          _from: from ?? undefined,
          _to: to ?? undefined,
          _limit: PAGE_SIZE,
          _offset: offset,
        })
        if (error) throw error
        return (data ?? []) as unknown as TransactionRow[]
      }

      if (scope === 'branch') {
        const { data, error } = await supabase.rpc('get_branch_transactions', {
          _branch_id: branchId!,
          _from: from ?? undefined,
          _to: to ?? undefined,
          _limit: PAGE_SIZE,
          _offset: offset,
        })
        if (error) throw error
        return (data ?? []) as unknown as TransactionRow[]
      }

      const { data, error } = await supabase.rpc('get_admin_transactions', {
        _branch_id: branchId ?? undefined,
        _from: from ?? undefined,
        _to: to ?? undefined,
        _limit: PAGE_SIZE,
        _offset: offset,
      })
      if (error) throw error
      return (data ?? []) as unknown as TransactionRow[]
    },
  })
}

/**
 * One receipt, by id.
 *
 * `get_sale_detail` authorises the caller before it returns anything -- own
 * sale, manager at that sale's branch, or Administrator. Knowing a uuid is
 * never enough, and the Phase 5 helper it wraps is not callable by any signed-in
 * account.
 */
export function useSaleDetail(saleId: string | null) {
  return useQuery({
    queryKey: ['pos-sale-detail', saleId ?? 'none'],
    enabled: !!saleId,
    queryFn: async (): Promise<Receipt> => {
      const { data, error } = await supabase.rpc('get_sale_detail', { _sale_id: saleId! })
      if (error) throw error
      if (!data) throw new Error('That receipt is not available.')
      return data as unknown as Receipt
    },
  })
}
