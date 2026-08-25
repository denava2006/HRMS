import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import {
  RECENT_TRANSACTION_COUNT,
  TOP_PRODUCT_COUNT,
  emptySummary,
  type DashboardSummary,
  type PaymentTotal,
  type TopProduct,
} from '@/lib/posDashboard'
import type { TransactionRow } from '@/lib/posTransactions'

/**
 * The POS Manager's dashboard.
 *
 * Three aggregate RPCs plus one reuse. Each is gated in the database by
 * `has_pos_role(branch, ['manager'])` -- per branch, so an account that manages
 * Cavite and cashiers at Main Office gets Cavite and nothing else. None
 * declares a cost, COGS, margin or profit column.
 *
 * `branchId` is in every query key, so switching between managed branches
 * cannot briefly show the previous branch's numbers: a different key has no
 * cached entry and the card renders its loading state instead. `businessDate`
 * comes from the caller as a plain calendar date (or nothing, letting the
 * server decide "today" in business time) -- never a computed timestamp range.
 *
 * No realtime subscription. A short staleTime with refetch-on-focus, plus
 * invalidation after a checkout, is enough for a dashboard and avoids opening a
 * realtime authorization surface this project has never tested.
 */

export const DASHBOARD_KEY = ['pos-dashboard'] as const

const STALE_TIME = 30_000

/** The date argument every dashboard query shares: an explicit calendar date,
 * or undefined to let `pos_day_bounds()` resolve today in business time. */
type DayArg = { _branch_id: string; _on_date?: string }

function dayArgs(branchId: string, businessDate?: string): DayArg {
  return businessDate ? { _branch_id: branchId, _on_date: businessDate } : { _branch_id: branchId }
}

function dayKey(businessDate?: string) {
  return businessDate ?? 'today'
}

export interface BusinessDay {
  business_date: string
  day_start: string
  day_end: string
}

/**
 * What "today" means, decided by the database.
 *
 * The page needs the day's start instant for the recent-sales list and the
 * day's calendar date for its title, and neither may be computed from the
 * device clock: `startOfDay(new Date())` is exactly the bug that made the
 * standalone dashboard disagree with itself across timezones. `pos_day_bounds`
 * resolves both in `Asia/Manila`, and passing no date lets it decide today.
 */
export function useBusinessDay(onDate?: string) {
  return useQuery({
    queryKey: [...DASHBOARD_KEY, 'day', dayKey(onDate)],
    // A business day changes once a day; there is nothing to poll for.
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<BusinessDay | undefined> => {
      const { data, error } = await supabase.rpc(
        'pos_day_bounds',
        onDate ? { _on_date: onDate } : {}
      )
      if (error) throw error
      return (data ?? [])[0] as BusinessDay | undefined
    },
  })
}

export function useDashboardSummary(branchId: string | undefined, businessDate?: string) {
  return useQuery({
    queryKey: [...DASHBOARD_KEY, 'summary', branchId ?? 'none', dayKey(businessDate)],
    enabled: !!branchId,
    staleTime: STALE_TIME,
    queryFn: async (): Promise<DashboardSummary> => {
      const { data, error } = await supabase.rpc(
        'get_pos_dashboard_summary',
        dayArgs(branchId!, businessDate)
      )
      if (error) throw error
      // Zero rows means the database declined the branch. An authorised
      // manager on a quiet day gets one row of zeroes instead, which is a
      // different thing and looks different on screen.
      const row = (data ?? [])[0] as DashboardSummary | undefined
      return row ?? emptySummary(businessDate ?? '')
    },
  })
}

export function useDashboardPaymentTotals(branchId: string | undefined, businessDate?: string) {
  return useQuery({
    queryKey: [...DASHBOARD_KEY, 'payments', branchId ?? 'none', dayKey(businessDate)],
    enabled: !!branchId,
    staleTime: STALE_TIME,
    queryFn: async (): Promise<PaymentTotal[]> => {
      const { data, error } = await supabase.rpc(
        'get_pos_dashboard_payment_totals',
        dayArgs(branchId!, businessDate)
      )
      if (error) throw error
      return (data ?? []) as unknown as PaymentTotal[]
    },
  })
}

export function useDashboardTopProducts(branchId: string | undefined, businessDate?: string) {
  return useQuery({
    queryKey: [...DASHBOARD_KEY, 'top', branchId ?? 'none', dayKey(businessDate)],
    enabled: !!branchId,
    staleTime: STALE_TIME,
    queryFn: async (): Promise<TopProduct[]> => {
      const { data, error } = await supabase.rpc('get_pos_dashboard_top_products', {
        ...dayArgs(branchId!, businessDate),
        _limit: TOP_PRODUCT_COUNT,
      })
      if (error) throw error
      return (data ?? []) as unknown as TopProduct[]
    },
  })
}

/**
 * The dashboard's recent sales.
 *
 * This deliberately reuses Phase 6's `get_branch_transactions` rather than
 * adding a fourth authorization path for the sake of five rows. It is already
 * manager-gated per branch and already receipt-safe.
 *
 * Only `_from` is passed. `get_branch_transactions` takes an INCLUSIVE upper
 * bound while `pos_day_bounds` is half-open, and rather than reconcile two
 * conventions for a "most recent" list, the list is simply ordered
 * `created_at desc` and cut at five -- a sale later than now cannot exist.
 */
export function useDashboardRecentSales(branchId: string | undefined, dayStartISO?: string) {
  return useQuery({
    queryKey: [...DASHBOARD_KEY, 'recent', branchId ?? 'none', dayStartISO ?? 'today'],
    enabled: !!branchId && !!dayStartISO,
    staleTime: STALE_TIME,
    queryFn: async (): Promise<TransactionRow[]> => {
      const { data, error } = await supabase.rpc('get_branch_transactions', {
        _branch_id: branchId!,
        _from: dayStartISO!,
        _limit: RECENT_TRANSACTION_COUNT,
        _offset: 0,
      })
      if (error) throw error
      return (data ?? []) as unknown as TransactionRow[]
    },
  })
}
