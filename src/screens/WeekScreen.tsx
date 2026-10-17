import { useState } from 'react'
import { ChevronLeft, ChevronRight, Pencil } from 'lucide-react'
import { isMine, useStore } from '../data/store'
import { addDays, fmtDmy, fmtDow, hourOf, isoDate, sameDay, startOfWeek, workWeekStart } from '../lib/dates'
import { Checkbox, DAY_START, HOURS, ScreenHeader, eventSlot, eventTime, taskSlot } from '../components/common'
import { useNow } from './TodayScreen'
import { useEditor } from '../components/Editor'
import type { Nav } from '../App'

const ROW_H = 54

export function WeekScreen({ go }: { go: Nav }) {
  const { state, toggleTask } = useStore()
  const myTasks = state.tasks.filter(isMine)
  const editor = useEditor()
  const now = useNow()
  const todayIso = isoDate(now)
  const [mon, setMon] = useState(() => workWeekStart(now))
  const days = Array.from({ length: 5 }, (_, i) => addDays(mon, i))
  const fri = days[4]

  const range = `${fmtDmy(mon)} to ${fmtDmy(fri)}`

  const title =
    isoDate(mon) === isoDate(startOfWeek(now))
      ? 'This week'
      : isoDate(mon) === isoDate(addDays(startOfWeek(now), 7))
        ? 'Next week'
        : `Week of ${fmtDmy(mon)}`

  return (
    <div className="screen">
      <ScreenHeader
        title={title}
        subtitle={`${range}. Meetings come from your Outlook calendar, tasks from flagged emails.`}
        right={
          <div className="pager">
            <button className="round" aria-label="Previous week" onClick={() => setMon(addDays(mon, -7))}>
              <ChevronLeft />
            </button>
            <button className="chip" onClick={() => setMon(workWeekStart(now))}>
              Today
            </button>
            <button className="round" aria-label="Next week" onClick={() => setMon(addDays(mon, 7))}>
              <ChevronRight />
            </button>
          </div>
        }
      />

      <section className="card week">
        <div className="week-head">
          <div />
          {days.map((d) => {
            const iso = isoDate(d)
            const page = state.pages.find((p) => p.day === iso)
            const notes = page?.lines.filter((l) => l.text.trim() || l.strokes.length).length ?? 0
            return (
              <div key={iso} className="week-day">
                <span>{fmtDow(d)}</span>
                <b className={iso === todayIso ? 'today' : ''}>{d.getDate()}</b>
                {notes > 0 && (
                  <button className="note-chip" onClick={() => go('notes', page!.id)}>
                    <Pencil size={13} /> {notes} {notes === 1 ? 'note' : 'notes'}
                  </button>
                )}
              </div>
            )
          })}
        </div>

        <div className="week-todo">
          <span className="gutter-label">To do</span>
          {days.map((d) => {
            const iso = isoDate(d)
            const isToday = iso === todayIso
            const items = myTasks.filter(
              (t) => !t.done && !t.time && (t.due === iso || (isToday && t.due && t.due < todayIso)),
            )
            items.sort((a, b) => (a.due ?? '').localeCompare(b.due ?? ''))
            const shown = items.slice(0, 2)
            return (
              <div key={iso} className="todo-cell">
                {shown.map((t) => {
                  const late = !!t.due && t.due < todayIso
                  return (
                    <div key={t.id} className={`pill tappable${late ? ' late' : ''}`} onClick={() => editor.editTask(t)}>
                      <Checkbox done={t.done} late={late} onToggle={() => toggleTask(t.id)} />
                      <span>{t.title}</span>
                    </div>
                  )
                })}
                {items.length > 2 && (
                  <button className="link small" onClick={() => go('today')}>
                    {items.length - 2} more{isToday ? ' today' : ''}
                  </button>
                )}
              </div>
            )
          })}
        </div>

        <div className="week-scroll">
          <div className="week-grid" style={{ height: HOURS.length * ROW_H }}>
            <div className="gutter">
              {HOURS.map((h, i) => (
                <span key={h} style={{ top: i * ROW_H }}>
                  {String(h).padStart(2, '0')}:00
                </span>
              ))}
            </div>
            {days.map((d) => {
              const iso = isoDate(d)
              const isToday = iso === todayIso
              return (
                <div key={iso} className={`week-col${isToday ? ' today' : ''}`}>
                  {HOURS.map((h, i) => (
                    <div key={h} className="hour-line" style={{ top: i * ROW_H }} />
                  ))}
                  {state.events
                    .filter((e) => sameDay(new Date(e.start), d))
                    .map((e) => (
                      <div key={e.id} className="block event" style={eventSlot(e, ROW_H)} onClick={() => editor.editEvent(e)}>
                        <b>{e.title}</b>
                        <small>{eventTime(e, hourOf(new Date(e.end)) - hourOf(new Date(e.start)) > 1)}</small>
                      </div>
                    ))}
                  {myTasks
                    .filter((t) => t.due === iso && t.time)
                    .map((t) => (
                      <div key={t.id} className={`block task tappable${t.done ? ' done' : ''}`} style={taskSlot(t, ROW_H)} onClick={() => editor.editTask(t)}>
                        <Checkbox done={t.done} onToggle={() => toggleTask(t.id)} />
                        <b>{t.title}</b>
                      </div>
                    ))}
                  {isToday && hourOf(now) >= DAY_START && hourOf(now) <= HOURS.at(-1)! + 1 && (
                    <div className="now" style={{ top: (hourOf(now) - DAY_START) * ROW_H }} />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </section>
    </div>
  )
}
