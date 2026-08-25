import { describe, expect, it } from 'vitest'
import {
  businessTodayISO,
  describeDashboardError,
  emptySummary,
  formatAverageSale,
  formatBusinessDate,
  moneyReconciles,
  paymentMethodLabel,
  peso,
  type DashboardSummary,
} from '@/lib/posDashboard'

function summary(overrides: Partial<DashboardSummary> = {}): DashboardSummary {
  return {
    business_date: '2026-08-25',
    sales_collected: 330,
    product_sales: 300,
    fees_collected: 30,
    transaction_count: 3,
    items_sold: 7,
    average_sale: 110,
    low_stock_count: 2,
    out_of_stock_count: 1,
    ...overrides,
  }
}

describe('the three money figures', () => {
  it('reconcile: collected is sales plus the fees the customer paid', () => {
    expect(moneyReconciles(summary())).toBe(true)
  })

  it('catches a drift between the RPC and the labels', () => {
    expect(moneyReconciles(summary({ fees_collected: 0 }))).toBe(false)
  })

  it('tolerates float representation, not real disagreement', () => {
    expect(moneyReconciles(summary({ sales_collected: 330.001 }))).toBe(true)
    expect(moneyReconciles(summary({ sales_collected: 331 }))).toBe(false)
  })

  it('holds for a day with nothing on it', () => {
    expect(moneyReconciles(emptySummary())).toBe(true)
  })
})

describe('formatAverageSale', () => {
  it('shows a dash on a day with no sales, never ₱0.00', () => {
    // The RPC divides by nullif(count, 0). "₱0.00 average" would read as
    // "sales averaged nothing", which is a different and untrue claim from
    // "there were no sales".
    expect(formatAverageSale(null)).toBe('—')
    expect(formatAverageSale(undefined)).toBe('—')
  })

  it('formats a real average as pesos', () => {
    expect(formatAverageSale(110)).toBe('₱110.00')
  })
})

describe('the summary shape', () => {
  it('carries no cost, COGS, margin or profit field', () => {
    // The RPCs do not declare them; this pins the client type to the same
    // contract so a future edit here cannot start reading one.
    const keys = Object.keys(summary())
    for (const forbidden of [
      'unit_cost',
      'average_unit_cost',
      'total_cogs',
      'line_cogs',
      'gross_profit',
      'net_profit',
      'margin',
      // The standalone's own column names, so a copy-paste from it fails here.
      'net_sales',
    ]) {
      expect(keys).not.toContain(forbidden)
    }
  })

  it('names its money figures for what they are', () => {
    const keys = Object.keys(summary())
    expect(keys).toContain('sales_collected')
    expect(keys).toContain('product_sales')
    expect(keys).toContain('fees_collected')
  })

  it('gives an unloaded day a full shape rather than undefined cards', () => {
    const empty = emptySummary('2026-08-25')
    expect(empty.transaction_count).toBe(0)
    expect(empty.items_sold).toBe(0)
    expect(empty.average_sale).toBeNull()
    expect(empty.business_date).toBe('2026-08-25')
  })
})

describe('formatBusinessDate', () => {
  it('reads the date as calendar fields, not as UTC midnight', () => {
    // new Date('2026-08-25') is parsed as UTC and renders as the 24th for
    // anyone west of Greenwich -- the same class of bug as the browser-local
    // day window this phase removed.
    expect(formatBusinessDate('2026-08-25')).toContain('25')
    expect(formatBusinessDate('2026-08-25')).toContain('2026')
  })

  it('is empty rather than "Invalid Date" when the day has not loaded', () => {
    expect(formatBusinessDate(undefined)).toBe('')
    expect(formatBusinessDate('')).toBe('')
  })
})

describe('businessTodayISO', () => {
  it('is the business calendar date, not the device one', () => {
    // 2026-08-25T16:30:00Z is already the 26th in Manila (UTC+8).
    expect(businessTodayISO(new Date('2026-08-25T16:30:00Z'))).toBe('2026-08-26')
    expect(businessTodayISO(new Date('2026-08-25T15:30:00Z'))).toBe('2026-08-25')
  })

  it('produces the format both a date input and the RPC accept', () => {
    expect(businessTodayISO(new Date('2026-08-25T02:00:00Z'))).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

describe('paymentMethodLabel', () => {
  it('uses the till"s own labels so the two screens agree', () => {
    expect(paymentMethodLabel('cash')).toBe('Cash')
    expect(paymentMethodLabel('gcash')).toBe('GCash')
  })

  it('falls back to the raw value rather than rendering nothing', () => {
    expect(paymentMethodLabel('crypto')).toBe('crypto')
  })
})

describe('peso', () => {
  it('always shows two decimals', () => {
    expect(peso(0)).toBe('₱0.00')
    expect(peso(1234.5)).toBe('₱1,234.50')
  })
})

describe('describeDashboardError', () => {
  it('explains a branch the account does not manage', () => {
    expect(describeDashboardError(new Error('permission denied'))).toBe(
      'You do not manage that branch.'
    )
  })

  it('explains an expired session', () => {
    expect(describeDashboardError(new Error('Sign in to continue'))).toContain('session has expired')
  })

  it('never returns an empty string', () => {
    expect(describeDashboardError(null)).toBe("Today's figures could not be loaded.")
  })
})
