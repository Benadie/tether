import { useEffect, useState } from 'react'
import { isMine, useStore } from '../data/store'
import { addDays, fmtDow, fmtLong, greeting, hourOf, isoDate, parseIsoDate, sameDay, startOfWeek } from '../lib/dates'
import { Checkbox, DAY_START, HOURS, ScreenHeader, eventSlot, eventTime, taskSlot } from '../components/common'
import { ReviewRow, TaskRow, readyForReview } from '../components/TaskRow'
import { useEditor } from '../components/Editor'
import { InkPad } from '../components/InkPad'
import type { Nav } from '../App'

const ROW_H = 66

export function TodayScreen({ go }: { go: Nav }) {
  const { state, toggleTask, dailyPage } = useStore()
  const myTasks = state.tasks.filter(isMine)
  const editor = useEditor()
  const now = useNow()
  const todayIso = isoDate(now)
  const [day, setDay] = useState(todayIso)
  const viewing = parseIsoDate(day)
  const isToday = day === todayIso

  const open = myTasks.filter((t) => !t.done)
  const late = open.filter((t) => t.due && t.due < todayIso)
  const dueToday = open.filter((t) => t.due === todayIso)
  const dayTasks = myTasks.filter((t) => t.due === day)
  const timed = dayTasks.filter((t) => t.time)
  const anyTime = dayTasks.filter((t) => !t.time)
  const events = state.events.filter((e) => sameDay(new Date(e.start), viewing))

  // Clerk work you've been asked to review counts as your to-do too.
  const toReview = readyForReview(state.tasks)

  const things = dueToday.length + late.length + toReview.length
  const subtitle =
    `${fmtLong(now)}. ${things} ${things === 1 ? 'thing' : 'things'} to do today` +
    (late.length ? `, ${late.length} ${late.length === 1 ? 'is' : 'are'} running late` : '') +
    (toReview.length ? `, ${toReview.length} ready for your review.` : '.')

  const mon = startOfWeek(now)
  const week = Array.from({ length: 7 }, (_, i) => addDays(mon, i))

  return (
    <div className="screen">
      <ScreenHeader
        title={state.settings.name.trim() ? `${greeting(now)}, ${state.settings.name}` : greeting(now)}
        subtitle={subtitle}
        right={
          <nav className="daystrip">
            {week.map((d) => {
              const iso = isoDate(d)
              const has = open.some((t) => t.due === iso)
              return (
                <button key={iso} className={iso === day ? 'on' : ''} onClick={() => setDay(iso)}>
                  <small>{fmtDow(d)}</small>
                  <b>{d.getDate()}</b>
                  <i className={has ? 'dot' : 'dot none'} />
                </button>
              )
            })}
          </nav>
        }
      />

      <div className="today-grid">
        <section className="card schedule">
          <div className="card-head">
            <h2>{isToday ? 'Schedule' : fmtLong(viewing)}</h2>
            <button className="link" onClick={() => go('week')}>
              See the week
            </button>
          </div>
          <div className="timeline-scroll">
            <div className="timeline" style={{ height: HOURS.length * ROW_H }}>
              {HOURS.map((h, i) => (
                <div key={h} className="hour" style={{ top: i * ROW_H, height: ROW_H }}>
                  <span>{String(h).padStart(2, '0')}:00</span>
                </div>
              ))}
              {events.map((e) => (
                <div key={e.id} className="block event" style={eventSlot(e, ROW_H)} onClick={() => editor.editEvent(e)}>
                  <b>{e.title}</b>
                  <small>{eventTime(e)}</small>
                </div>
              ))}
              {timed.map((t) => (
                <div key={t.id} className={`block task tappable${t.done ? ' done' : ''}`} style={taskSlot(t, ROW_H)} onClick={() => editor.editTask(t)}>
                  <Checkbox done={t.done} onToggle={() => toggleTask(t.id)} />
                  <b>{t.title}</b>
                </div>
              ))}
              {isToday && hourOf(now) >= DAY_START && hourOf(now) <= HOURS.at(-1)! + 1 && (
                <div className="now" style={{ top: (hourOf(now) - DAY_START) * ROW_H }} />
              )}
            </div>
          </div>
        </section>

        <section className="card lists">
          {isToday && toReview.length > 0 && (
            <div className="group">
              <div className="group-head">
                <h2 className="review-title">Ready for your review</h2>
                <button className="link small" onClick={() => go('team')}>
                  Team
                </button>
              </div>
              {toReview.map((t) => (
                <ReviewRow key={t.id} task={t} />
              ))}
            </div>
          )}

          {isToday && late.length > 0 && (
            <div className="group">
              <h2 className="late-title">Running late</h2>
              {late.map((t) => (
                <TaskRow key={t.id} task={t} />
              ))}
            </div>
          )}

          <div className="group">
            <div className="group-head">
              <h2>{isToday ? 'Any time today' : 'Any time that day'}</h2>
              <button className="chip small" onClick={() => editor.newTask({ due: day })}>
                + Task
              </button>
            </div>
            {anyTime.length === 0 && <p className="muted">Nothing here.</p>}
            {anyTime.map((t) => (
              <TaskRow key={t.id} task={t} showDue={false} />
            ))}
          </div>
        </section>

        <InkPad
          variant="card"
          page={dailyPage(day)}
          heading={<h2>Notes</h2>}
          extra={
            <button className="chip" onClick={() => go('notes')}>
              All notes
            </button>
          }
        />
      </div>
    </div>
  )
}

/** Re-renders every minute so the "now" line and greeting stay current. */
export function useNow() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(t)
  }, [])
  return now
}
