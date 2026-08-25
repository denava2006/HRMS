import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { UserRole } from '@/lib/enums'
import type { Branch } from '@/hooks/useBranches'
import type { CatalogueRow } from '@/hooks/usePosCatalogue'
import type { Receipt } from '@/hooks/usePosTill'
import type { Fee } from '@/lib/posFees'

/**
 * The till.
 *
 * Two things matter more than the rest: what the till sends (only safe inputs,
 * never a price), and that it never shows a cost. The database contract test
 * proves the RPC; this proves the screen in front of the cashier.
 */

const BRANCH_A = 'b1'

const branches: Branch[] = [
  { id: BRANCH_A, name: 'Cavite Branch', address: null, phone: null, is_active: true, created_at: '', updated_at: '' },
]

const state: {
  role: UserRole
  branchIds: string[]
  catalogue: CatalogueRow[]
  fees: Fee[]
} = { role: 'employee', branchIds: [BRANCH_A], catalogue: [], fees: [] }

const checkoutMutate = vi.fn()
let lastCheckoutArgs: unknown = null

function row(overrides: Partial<CatalogueRow> = {}): CatalogueRow {
  return {
    product_id: 'p1',
    name: 'Cola 1.5L',
    category_id: 'c1',
    category_name: 'Drinks',
    selling_price: 100,
    image_path: null,
    available_quantity: 10,
    is_low_stock: false,
    ...overrides,
  }
}

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    profile: { id: 'u1', role: state.role },
    posAccess: { hasAccess: true, branchIds: state.branchIds },
  }),
}))

vi.mock('@/hooks/useBranches', () => ({
  useBranches: () => ({ data: branches, isLoading: false }),
}))

vi.mock('@/hooks/usePosCatalogue', () => ({
  usePosCatalogue: () => ({ data: state.catalogue, isLoading: false }),
  useProductImageUrls: () => ({ data: {}, isLoading: false }),
}))

vi.mock('@/hooks/usePosTill', () => ({
  useBranchFees: () => ({ data: state.fees, isLoading: false }),
  useCheckout: () => ({
    mutate: (args: unknown) => {
      lastCheckoutArgs = args
      checkoutMutate(args)
    },
    isPending: false,
    isError: false,
    error: null,
  }),
}))

const { default: PosTillPage } = await import('@/pages/pos/PosTillPage')

const addProduct = (name: string) => fireEvent.click(screen.getByRole('button', { name: `Add ${name}` }))

afterEach(() => {
  cleanup()
  state.role = 'employee'
  state.branchIds = [BRANCH_A]
  state.catalogue = []
  state.fees = []
  checkoutMutate.mockReset()
  lastCheckoutArgs = null
})

describe('the product grid', () => {
  it('shows price and remaining stock', () => {
    state.catalogue = [row()]
    render(<PosTillPage />)

    expect(screen.getByText('Cola 1.5L')).toBeTruthy()
    expect(screen.getByText('₱100.00')).toBeTruthy()
    expect(screen.getByText('10')).toBeTruthy()
  })

  it('marks a low or sold-out product and refuses to add a sold-out one', () => {
    state.catalogue = [
      row({ product_id: 'p1', name: 'Low One', available_quantity: 2, is_low_stock: true }),
      row({ product_id: 'p2', name: 'Sold Out', available_quantity: 0, is_low_stock: true }),
    ]
    render(<PosTillPage />)

    expect(screen.getByText('2 left')).toBeTruthy()
    expect(screen.getByText('Out')).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Add Sold Out' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('shows no cost anywhere', () => {
    state.catalogue = [row()]
    const { container } = render(<PosTillPage />)
    const text = container.textContent ?? ''
    expect(text).not.toMatch(/cost/i)
    expect(text).not.toMatch(/margin/i)
    expect(text).not.toMatch(/COGS/i)
    expect(text).not.toMatch(/profit/i)
  })
})

describe('the cart', () => {
  it('merges a repeat tap into one line', () => {
    state.catalogue = [row()]
    render(<PosTillPage />)
    addProduct('Cola 1.5L')
    addProduct('Cola 1.5L')
    addProduct('Cola 1.5L')

    expect(screen.getByText('Subtotal (3 items)')).toBeTruthy()
    // 300 shows on the cart line, the subtotal, the total and the pay button.
    expect(screen.getAllByText(/₱300\.00/).length).toBeGreaterThan(1)
    expect(screen.getByRole('button', { name: /Take payment · ₱300\.00/ })).toBeTruthy()
  })

  it('will not add more than the branch holds', () => {
    state.catalogue = [row({ available_quantity: 2 })]
    render(<PosTillPage />)
    addProduct('Cola 1.5L')
    addProduct('Cola 1.5L')

    expect((screen.getByRole('button', { name: 'Add Cola 1.5L' }) as HTMLButtonElement).disabled).toBe(true)
    expect(
      (screen.getByRole('button', { name: 'One more Cola 1.5L' }) as HTMLButtonElement).disabled
    ).toBe(true)
  })

  it('removes a line at zero', () => {
    state.catalogue = [row()]
    render(<PosTillPage />)
    addProduct('Cola 1.5L')
    fireEvent.click(screen.getByRole('button', { name: 'One less Cola 1.5L' }))
    expect(screen.getByText(/Tap a product to start a sale/)).toBeTruthy()
  })
})

describe('totals', () => {
  it('applies the branch fee and shows the change', () => {
    state.catalogue = [row()]
    state.fees = [{ id: 'f1', name: 'Service Charge', type: 'percent', value: 10, enabled: true }]
    render(<PosTillPage />)
    addProduct('Cola 1.5L')
    fireEvent.change(screen.getByLabelText('Cash received'), { target: { value: '200' } })

    expect(screen.getByText('₱10.00')).toBeTruthy()      // the fee
    expect(screen.getByText('₱110.00')).toBeTruthy()     // the total
    expect(screen.getByText('₱90.00')).toBeTruthy()      // the change
  })

  it('says the server confirms the numbers', () => {
    render(<PosTillPage />)
    expect(screen.getByText(/confirmed by the server when you take payment/)).toBeTruthy()
  })
})

describe('what the till sends', () => {
  it('sends only branch, items, method, key and payment — never a price', () => {
    state.catalogue = [row()]
    render(<PosTillPage />)
    addProduct('Cola 1.5L')
    addProduct('Cola 1.5L')
    fireEvent.change(screen.getByLabelText('Cash received'), { target: { value: '500' } })
    fireEvent.click(screen.getByRole('button', { name: /Take payment/ }))

    expect(checkoutMutate).toHaveBeenCalledTimes(1)
    const args = lastCheckoutArgs as Record<string, unknown>
    expect(args.branchId).toBe(BRANCH_A)
    expect(args.items).toEqual([{ product_id: 'p1', quantity: 2 }])
    expect(args.method).toBe('cash')
    expect(args.tendered).toBe(500)
    expect(typeof args.checkoutKey).toBe('string')
    // Nothing priced, costed or totalled leaves the browser.
    expect(Object.keys(args)).toEqual(
      expect.not.arrayContaining(['price', 'subtotal', 'total', 'cost', 'fees'])
    )
  })

  it('refuses to send an underpaid cash sale', () => {
    state.catalogue = [row()]
    render(<PosTillPage />)
    addProduct('Cola 1.5L')
    fireEvent.change(screen.getByLabelText('Cash received'), { target: { value: '50' } })

    expect(screen.getByText(/less than the total/)).toBeTruthy()
    expect((screen.getByRole('button', { name: /Take payment/ }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: /Take payment/ }))
    expect(checkoutMutate).not.toHaveBeenCalled()
  })

  it('requires a well-formed reference for an electronic payment', () => {
    state.catalogue = [row()]
    render(<PosTillPage />)
    addProduct('Cola 1.5L')
    fireEvent.keyDown(screen.getByLabelText('Payment method'), { key: 'Enter' })
    fireEvent.click(screen.getByRole('option', { name: 'GCash' }))

    expect(screen.getByText(/reference is required/)).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Reference'), { target: { value: 'abc' } })
    expect(screen.getByText(/6-32 digits/)).toBeTruthy()

    fireEvent.change(screen.getByLabelText('Reference'), { target: { value: '1234567890' } })
    fireEvent.click(screen.getByRole('button', { name: /Take payment/ }))
    expect(checkoutMutate).toHaveBeenCalledTimes(1)
  })

  it('says a reference is not proof of payment', () => {
    state.catalogue = [row()]
    render(<PosTillPage />)
    addProduct('Cola 1.5L')
    fireEvent.keyDown(screen.getByLabelText('Payment method'), { key: 'Enter' })
    fireEvent.click(screen.getByRole('option', { name: 'Maya' }))
    expect(screen.getByText(/not confirmation that the payment arrived/)).toBeTruthy()
  })

  it('reuses the same checkout key while the sale is unchanged', () => {
    // This is what makes a double-tap safe: the server returns the sale it
    // already made rather than charging twice.
    state.catalogue = [row()]
    render(<PosTillPage />)
    addProduct('Cola 1.5L')
    fireEvent.change(screen.getByLabelText('Cash received'), { target: { value: '500' } })

    fireEvent.click(screen.getByRole('button', { name: /Take payment/ }))
    const first = (lastCheckoutArgs as Record<string, unknown>).checkoutKey
    fireEvent.click(screen.getByRole('button', { name: /Take payment/ }))
    const second = (lastCheckoutArgs as Record<string, unknown>).checkoutKey

    expect(second).toBe(first)
    expect(checkoutMutate).toHaveBeenCalledTimes(2)
  })

  it('mints a new key when the cart changes', () => {
    state.catalogue = [row()]
    render(<PosTillPage />)
    addProduct('Cola 1.5L')
    fireEvent.change(screen.getByLabelText('Cash received'), { target: { value: '500' } })
    fireEvent.click(screen.getByRole('button', { name: /Take payment/ }))
    const first = (lastCheckoutArgs as Record<string, unknown>).checkoutKey

    addProduct('Cola 1.5L')
    fireEvent.click(screen.getByRole('button', { name: /Take payment/ }))
    const second = (lastCheckoutArgs as Record<string, unknown>).checkoutKey

    expect(second).not.toBe(first)
  })
})

describe('branch scoping', () => {
  it('says so when the account is assigned to no branch', () => {
    state.branchIds = []
    render(<PosTillPage />)
    expect(screen.getByText(/not assigned to a branch/)).toBeTruthy()
  })

  it('gives an administrator every active branch', () => {
    state.role = 'admin'
    state.branchIds = []
    state.catalogue = [row()]
    render(<PosTillPage />)
    expect(screen.getByText('Cola 1.5L')).toBeTruthy()
  })
})

describe('an empty branch', () => {
  it('explains itself rather than showing a blank grid', () => {
    render(<PosTillPage />)
    expect(screen.getByText(/not offering anything yet/)).toBeTruthy()
  })
})

export type { Receipt }
