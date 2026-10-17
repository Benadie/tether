import { useState } from 'react'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { isMine, useStore } from '../data/store'
import { addDays, daysBetween, fmtLong, isoDate, parseIsoDate, sameDay, startOfWeek } from '../lib/dates'
import { ScreenHeader, eventTime } from '../components/common'
import { useEditor } from '../components/Editor'
import { TaskRow } from '../components/TaskRow'

const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export function CalendarScreen() {
  const { state } = useStore()
  const myTasks = state.tasks.filter(isMine)
  const editor = useEditor()
  const now = new Date()
  const todayIso = isoDate(now)
  const [month, setMonth] = useState(() => new Date(now.getFullYear(), now.getMonth(), 1))
  const [day, setDay] = useState(todayIso)

  const first = startOfWeek(month)
  const lastOfMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0)
  const weeks = Math.floor(daysBetween(first, lastOfMonth) / 7) + 1
  const cells = Array.from({ length: weeks * 7 }, (_, i) => addDays(first, i))

  const selected = parseIsoDate(day)
  const dayEvents = state.events
    .filter((e) => sameDay(new Date(e.start), selected))
    .sort((a, b) => a.start.localeCompare(b.start))
  const dayTasks = myTasks.filter((t) => t.due === day)

  const shift = (n: number) => setMonth(new Date(month.getFullYear(), month.getMonth() + n, 1))

  return (
    <div className="screen">
      <ScreenHeader
        title={month.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
        subtitle="Your month at a glance. Tap a day to see what's on."
        right={
          <div className="pager">
            <button className="round" aria-label="Previous month" onClick={() => shift(-1)}>
              <ChevronLeft />
            </button>
            <button
              className="chip"
              onClick={() => {
                setMonth(new Date(now.getFullYear(), now.getMonth(), 1))
                setDay(todayIso)
              }}
            >
              Today
            </button>
            <button className="round" aria-label="Next month" onClick={() => shift(1)}>
              <ChevronRight />
            </button>
          </div>
        }
      />

      <div className="calendar-grid">
        <section className="card month">
          <div className="month-dow">
            {DOW.map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>
          <div className="month-cells" style={{ gridTemplateRows: `repeat(${weeks}, 1fr)` }}>
            {cells.map((d) => {
              const iso = isoDate(d)
              const evs = state.events.filter((e) => sameDay(new Date(e.start), d))
              const tasks = myTasks.filter((t) => t.due === iso && !t.done)
              const items = [
                ...evs.map((e) => ({ id: e.id, kind: 'event', title: e.title })),
                ...tasks.map((t) => ({ id: t.id, kind: 'task', title: t.title })),
              ]
              const cls = [
                'cell',
                d.getMonth() !== month.getMonth() && 'other',
                iso === todayIso && 'today',
                iso === day && 'on',
              ]
                .filter(Boolean)
                .join(' ')
              return (
                <button key={iso} className={cls} onClick={() => setDay(iso)}>
                  <b>{d.getDate()}</b>
                  {items.slice(0, 3).map((it) => (
                    <span key={it.id} className={`mini ${it.kind}`}>
                      {it.title}
                    </span>
                  ))}
                  {items.length > 3 && <small>+{items.length - 3} more</small>}
                </button>
              )
            })}
          </div>
        </section>

        <section className="card lists">
          <div className="card-head">
            <h2>{day === todayIso ? 'Today' : fmtLong(selected)}</h2>
            <div className="row">
              <button className="chip" onClick={() => editor.newTask({ due: day })}>
                <Plus size={18} /> Task
              </button>
              <button className="chip primary" onClick={() => editor.newEvent(day)}>
                <Plus size={18} /> Event
              </button>
            </div>
          </div>
          {dayEvents.length + dayTasks.length === 0 && <p className="muted">Nothing planned.</p>}
          {dayEvents.map((e) => (
            <div key={e.id} className="agenda event" onClick={() => editor.editEvent(e)}>
              <small>{eventTime(e)}</small>
              <b>{e.title}</b>
            </div>
          ))}
          {dayTasks.map((t) => (
            <TaskRow key={t.id} task={t} showDue={false} />
          ))}
        </section>
      </div>
    </div>
  )
}
