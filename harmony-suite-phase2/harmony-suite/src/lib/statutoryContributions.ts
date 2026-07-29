/**
 * Philippine mandatory employee contributions.
 *
 * Every function here returns the EMPLOYEE share only — the employer share is a
 * company cost, not a payroll deduction, so it never touches net pay.
 *
 * Contribution tables are revised by the agencies periodically. The rates below
 * are grouped as named constants with the schedule they came from, so updating
 * a year's figures is a one-place edit rather than a hunt through the payroll
 * pipeline.
 */

// ---------------------------------------------------------------------------
// SSS — Social Security System (2025 schedule)
// Total contribution rate 15% of the Monthly Salary Credit, split
// employer 10% / employee 5%. MSC floors at 5,000 and caps at 35,000, and is
// bracketed in 500-peso steps.
// ---------------------------------------------------------------------------
const SSS_EMPLOYEE_RATE = 0.05
const SSS_MSC_MINIMUM = 5_000
const SSS_MSC_MAXIMUM = 35_000
const SSS_MSC_STEP = 500

/** The bracketed Monthly Salary Credit a given salary falls into. */
export function sssMonthlySalaryCredit(monthlySalary: number): number {
  if (monthlySalary <= SSS_MSC_MINIMUM) return SSS_MSC_MINIMUM
  if (monthlySalary >= SSS_MSC_MAXIMUM) return SSS_MSC_MAXIMUM
  // Brackets run in 500 steps; a salary lands in the bracket it reaches.
  return Math.floor(monthlySalary / SSS_MSC_STEP) * SSS_MSC_STEP
}

export function calculateSssContribution(monthlySalary: number): number {
  if (monthlySalary <= 0) return 0
  return round2(sssMonthlySalaryCredit(monthlySalary) * SSS_EMPLOYEE_RATE)
}

// ---------------------------------------------------------------------------
// PhilHealth (2025 schedule)
// Premium is 5% of the monthly basic salary, shared equally, so the employee
// pays 2.5%. Income floor 10,000 and ceiling 100,000 — below or above those,
// the premium is computed on the floor/ceiling rather than actual salary.
// ---------------------------------------------------------------------------
const PHILHEALTH_PREMIUM_RATE = 0.05
const PHILHEALTH_EMPLOYEE_SHARE = 0.5
const PHILHEALTH_SALARY_FLOOR = 10_000
const PHILHEALTH_SALARY_CEILING = 100_000

export function calculatePhilHealthContribution(monthlySalary: number): number {
  if (monthlySalary <= 0) return 0
  const base = Math.min(Math.max(monthlySalary, PHILHEALTH_SALARY_FLOOR), PHILHEALTH_SALARY_CEILING)
  return round2(base * PHILHEALTH_PREMIUM_RATE * PHILHEALTH_EMPLOYEE_SHARE)
}

// ---------------------------------------------------------------------------
// Pag-IBIG / HDMF (rates effective February 2024)
// Employee rate is 1% at or below 1,500 monthly, 2% above it. The fund salary
// is capped at 10,000, so the employee contribution tops out at 200.
// ---------------------------------------------------------------------------
const PAGIBIG_LOWER_BRACKET_CEILING = 1_500
const PAGIBIG_LOW_RATE = 0.01
const PAGIBIG_HIGH_RATE = 0.02
const PAGIBIG_FUND_SALARY_CAP = 10_000

export function calculatePagIbigContribution(monthlySalary: number): number {
  if (monthlySalary <= 0) return 0
  const fundSalary = Math.min(monthlySalary, PAGIBIG_FUND_SALARY_CAP)
  const rate = monthlySalary <= PAGIBIG_LOWER_BRACKET_CEILING ? PAGIBIG_LOW_RATE : PAGIBIG_HIGH_RATE
  return round2(fundSalary * rate)
}

// ---------------------------------------------------------------------------

export interface StatutoryContributions {
  sss: number
  philHealth: number
  pagIbig: number
  total: number
}

/**
 * All three contributions for one payroll period.
 *
 * They are statutory *monthly* amounts, so they're computed from the monthly
 * basic salary and then pro-rated for shorter periods — a weekly run must not
 * deduct a full month of SSS. A monthly period pro-rates to exactly 1.
 */
export function calculateStatutoryContributions(
  monthlyBasicSalary: number,
  periodsPerMonth = 1
): StatutoryContributions {
  const divisor = periodsPerMonth > 0 ? periodsPerMonth : 1
  const sss = round2(calculateSssContribution(monthlyBasicSalary) / divisor)
  const philHealth = round2(calculatePhilHealthContribution(monthlyBasicSalary) / divisor)
  const pagIbig = round2(calculatePagIbigContribution(monthlyBasicSalary) / divisor)
  return { sss, philHealth, pagIbig, total: round2(sss + philHealth + pagIbig) }
}

/** How many times a given payroll frequency runs in a month — the divisor for
 * pro-rating the monthly statutory amounts. */
export function periodsPerMonth(frequency: string): number {
  switch (frequency) {
    case 'weekly':
      return 4
    case 'biweekly':
      return 2
    case 'semi_monthly':
      return 2
    default:
      return 1
  }
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}
