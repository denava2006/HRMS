import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { PosReportRange } from '@/lib/posReports'

const rpc = vi.fn()
const from = vi.fn()

vi.mock('@/lib/supabase', () => ({
  supabase: { rpc, from },
}))

const {
  useAdminPosBranchComparison,
  useAdminPosReportSummary,
  useAdminPosReportTrend,
  usePosManagerReportPaymentTotals,
  usePosManagerReportSummary,
  usePosManagerReportTopProducts,
  usePosManagerReportTrend,
  usePosReportPresets,
} = await import('@/hooks/usePosReports')

afterEach(() => {
  cleanup()
  rpc.mockReset()
  from.mockReset()
})

describe('POS report hooks', () => {
  it('use RPCs only and pass database calendar strings through unchanged', async () => {
    const range: PosReportRange = {
      dateFrom: '1999-02-03',
      dateTo: '1999-02-09',
      kind: 'last_7_days',
    }
    expect(new Date().toISOString().slice(0, 10)).not.toBe(range.dateTo)

    rpc.mockImplementation(async (name: string) => ({
      data: name.includes('summary') ? [{}] : [],
      error: null,
    }))

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )

    renderHook(
      () => ({
        presets: usePosReportPresets(),
        managerSummary: usePosManagerReportSummary('manager-branch', range),
        managerTrend: usePosManagerReportTrend('manager-branch', range),
        managerPayments: usePosManagerReportPaymentTotals('manager-branch', range),
        managerTopProducts: usePosManagerReportTopProducts('manager-branch', range),
        adminSummary: useAdminPosReportSummary('admin-branch', range),
        adminTrend: useAdminPosReportTrend('admin-branch', range),
        adminComparison: useAdminPosBranchComparison(range),
      }),
      { wrapper }
    )

    await waitFor(() => expect(rpc).toHaveBeenCalledTimes(8))

    expect(rpc.mock.calls).toEqual(
      expect.arrayContaining([
        ['get_pos_report_presets'],
        [
          'get_pos_manager_report_summary',
          {
            _branch_id: 'manager-branch',
            _from_date: '1999-02-03',
            _to_date: '1999-02-09',
          },
        ],
        [
          'get_pos_manager_report_trend',
          {
            _branch_id: 'manager-branch',
            _from_date: '1999-02-03',
            _to_date: '1999-02-09',
          },
        ],
        [
          'get_pos_manager_report_payment_totals',
          {
            _branch_id: 'manager-branch',
            _from_date: '1999-02-03',
            _to_date: '1999-02-09',
          },
        ],
        [
          'get_pos_manager_report_top_products',
          {
            _branch_id: 'manager-branch',
            _from_date: '1999-02-03',
            _to_date: '1999-02-09',
            _limit: 10,
          },
        ],
        [
          'get_admin_pos_report_summary',
          {
            _branch_id: 'admin-branch',
            _from_date: '1999-02-03',
            _to_date: '1999-02-09',
          },
        ],
        [
          'get_admin_pos_report_trend',
          {
            _branch_id: 'admin-branch',
            _from_date: '1999-02-03',
            _to_date: '1999-02-09',
          },
        ],
        [
          'get_admin_pos_report_branch_comparison',
          { _from_date: '1999-02-03', _to_date: '1999-02-09' },
        ],
      ])
    )
    expect(from).not.toHaveBeenCalled()

    queryClient.clear()
  })
})
