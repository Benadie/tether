import type { ReactNode } from 'react'
import { Check } from 'lucide-react'
import { daysBetween, hourOf, hhmm, parseIsoDate } from '../lib/dates'
import type { CalEvent, Task } from '../data/types'

export const DAY_START = 8
export const DAY_END = 17

export function Checkbox({ done, onToggle, late }: { done: boolean; onToggle: () => void; late?: boolean }) {
  return (
    <button
      className={`check${done ? ' done' : ''}${late ? ' late' : ''}`}
      aria-label={done ? 'Mark not done' : 'Mark done'}
      onClick={(e) => {
        e.stopPropagation()
        onToggle()
      }}
    >
      {done && <Check size={16} strokeWidth={3} />}
    </button>
  )
}

export function ScreenHeader(props: { title: ReactNode; subtitle?: ReactNode; right?: ReactNode }) {
  return (
    <header className="screen-head">
      <div>
        <h1>{props.title}</h1>
        {props.subtitle && <p>{props.subtitle}</p>}
      </div>
      {props.right}
    </header>
  )
}

export function lateLabel(t: Task, today: Date) {
  const days = t.due ? daysBetween(parseIsoDate(t.due), today) : 0
  const ago = days === 1 ? '1 day late' : `${days} days late`
  return t.from ? `${ago}, from ${t.from}` : ago
}

export function eventTime(e: CalEvent, withEnd = true) {
  const s = new Date(e.start)
  return withEnd ? `${hhmm(s)} to ${hhmm(new Date(e.end))}` : hhmm(s)
}

/** Vertical position helpers for hour grids */
export function slot(start: number, end: number, rowH: number) {
  const s = Math.max(DAY_START, Math.min(DAY_END + 1, start))
  // Short items still get a full hour slot so they stay readable with a finger-sized target.
  const e = Math.max(s + 1, Math.min(DAY_END + 1, end))
  return { top: (s - DAY_START) * rowH + 3, height: (e - s) * rowH - 6 }
}

export const eventSlot = (e: CalEvent, rowH: number) =>
  slot(hourOf(new Date(e.start)), hourOf(new Date(e.end)), rowH)

export function taskSlot(t: Task, rowH: number) {
  const [h, m] = t.time!.split(':').map(Number)
  const start = h + m / 60
  return slot(start, start + 1, rowH)
}

export const HOURS = Array.from({ length: DAY_END - DAY_START + 1 }, (_, i) => DAY_START + i)
