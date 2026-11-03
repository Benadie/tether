// Recurring deadlines (the checklist on the Dashboard).
import type { AppState, Deadline } from '../data/types'
import { addDays, isoDate, parseIsoDate, startOfDay, startOfWeek } from './dates'
import { uid } from './id'

export const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']

/** The usual SARS dates plus the practice's own routine; edit or remove them on the Dashboard. */
export function defaultDeadlines(): Deadline[] {
  return [
    { id: uid(), title: 'EMP201 submissions', every: 'month', day: 7 },
    { id: uid(), title: 'VAT 201 submissions', every: 'month', day: 25 },
    { id: uid(), title: 'Timesheets and WIP', every: 'week', day: 5 },
    { id: uid(), title: 'Monthly WIP report to partners', every: 'month', day: 31 },
  ]
}

/** Weekends move a monthly deadline to the Friday before, like SARS dates. */
function lastWeekdayOnOrBefore(d: Date) {
  const day = d.getDay()
  return day === 6 ? addDays(d, -1) : day === 0 ? addDays(d, -2) : d
}

export type DeadlineStatus = 'done' | 'late' | 'soon' | 'later'

export interface DeadlineDue {
  deadline: Deadline
  /** Key into deadlineChecks */
  key: string
  due: string
  /** Days from today: negative when late */
  days: number
  doneAt?: string
  status: DeadlineStatus
}

/** This period's date for a deadline, and whether it's done, late or due soon. */
export function deadlineDue(d: Deadline, checks: AppState['deadlineChecks'], now = new Date()): DeadlineDue {
  const today = startOfDay(now)
  let due: Date
  let period: string
  if (d.every === 'week') {
    const mon = startOfWeek(today)
    due = addDays(mon, Math.min(Math.max(d.day, 1), 5) - 1)
    period = isoDate(mon)
  } else {
    const last = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
    due = lastWeekdayOnOrBefore(new Date(today.getFullYear(), today.getMonth(), Math.min(d.day, last)))
    period = isoDate(today).slice(0, 7)
  }
  const key = `${d.id}:${period}`
  const doneAt = checks[key]
  const days = Math.round((due.getTime() - today.getTime()) / 86_400_000)
  const status: DeadlineStatus = doneAt ? 'done' : days < 0 ? 'late' : days <= 3 ? 'soon' : 'later'
  return { deadline: d, key, due: isoDate(due), days, doneAt, status }
}

export function countdown(x: DeadlineDue) {
  if (x.status === 'done') return `Done ${parseIsoDate(x.doneAt!.slice(0, 10)).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`
  if (x.days < 0) return `${-x.days} ${x.days === -1 ? 'day' : 'days'} late`
  if (x.days === 0) return 'Due today'
  if (x.days === 1) return 'Due tomorrow'
  if (x.days <= 6) return `Due in ${x.days} days`
  return `Due ${parseIsoDate(x.due).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}`
}

export function describe(d: Deadline) {
  if (d.every === 'week') return `Every ${WEEKDAYS[d.day - 1] ?? 'Friday'}`
  if (d.day >= 31) return 'Last day of the month'
  const n = d.day
  const suffix = n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th'
  return `Every month on the ${n}${suffix}`
}
