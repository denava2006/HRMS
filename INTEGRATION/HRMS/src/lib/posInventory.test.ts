import { describe, expect, it } from 'vitest'
import {
  describeInventoryError,
  inventoryConcernRank,
  projectedAverageCost,
  projectedQuantity,
  round2,
  validateAdjustment,
  validateReceipt,
} from '@/lib/posInventory'

describe('projectedQuantity', () => {
  it('adds the change to the current balance', () => {
    expect(projectedQuantity(10, 5)).toBe(15)
    expect(projectedQuantity(10, -5)).toBe(5)
    expect(projectedQuantity(10, -15)).toBe(-5)
  })
})

describe('validateAdjustment', () => {
  it('accepts a plain recount in either direction', () => {
    expect(validateAdjustment(10, 5, 'recount')).toEqual([])
    expect(validateAdjustment(10, -5, 'recount')).toEqual([])
  })

  it('refuses zero', () => {
    expect(validateAdjustment(10, 0, 'recount').join(' ')).toContain('cannot be zero')
  })

  it('refuses a change that would go below zero, and says what it would be', () => {
    // Mirrors the RPC, which raises with the resulting number.
    expect(validateAdjustment(10, -15, 'recount').join(' ')).toContain('leave -5 units')
  })

  it('refuses a fractional change -- stock is whole units', () => {
    expect(validateAdjustment(10, 1.5, 'recount').join(' ')).toContain('whole number')
  })

  it('refuses a reason pointed the wrong way', () => {
    expect(validateAdjustment(10, 5, 'damaged').join(' ')).toContain('removes stock')
    expect(validateAdjustment(10, 5, 'expired').join(' ')).toContain('removes stock')
    expect(validateAdjustment(10, -5, 'found').join(' ')).toContain('adds stock')
  })

  it('accepts a reason pointed the right way', () => {
    expect(validateAdjustment(10, -5, 'damaged')).toEqual([])
    expect(validateAdjustment(10, 5, 'found')).toEqual([])
  })

  it('allows an adjustment down to exactly zero', () => {
    expect(validateAdjustment(10, -10, 'lost')).toEqual([])
  })
})

describe('validateReceipt', () => {
  it('accepts a normal delivery', () => {
    expect(validateReceipt(10, 40)).toEqual([])
  })

  it('accepts a zero unit cost -- a free delivery is a real thing', () => {
    expect(validateReceipt(10, 0)).toEqual([])
  })

  it('refuses a non-positive quantity', () => {
    expect(validateReceipt(0, 40).join(' ')).toContain('more than zero')
    expect(validateReceipt(-5, 40).join(' ')).toContain('more than zero')
  })

  it('refuses a fractional quantity', () => {
    expect(validateReceipt(1.5, 40).join(' ')).toContain('whole number')
  })

  it('refuses a negative cost', () => {
    expect(validateReceipt(10, -1).join(' ')).toContain('cannot be negative')
  })
})

describe('projectedAverageCost -- mirrors receive_pos_stock', () => {
  it('takes the received price outright at a zero balance', () => {
    // Also what stops a division by zero.
    expect(projectedAverageCost(0, 0, 10, 40)).toBe(40)
    expect(projectedAverageCost(0, 99, 10, 40)).toBe(40)
  })

  it('weights the average across both deliveries', () => {
    // The worked example from the brief: 10 @ 40 then 10 @ 50 -> 20 @ 45.
    expect(projectedAverageCost(10, 40, 10, 50)).toBe(45)
  })

  it('weights by quantity, not by delivery count', () => {
    // 30 @ 40 + 10 @ 80 = 1600/40 = 40... deliberately asymmetric:
    expect(projectedAverageCost(30, 40, 10, 80)).toBe(50)
  })

  it('rounds to two decimals the way the database does', () => {
    // 3 @ 10 + 1 @ 10.01 = 40.01/4 = 10.0025 -> 10.00
    expect(projectedAverageCost(3, 10, 1, 10.01)).toBe(10)
  })

  it('leaves the average alone when nothing is received', () => {
    expect(projectedAverageCost(10, 45, 0, 99)).toBe(45)
  })
})

describe('round2', () => {
  it('rounds half away from zero, matching PostgreSQL', () => {
    expect(round2(1.005)).toBe(1.01)
    expect(round2(2.675)).toBe(2.68)
  })

  it('never returns NaN', () => {
    expect(round2(Number.NaN)).toBe(0)
  })
})

describe('inventoryConcernRank', () => {
  it('puts out-of-stock first, then low stock, then the rest', () => {
    const rows = [
      { quantity_on_hand: 20, is_low_stock: false },
      { quantity_on_hand: 0, is_low_stock: true },
      { quantity_on_hand: 3, is_low_stock: true },
    ]
    expect([...rows].sort((a, b) => inventoryConcernRank(a) - inventoryConcernRank(b))).toEqual([
      { quantity_on_hand: 0, is_low_stock: true },
      { quantity_on_hand: 3, is_low_stock: true },
      { quantity_on_hand: 20, is_low_stock: false },
    ])
  })
})

describe('describeInventoryError', () => {
  it('passes the below-zero sentence through, since it names the number', () => {
    expect(
      describeInventoryError(new Error('That adjustment would leave -5 units, which is below zero'))
    ).toContain('-5 units')
  })

  it('explains a manager attempting to receive', () => {
    expect(describeInventoryError(new Error('Only an Administrator can receive stock'))).toContain(
      'Ask them to record the delivery'
    )
  })

  it('explains why a branch product cannot be removed', () => {
    expect(
      describeInventoryError(new Error('violates foreign key constraint "pos_inventory_movements_inventory_fk"'))
    ).toContain('Disable it instead')
  })

  it('explains the write guard', () => {
    expect(
      describeInventoryError(new Error('Stock and valuation change only through the inventory operations'))
    ).toContain('receiving or adjusting')
  })

  it('never returns an empty string', () => {
    expect(describeInventoryError(null)).toBe('Something went wrong. Please try again.')
  })
})
