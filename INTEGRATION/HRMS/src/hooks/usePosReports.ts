import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import {
  POS_REPORTS_KEY,
  POS_REPORT_TOP_PRODUCT_LIMIT,
  isPosReportRangeReady,
  type AdminPosBranchComparison,
  type AdminPosReportSummary,
  type AdminPosReportTrend,
  type PosManagerReportSummary,
  type PosManagerReportTrend,
  type PosReportPaymentTotal,
  type PosReportPreset,
  type PosReportRange,
  type PosReportTopProduct,
} from '@/lib/posReports'

const REPORT_STALE_TIME = 30_000

function rangeKey(range: PosReportRange | undefined) {
  return [range?.dateFrom ?? 'pending', range?.dateTo ?? 'pending'] as const
}

function rangeArgs(range: PosReportRange) {
  return { _from_date: range.dateFrom, _to_date: range.dateTo }
}

export function usePosReportPresets() {
  return useQuery({
    queryKey: [...POS_REPORTS_KEY, 'presets'],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<PosReportPreset[]> => {
      const { data, error } = await supabase.rpc('get_pos_report_presets')
      if (error) throw error
      return (data ?? []) as PosReportPreset[]
    },
  })
}

export function usePosManagerReportSummary(
  branchId: string | undefined,
  range: PosReportRange | undefined
) {
  return useQuery({
    queryKey: [...POS_REPORTS_KEY, 'manager', branchId ?? 'none', ...rangeKey(range), 'summary'],
    enabled: !!branchId && isPosReportRangeReady(range),
    staleTime: REPORT_STALE_TIME,
    queryFn: async (): Promise<PosManagerReportSummary | undefined> => {
      const { data, error } = await supabase.rpc('get_pos_manager_report_summary', {
        _branch_id: branchId!,
        ...rangeArgs(range!),
      })
      if (error) throw error
      return (data ?? [])[0] as unknown as PosManagerReportSummary | undefined
    },
  })
}

export function usePosManagerReportTrend(
  branchId: string | undefined,
  range: PosReportRange | undefined
) {
  return useQuery({
    queryKey: [...POS_REPORTS_KEY, 'manager', branchId ?? 'none', ...rangeKey(range), 'trend'],
    enabled: !!branchId && isPosReportRangeReady(range),
    staleTime: REPORT_STALE_TIME,
    queryFn: async (): Promise<PosManagerReportTrend[]> => {
      const { data, error } = await supabase.rpc('get_pos_manager_report_trend', {
        _branch_id: branchId!,
        ...rangeArgs(range!),
      })
      if (error) throw error
      return (data ?? []) as unknown as PosManagerReportTrend[]
    },
  })
}

export function usePosManagerReportPaymentTotals(
  branchId: string | undefined,
  range: PosReportRange | undefined
) {
  return useQuery({
    queryKey: [...POS_REPORTS_KEY, 'manager', branchId ?? 'none', ...rangeKey(range), 'payments'],
    enabled: !!branchId && isPosReportRangeReady(range),
    staleTime: REPORT_STALE_TIME,
    queryFn: async (): Promise<PosReportPaymentTotal[]> => {
      const { data, error } = await supabase.rpc('get_pos_manager_report_payment_totals', {
        _branch_id: branchId!,
        ...rangeArgs(range!),
      })
      if (error) throw error
      return (data ?? []) as unknown as PosReportPaymentTotal[]
    },
  })
}

export function usePosManagerReportTopProducts(
  branchId: string | undefined,
  range: PosReportRange | undefined
) {
  return useQuery({
    queryKey: [...POS_REPORTS_KEY, 'manager', branchId ?? 'none', ...rangeKey(range), 'top-products'],
    enabled: !!branchId && isPosReportRangeReady(range),
    staleTime: REPORT_STALE_TIME,
    queryFn: async (): Promise<PosReportTopProduct[]> => {
      const { data, error } = await supabase.rpc('get_pos_manager_report_top_products', {
        _branch_id: branchId!,
        ...rangeArgs(range!),
        _limit: POS_REPORT_TOP_PRODUCT_LIMIT,
      })
      if (error) throw error
      return (data ?? []) as unknown as PosReportTopProduct[]
    },
  })
}

export function useAdminPosReportSummary(
  branchId: string | undefined,
  range: PosReportRange | undefined
) {
  return useQuery({
    queryKey: [...POS_REPORTS_KEY, 'admin', branchId ?? 'all', ...rangeKey(range), 'summary'],
    enabled: isPosReportRangeReady(range),
    staleTime: REPORT_STALE_TIME,
    queryFn: async (): Promise<AdminPosReportSummary | undefined> => {
      const { data, error } = await supabase.rpc('get_admin_pos_report_summary', {
        ...rangeArgs(range!),
        ...(branchId ? { _branch_id: branchId } : {}),
      })
      if (error) throw error
      return (data ?? [])[0] as unknown as AdminPosReportSummary | undefined
    },
  })
}

export function useAdminPosReportTrend(
  branchId: string | undefined,
  range: PosReportRange | undefined
) {
  return useQuery({
    queryKey: [...POS_REPORTS_KEY, 'admin', branchId ?? 'all', ...rangeKey(range), 'trend'],
    enabled: isPosReportRangeReady(range),
    staleTime: REPORT_STALE_TIME,
    queryFn: async (): Promise<AdminPosReportTrend[]> => {
      const { data, error } = await supabase.rpc('get_admin_pos_report_trend', {
        ...rangeArgs(range!),
        ...(branchId ? { _branch_id: branchId } : {}),
      })
      if (error) throw error
      return (data ?? []) as unknown as AdminPosReportTrend[]
    },
  })
}

export function useAdminPosBranchComparison(range: PosReportRange | undefined) {
  return useQuery({
    queryKey: [...POS_REPORTS_KEY, 'admin', 'all', ...rangeKey(range), 'branch-comparison'],
    enabled: isPosReportRangeReady(range),
    staleTime: REPORT_STALE_TIME,
    queryFn: async (): Promise<AdminPosBranchComparison[]> => {
      const { data, error } = await supabase.rpc(
        'get_admin_pos_report_branch_comparison',
        rangeArgs(range!)
      )
      if (error) throw error
      return (data ?? []) as unknown as AdminPosBranchComparison[]
    },
  })
}
