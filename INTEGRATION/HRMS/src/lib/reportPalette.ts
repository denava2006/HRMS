/** Validated chart palette (dataviz skill reference instance) — light-surface only,
 * since the app has no dark mode. Categorical order is the CVD-safety mechanism;
 * never cycle or reassign per-render. */
export const CATEGORICAL_COLORS = [
  '#2a78d6', // blue
  '#008300', // green
  '#e87ba4', // magenta
  '#eda100', // yellow
  '#1baf7a', // aqua
  '#eb6834', // orange
  '#4a3aa7', // violet
  '#e34948', // red
] as const

/** Single-hue sequential ramp (blue) for magnitude-only series. */
export const SEQUENTIAL_BLUE = '#2a78d6'

/** Reserved for state/status encodings — never reused as a categorical slot. */
export const STATUS_COLORS = {
  good: '#0ca30c',
  warning: '#fab219',
  serious: '#ec835a',
  critical: '#d03b3b',
  neutral: '#898781',
} as const

export const CHART_CHROME = {
  surface: '#fcfcfb',
  gridline: '#e1e0d9',
  axis: '#c3c2b7',
  mutedInk: '#898781',
  primaryInk: '#0b0b0b',
  secondaryInk: '#52514e',
} as const

export interface ChartDatum {
  name: string
  value: number
  color?: string
}

/** Named category colors, in fixed slot order. Falls back to categorical slots for
 * anything not explicitly mapped, so identity charts never reuse a status hue. */
const NAMED_COLORS: Record<string, string> = {
  Approved: STATUS_COLORS.good,
  Released: STATUS_COLORS.good,
  Active: STATUS_COLORS.good,
  Present: STATUS_COLORS.good,
  Hired: STATUS_COLORS.good,
  Qualified: STATUS_COLORS.good,
  Pending: STATUS_COLORS.warning,
  'Pending Approval': STATUS_COLORS.warning,
  Late: STATUS_COLORS.warning,
  Reviewed: STATUS_COLORS.warning,
  'Under Review': STATUS_COLORS.warning,
  Draft: STATUS_COLORS.neutral,
  Rejected: STATUS_COLORS.critical,
  Absent: STATUS_COLORS.critical,
  Cancelled: STATUS_COLORS.neutral,
  Closed: STATUS_COLORS.neutral,
}

/** Assigns colors for a status/state distribution chart — named states map to the
 * fixed status palette; anything unrecognized falls back to categorical slots so
 * it stays visually distinct without impersonating a reserved status hue. */
export function assignStatusColors(data: { name: string; value: number }[]): ChartDatum[] {
  let fallbackIdx = 0
  return data.map((d) => {
    const named = NAMED_COLORS[d.name]
    const color = named ?? CATEGORICAL_COLORS[fallbackIdx++ % CATEGORICAL_COLORS.length]
    return { ...d, color }
  })
}

/** Assigns fixed-order categorical colors for an identity chart (department, position,
 * leave type, etc). */
export function assignCategoricalColors(data: { name: string; value: number }[]): ChartDatum[] {
  return data.map((d, i) => ({ ...d, color: CATEGORICAL_COLORS[i % CATEGORICAL_COLORS.length] }))
}

/** All-pairs chart forms (pie/doughnut) can't clear CVD floors past 4 series —
 * fold the long tail into "Other" rather than growing the slice count unbounded. */
export function bucketTopNPlusOther(counts: Map<string, number>, n = 4): { name: string; value: number }[] {
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1])
  const top = sorted.slice(0, n)
  const rest = sorted.slice(n)
  const otherTotal = rest.reduce((sum, [, v]) => sum + v, 0)
  const result = top.map(([name, value]) => ({ name, value }))
  if (otherTotal > 0) result.push({ name: 'Other', value: otherTotal })
  return result
}

export function countBy<T>(items: T[], keyFn: (item: T) => string | null | undefined): Map<string, number> {
  const map = new Map<string, number>()
  for (const item of items) {
    const key = keyFn(item)
    if (!key) continue
    map.set(key, (map.get(key) ?? 0) + 1)
  }
  return map
}

export function sumBy<T>(items: T[], keyFn: (item: T) => string | null | undefined, valueFn: (item: T) => number): Map<string, number> {
  const map = new Map<string, number>()
  for (const item of items) {
    const key = keyFn(item)
    if (!key) continue
    map.set(key, (map.get(key) ?? 0) + valueFn(item))
  }
  return map
}
