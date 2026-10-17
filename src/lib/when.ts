// Finds a day and/or time in a note line, e.g.
//   "Call bank Wed 10:00"        -> next Wednesday, 10:00
//   "Send AFS tomorrow 2pm"      -> tomorrow, 14:00
//   "VAT due 25/10"              -> 25 October
//   "Partner review next week"   -> next Monday
// and gives back the line without those words, for a clean task title.
import { addDays, isoDate, pad, startOfDay } from './dates'

export interface When {
  /** YYYY-MM-DD */
  date?: string
  /** HH:MM */
  time?: string
  /** The line with the date/time words taken out */
  rest: string
}

const DAYS: Record<string, number> = {
  sun: 0, sunday: 0,
  mon: 1, monday: 1,
  tue: 2, tues: 2, tuesday: 2,
  wed: 3, weds: 3, wednesday: 3,
  thu: 4, thur: 4, thurs: 4, thursday: 4,
  fri: 5, friday: 5,
  sat: 6, saturday: 6,
}

const MONTHS: Record<string, number> = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3, may: 4, jun: 5, june: 5,
  jul: 6, july: 6, aug: 7, august: 7, sep: 8, sept: 8, september: 8, oct: 9, october: 9,
  nov: 10, november: 10, dec: 11, december: 11,
}

const DAY_RE = Object.keys(DAYS).sort((a, b) => b.length - a.length).join('|')
const MONTH_RE = Object.keys(MONTHS).sort((a, b) => b.length - a.length).join('|')

/** A real calendar date, rolled into next year if it has already passed. */
function dateFrom(day: number, month: number, year: number | undefined, today: Date) {
  let y = year ?? today.getFullYear()
  if (y < 100) y += 2000
  let d = new Date(y, month, day)
  if (d.getDate() !== day || d.getMonth() !== month) return null
  if (year === undefined && d < today) d = new Date(y + 1, month, day)
  return d
}

/** Short label: "Wed 21/10, 10:00" or "Today, 15:30" */
export function whenLabel(w: When, now = new Date()) {
  const d = new Date(`${w.date}T00:00:00`)
  const diff = Math.round((d.getTime() - startOfDay(now).getTime()) / 86_400_000)
  const day =
    diff === 0
      ? 'Today'
      : diff === 1
        ? 'Tomorrow'
        : `${d.toLocaleDateString('en-GB', { weekday: 'short' })} ${pad(d.getDate())}/${pad(d.getMonth() + 1)}`
  return w.time ? `${day}, ${w.time}` : day
}

export function findWhen(text: string, now = new Date()): When | null {
  const today = startOfDay(now)
  let rest = ` ${text} `
  let date: Date | null = null
  let time: string | undefined

  const take = (re: RegExp, fn: (m: RegExpMatchArray) => boolean) => {
    const m = rest.match(re)
    if (m && fn(m)) rest = rest.replace(m[0], ' ')
  }

  // ---- Time ----
  take(/(?<![\d/])(\d{1,2})[:.h](\d{2})\s*(am|pm)?(?![\d/])/i, (m) => {
    let h = Number(m[1])
    const min = Number(m[2])
    if (m[3]?.toLowerCase() === 'pm' && h < 12) h += 12
    if (m[3]?.toLowerCase() === 'am' && h === 12) h = 0
    if (h > 23 || min > 59) return false
    time = `${pad(h)}:${pad(min)}`
    return true
  })
  if (!time)
    take(/(?<![\d/:])(\d{1,2})\s*(am|pm)\b/i, (m) => {
      let h = Number(m[1])
      if (h < 1 || h > 12) return false
      if (m[2].toLowerCase() === 'pm' && h < 12) h += 12
      if (m[2].toLowerCase() === 'am' && h === 12) h = 0
      time = `${pad(h)}:00`
      return true
    })
  if (!time) take(/\b(noon|midday)\b/i, () => ((time = '12:00'), true))

  // ---- Date ----
  // 25/10, 25/10/2026, 25-10-26
  take(/(?<![\d:])(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?(?![\d:])/, (m) => {
    date = dateFrom(Number(m[1]), Number(m[2]) - 1, m[3] ? Number(m[3]) : undefined, today)
    return !!date
  })
  // 25 Oct, 25th October
  if (!date)
    take(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(${MONTH_RE})\\b\\.?(?:\\s+(\\d{4}))?`, 'i'), (m) => {
      date = dateFrom(Number(m[1]), MONTHS[m[2].toLowerCase()], m[3] ? Number(m[3]) : undefined, today)
      return !!date
    })
  // Oct 25
  if (!date)
    take(new RegExp(`\\b(${MONTH_RE})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b`, 'i'), (m) => {
      date = dateFrom(Number(m[2]), MONTHS[m[1].toLowerCase()], undefined, today)
      return !!date
    })
  if (!date) take(/\b(today|tonight)\b/i, (m) => ((date = today), m[1].toLowerCase() === 'tonight' && !time && (time = '18:00'), true))
  if (!date) take(/\b(tomorrow|tmrw|tmr)\b/i, () => ((date = addDays(today, 1)), true))
  if (!date) take(/\bnext\s+week\b/i, () => ((date = addDays(today, 7 - ((today.getDay() + 6) % 7))), true))
  if (!date)
    take(/\bin\s+(\d{1,2})\s+(day|days|week|weeks)\b/i, (m) => {
      const n = Number(m[1]) * (m[2].toLowerCase().startsWith('week') ? 7 : 1)
      date = addDays(today, n)
      return true
    })
  // "Wed" = the coming Wednesday (today if it's Wednesday); "next Fri" = Friday of next week.
  if (!date)
    take(new RegExp(`\\b(next\\s+)?(${DAY_RE})\\b\\.?`, 'i'), (m) => {
      const target = DAYS[m[2].toLowerCase()]
      if (m[1]) {
        const nextMonday = addDays(today, 7 - ((today.getDay() + 6) % 7))
        date = addDays(nextMonday, (target + 6) % 7)
      } else {
        date = addDays(today, (target - today.getDay() + 7) % 7)
      }
      return true
    })

  if (!date && !time) return null
  // A time on its own means today (or tomorrow if that time has passed).
  if (!date && time) {
    const [h, m] = time.split(':').map(Number)
    date = h * 60 + m > now.getHours() * 60 + now.getMinutes() ? today : addDays(today, 1)
  }

  // Drop little words left dangling at the end ("Review on at" -> "Review").
  rest = rest.replace(/\s+([,.;:])/g, '$1').replace(/\s{2,}/g, ' ').trim()
  let prev = ''
  while (prev !== rest) {
    prev = rest
    rest = rest.replace(/[\s,;:-]*\b(on|at|by|for|due|before|from)$/i, '').replace(/[\s,;:-]+$/, '').trim()
  }
  return { date: isoDate(date!), time, rest: rest || text.trim() }
}
