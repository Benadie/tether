export const DAY_MS = 86_400_000

export const pad = (n: number) => String(n).padStart(2, '0')

export function startOfDay(d: Date) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

export function addDays(d: Date, n: number) {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

/** Monday of the week containing `d`. */
export function startOfWeek(d: Date) {
  const x = startOfDay(d)
  return addDays(x, -((x.getDay() + 6) % 7))
}

/** Same day next month/year, clamped to the month's last day (31 Jan -> 28 Feb). */
export function addMonths(d: Date, n: number) {
  const x = new Date(d.getFullYear(), d.getMonth() + n, 1)
  const last = new Date(x.getFullYear(), x.getMonth() + 1, 0).getDate()
  x.setDate(Math.min(d.getDate(), last))
  return x
}

/** Monday of the work week to plan: this week on weekdays, next week on Sat/Sun. */
export function workWeekStart(d: Date) {
  const day = d.getDay()
  return day === 6 || day === 0 ? addDays(startOfWeek(d), 7) : startOfWeek(d)
}

/** Local calendar date as YYYY-MM-DD. */
export function isoDate(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function parseIsoDate(s: string) {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** Local date + "HH:MM" as a full ISO timestamp. */
export function at(day: Date, time: string) {
  const [h, m] = time.split(':').map(Number)
  const x = startOfDay(day)
  x.setHours(h, m)
  return x.toISOString()
}

export const hhmm = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`

/** Hours since midnight as a float, e.g. 14:30 -> 14.5 */
export const hourOf = (d: Date) => d.getHours() + d.getMinutes() / 60

export const sameDay = (a: Date, b: Date) => isoDate(a) === isoDate(b)

export function daysBetween(a: Date, b: Date) {
  return Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / DAY_MS)
}

/** "17/10/2026": the one date format used everywhere in the app */
export const fmtDmy = (d: Date) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`

/** YYYY-MM-DD -> "17/10/2026" ("" stays "") */
export const isoToDmy = (iso: string) => (iso ? fmtDmy(parseIsoDate(iso)) : '')

/** "17/10/2026" (also 17-10-2026, 17.10.2026, 17/10/26) -> YYYY-MM-DD, or null if not a real date */
export function dmyToIso(text: string): string | null {
  const m = text.trim().match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/)
  if (!m) return null
  const [day, month] = [Number(m[1]), Number(m[2])]
  const year = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])
  const d = new Date(year, month - 1, day)
  return d.getDate() === day && d.getMonth() === month - 1 ? isoDate(d) : null
}

/** "Monday 12/10/2026" */
export const fmtLong = (d: Date) => `${d.toLocaleDateString('en-GB', { weekday: 'long' })} ${fmtDmy(d)}`

/** "Fri 09/10/2026" */
export const fmtShort = (d: Date) => `${d.toLocaleDateString('en-GB', { weekday: 'short' })} ${fmtDmy(d)}`

/** "Mon" */
export const fmtDow = (d: Date) => d.toLocaleDateString('en-GB', { weekday: 'short' })

export const fmtMonth = (d: Date) => d.toLocaleDateString('en-GB', { month: 'long' })

export function greeting(d = new Date()) {
  const h = d.getHours()
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}
