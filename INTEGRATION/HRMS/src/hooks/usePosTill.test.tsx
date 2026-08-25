import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const rpc = vi.fn()

vi.mock('@/lib/supabase', () => ({
  supabase: { rpc },
}))

const { useCheckout } = await import('@/hooks/usePosTill')

afterEach(() => {
  cleanup()
  rpc.mockReset()
})

describe('checkout cache invalidation', () => {
  it('refreshes every sale-dependent POS surface after a successful checkout', async () => {
    rpc.mockResolvedValue({ data: { sale_id: 'sale-1' }, error: null })

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })
    const invalidate = vi
      .spyOn(queryClient, 'invalidateQueries')
      .mockResolvedValue(undefined)

    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
    const { result } = renderHook(() => useCheckout(), { wrapper })

    await act(async () => {
      await result.current.mutateAsync({
        branchId: 'branch-a',
        items: [{ product_id: 'product-a', quantity: 1 }],
        method: 'cash',
        checkoutKey: 'checkout-a',
        tendered: 100,
      })
    })

    const roots = invalidate.mock.calls.map(([filters]) => filters?.queryKey?.[0])
    expect(roots).toEqual([
      'pos-catalogue',
      'pos-branch-inventory',
      'pos-inventory-movements',
      'pos-dashboard',
      'pos-transactions',
      'pos-reports',
    ])
  })
})
