import { describe, expect, it } from 'vitest'
import {
  computeFees,
  parseFees,
  paymentQrPath,
  round2,
  sumFees,
  validateFees,
  type Fee,
} from '@/lib/posFees'

function fee(overrides: Partial<Fee> = {}): Fee {
  return { id: 'f1', name: 'Service Charge', type: 'percent', value: 10, enabled: true, ...overrides }
}

describe('round2', () => {
  it('rounds half away from zero, the way PostgreSQL round(numeric, 2) does', () => {
    // The whole reason this is not Math.round(x * 100) / 100: that returns 1.00
    // here, and a till comparing a rounded total against an unrounded one
    // rejects an exact cash tender.
    expect(round2(1.005)).toBe(1.01)
    expect(round2(2.675)).toBe(2.68)
    expect(round2(-1.005)).toBe(-1.01)
  })

  it('leaves already-rounded values alone', () => {
    expect(round2(10)).toBe(10)
    expect(round2(10.5)).toBe(10.5)
    expect(round2(0)).toBe(0)
  })

  it('does not produce NaN for non-finite input', () => {
    expect(round2(Number.NaN)).toBe(0)
    expect(round2(Number.POSITIVE_INFINITY)).toBe(0)
  })
})

describe('computeFees', () => {
  it('applies a percentage against the subtotal', () => {
    expect(computeFees(200, [fee({ type: 'percent', value: 10 })])).toEqual([
      { name: 'Service Charge', type: 'percent', value: 10, amount: 20 },
    ])
  })

  it('applies a fixed fee regardless of the subtotal', () => {
    expect(computeFees(200, [fee({ type: 'fixed', value: 15 })])[0].amount).toBe(15)
    expect(computeFees(5, [fee({ type: 'fixed', value: 15 })])[0].amount).toBe(15)
  })

  it('skips a disabled fee', () => {
    expect(computeFees(200, [fee({ enabled: false })])).toEqual([])
  })

  it('skips a zero-valued fee', () => {
    expect(computeFees(200, [fee({ value: 0 })])).toEqual([])
  })

  it('returns nothing for an unconfigured branch', () => {
    // A branch with no branch_pos_settings row reaches here as null.
    expect(computeFees(200, null)).toEqual([])
    expect(computeFees(200, undefined)).toEqual([])
    expect(computeFees(200, [])).toEqual([])
  })

  it('rounds each fee before summing, not the total afterwards', () => {
    // 3 x 0.005 rounds to 0.01 each = 0.03. Summing first would give 0.015 -> 0.02.
    const fees: Fee[] = [
      fee({ id: 'a', name: 'A', type: 'fixed', value: 0.005 }),
      fee({ id: 'b', name: 'B', type: 'fixed', value: 0.005 }),
      fee({ id: 'c', name: 'C', type: 'fixed', value: 0.005 }),
    ]
    const applied = computeFees(100, fees)
    expect(applied.map((a) => a.amount)).toEqual([0.01, 0.01, 0.01])
    expect(sumFees(applied)).toBe(0.03)
  })
})

describe('sumFees', () => {
  it('is zero when nothing applies', () => {
    expect(sumFees([])).toBe(0)
  })

  it('adds the rounded amounts', () => {
    expect(sumFees(computeFees(1000, [fee({ value: 12 }), fee({ id: 'f2', name: 'VAT', value: 5 })]))).toBe(170)
  })
})

describe('parseFees', () => {
  it('reads a well-formed jsonb array', () => {
    expect(parseFees([fee()])).toHaveLength(1)
  })

  it('treats a missing settings row as no fees rather than crashing', () => {
    expect(parseFees(null)).toEqual([])
    expect(parseFees(undefined)).toEqual([])
    expect(parseFees('not an array')).toEqual([])
  })

  it('drops entries that do not match the fee shape', () => {
    expect(parseFees([fee(), { name: 'broken' }, null, 42])).toHaveLength(1)
  })
})

describe('validateFees -- mirrors public.pos_fees_are_valid', () => {
  it('accepts a valid fixed fee', () => {
    expect(validateFees([fee({ type: 'fixed', value: 25 })])).toEqual([])
  })

  it('accepts a valid percent fee', () => {
    expect(validateFees([fee({ type: 'percent', value: 12 })])).toEqual([])
  })

  it('accepts an empty configuration', () => {
    expect(validateFees([])).toEqual([])
  })

  it('rejects a negative value', () => {
    expect(validateFees([fee({ value: -1 })]).join(' ')).toContain('cannot be negative')
  })

  it('rejects a percentage over 100', () => {
    expect(validateFees([fee({ type: 'percent', value: 101 })]).join(' ')).toContain('cannot exceed 100%')
  })

  it('allows a fixed fee over 100 -- it is pesos, not a percentage', () => {
    expect(validateFees([fee({ type: 'fixed', value: 500 })])).toEqual([])
  })

  it('rejects an unsupported type', () => {
    expect(validateFees([fee({ type: 'surcharge' as never })]).join(' ')).toContain('unsupported fee type')
  })

  it('rejects a nameless fee', () => {
    expect(validateFees([fee({ name: '   ' })]).join(' ')).toContain('needs a name')
  })

  it('rejects an over-long name', () => {
    expect(validateFees([fee({ name: 'x'.repeat(81) })]).join(' ')).toContain('longer than 80')
  })

  it('rejects a non-numeric value', () => {
    expect(validateFees([fee({ value: Number.NaN })]).join(' ')).toContain('must be a number')
  })

  it('rejects more than 20 fees, matching the database cap', () => {
    const many = Array.from({ length: 21 }, (_, i) => fee({ id: `f${i}`, name: `Fee ${i}` }))
    expect(validateFees(many).join(' ')).toContain('at most 20')
  })

  it('rejects two fees sharing a name -- valid JSON, unreadable receipt', () => {
    expect(validateFees([fee({ id: 'a' }), fee({ id: 'b' })]).join(' ')).toContain('more than once')
  })
})

describe('paymentQrPath', () => {
  it('puts the object in the branch folder the CHECK constraint requires', () => {
    expect(paymentQrPath('b1000000-0000-0000-0000-000000000002', 'qr.png')).toMatch(
      /^b1000000-0000-0000-0000-000000000002\/[a-z0-9-]+\.png$/
    )
  })

  it('sanitises the extension, which becomes part of the object path', () => {
    expect(paymentQrPath('b1', 'evil.pn g/../../x')).toMatch(/\.[a-z0-9]+$/)
    expect(paymentQrPath('b1', 'noextension')).toMatch(/\.png$/)
  })
})
