// VAT periods. A period is identified by the month it ends in ("YYYY-MM").
//   monthly : every month
//   even    : two-monthly, ending Feb, Apr, Jun, Aug, Oct, Dec
//   uneven  : two-monthly, ending Jan, Mar, May, Jul, Sep, Nov
import type { VatChecks, VatCycle } from '../data/types'
import { pad } from './dates'

export const CYCLE_LABEL: Record<VatCycle, string> = {
  monthly: 'Monthly',
  even: 'Even months',
  uneven: 'Uneven months',
}

/** Short form for the table, as on the control sheet */
export const CYCLE_SHORT: Record<VatCycle, string> = {
  monthly: 'Monthly',
  even: 'Even',
  uneven: 'Uneven',
}

export const CYCLE_HINT: Record<VatCycle, string> = {
  monthly: 'Every month',
  even: 'Two-monthly, ending Feb, Apr, Jun, Aug, Oct, Dec',
  uneven: 'Two-monthly, ending Jan, Mar, May, Jul, Sep, Nov',
}

export const CHECKS: { key: keyof VatChecks; label: string }[] = [
  { key: 'followedUp', label: 'Followed up' },
  { key: 'doneByClerk', label: 'Done by clerk' },
  { key: 'reviewed', label: 'Reviewed' },
  // Stored as empHandedIn (its first name) so existing ticks carry over.
  { key: 'empHandedIn', label: 'VAT 201 handed in' },
]

/** "2026-10" */
export const monthKey = (year: number, month0: number) => `${year}-${pad(month0 + 1)}`

export function parseMonth(key: string) {
  const [y, m] = key.split('-').map(Number)
  return { year: y, month0: m - 1 }
}

export function addMonth(key: string, n: number) {
  const { year, month0 } = parseMonth(key)
  const d = new Date(year, month0 + n, 1)
  return monthKey(d.getFullYear(), d.getMonth())
}

/** Does a client on this cycle have a VAT period ending in this month? */
export function periodEndsIn(cycle: VatCycle, key: string) {
  if (cycle === 'monthly') return true
  const month1 = parseMonth(key).month0 + 1
  return cycle === 'even' ? month1 % 2 === 0 : month1 % 2 === 1
}

/** The most recent period end for this cycle, on or before the given month. */
export function latestPeriodEnd(cycle: VatCycle, key: string) {
  return periodEndsIn(cycle, key) ? key : addMonth(key, -1)
}

const monthName = (key: string, withYear = true) => {
  const { year, month0 } = parseMonth(key)
  return new Date(year, month0, 1).toLocaleDateString('en-GB', withYear ? { month: 'short', year: 'numeric' } : { month: 'short' })
}

/** "Oct 2026" (monthly) or "Sep to Oct 2026" / "Dec 2025 to Jan 2026" (two-monthly) */
export function periodLabel(cycle: VatCycle, end: string) {
  if (cycle === 'monthly') return monthName(end)
  const start = addMonth(end, -1)
  const sameYear = parseMonth(start).year === parseMonth(end).year
  return `${monthName(start, !sameYear)} to ${monthName(end)}`
}

/** Full month name with year: "October 2026" */
export function longMonth(key: string) {
  const { year, month0 } = parseMonth(key)
  return new Date(year, month0, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
}

export const checksDone = (c?: VatChecks) => CHECKS.filter((x) => c?.[x.key]).length
