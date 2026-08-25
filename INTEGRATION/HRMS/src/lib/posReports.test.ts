import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  defaultPosReportRange,
  formatPosBusinessDate,
  formatPosReportPercent,
  rangeFromPreset,
  validatePosReportRange,
  type PosReportPreset,
} from '@/lib/posReports'

function preset(
  presetKey: string,
  dateFrom: string,
  dateTo: string,
  sortOrder = 1
): PosReportPreset {
  return {
    preset: presetKey,
    date_from: dateFrom,
    date_to: dateTo,
    sort_order: sortOrder,
  }
}

afterEach(() => {
  vi.useRealTimers()
})

describe('database-owned report presets', () => {
  it('passes database dates through unchanged even when the device date differs', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2037-01-15T18:00:00Z'))

    const range = rangeFromPreset(
      preset('today', '2026-08-25', '2026-08-25')
    )

    expect(new Date().toISOString()).toContain('2037-01-15')
    expect(range).toEqual({
      dateFrom: '2026-08-25',
      dateTo: '2026-08-25',
      kind: 'today',
    })
  })

  it('uses the database month-to-date row as the initial range', () => {
    const presets = [
      preset('today', '2026-08-25', '2026-08-25', 1),
      preset('month_to_date', '2026-08-01', '2026-08-25', 4),
    ]

    expect(defaultPosReportRange(presets)).toEqual({
      dateFrom: '2026-08-01',
      dateTo: '2026-08-25',
      kind: 'month_to_date',
    })
  })

  it('ignores an unknown server row instead of treating it as a client preset', () => {
    expect(rangeFromPreset(preset('rolling_quarter', '2026-06-01', '2026-08-25'))).toBeNull()
  })
})

describe('report range contract', () => {
  it('allows exactly 366 inclusive business dates', () => {
    expect(
      validatePosReportRange({
        dateFrom: '2024-01-01',
        dateTo: '2024-12-31',
        kind: 'custom',
      })
    ).toBeNull()
  })

  it('rejects a 367-day range and a reversed range', () => {
    expect(
      validatePosReportRange({
        dateFrom: '2024-01-01',
        dateTo: '2025-01-01',
        kind: 'custom',
      })
    ).toMatch(/at most 366 days/i)

    expect(
      validatePosReportRange({
        dateFrom: '2026-08-25',
        dateTo: '2026-08-24',
        kind: 'custom',
      })
    ).toMatch(/start date/i)
  })
})

describe('business-calendar presentation', () => {
  it('formats civil date fields without a UTC conversion', () => {
    expect(formatPosBusinessDate('2026-08-25')).toBe('Aug 25, 2026')
  })

  it('renders an unavailable gross margin as an em dash', () => {
    expect(formatPosReportPercent(null)).toBe('—')
    expect(formatPosReportPercent(undefined)).toBe('—')
    expect(formatPosReportPercent(40)).toBe('40.00%')
  })
})
