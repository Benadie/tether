import { useEffect, useState } from 'react'
import { isMine, useStore } from '../data/store'
import { addDays, fmtDow, fmtLong, greeting, hourOf, isoDate, parseIsoDate, daysBetween, sameDay, startOfWeek } from '../lib/dates'
import { Checkbox, DAY_START, HOURS, ScreenHeader, eventSlot, eventTime, taskSlot } from '../components/common'
import { TaskRow } from '../components/TaskRow'
import { useEditor } from '../components/Editor'
import { InkPad } from '../components/InkPad'
import type { Nav } from '../App'

const ROW_H = 66

export function TodayScreen({ go }: { go: Nav }) {
  const { state, toggleTask, nudge, dailyPage } = useStore()
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
  const waiting = state.waiting.filter((w) => !w.done).sort((a, b) => a.since.localeCompare(b.since))

  const things = dueToday.length + late.length
  const subtitle =
    `${fmtLong(now)}. ${things} ${things === 1 ? 'thing' : 'things'} to do today` +
    (late.length ? `, ${late.length} ${late.length === 1 ? 'is' : 'are'} running late.` : '.')

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

          <div className="group">
            <h2>
              <button className="h2-link" onClick={() => go('waiting')}>
                Waiting on a reply
              </button>
            </h2>
            {waiting.slice(0, 3).map((w) => {
              const days = daysBetween(parseIsoDate(w.since), now)
              return (
                <div key={w.id} className="item tappable" onClick={() => editor.editWaiting(w)}>
                  <span className="avatar">{w.who[0]}</span>
                  <div>
                    <b>{w.title}</b>
                    <small className={days >= 4 ? 'late' : ''}>
                      {w.who}, {days} {days === 1 ? 'day' : 'days'}
                    </small>
                  </div>
                  {days >= 4 && (
                    <button className="chip outline" onClick={(e) => {
                    e.stopPropagation()
                    nudge(w.id)
                  }}>
                      Nudge
                    </button>
                  )}
                </div>
              )
            })}
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
