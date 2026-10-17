import { useState } from 'react'
import { Plus } from 'lucide-react'
import { isMine, useStore } from '../data/store'
import type { Task } from '../data/types'
import { addDays, daysBetween, fmtLong, fmtShort, hhmm, isoDate, parseIsoDate, sameDay, startOfWeek } from '../lib/dates'
import { ScreenHeader } from '../components/common'
import { useEditor } from '../components/Editor'
import { TaskRow } from '../components/TaskRow'
import { useNow } from './TodayScreen'
import type { Nav } from '../App'

type Filter = 'open' | 'late' | 'today' | 'week' | 'nodate' | 'done'

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'open', label: 'All open' },
  { id: 'late', label: 'Overdue' },
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'Next 7 days' },
  { id: 'nodate', label: 'No date' },
  { id: 'done', label: 'Done' },
]

export function DashboardScreen({ go }: { go: Nav }) {
  const { state } = useStore()
  const myTasks = state.tasks.filter(isMine)
  const editor = useEditor()
  const now = useNow()
  const today = isoDate(now)
  const in7 = isoDate(addDays(now, 7))
  const [filter, setFilter] = useState<Filter>('open')

  const open = myTasks.filter((t) => !t.done)
  const late = open.filter((t) => t.due && t.due < today)
  const dueToday = open.filter((t) => t.due === today)
  const week = open.filter((t) => t.due && t.due > today && t.due <= in7)
  const noDate = open.filter((t) => !t.due)
  const weekStart = startOfWeek(now).toISOString()
  const doneThisWeek = myTasks.filter((t) => t.done && t.doneAt && t.doneAt >= weekStart)
  const waiting = state.waiting.filter((w) => !w.done).sort((a, b) => a.since.localeCompare(b.since))

  const upcoming = state.events
    .filter((e) => new Date(e.end) > now && new Date(e.start) < addDays(now, 7))
    .sort((a, b) => a.start.localeCompare(b.start))
    .slice(0, 5)

  const recentPages = [...state.pages]
    .filter((p) => p.lines.some((l) => l.text.trim() || l.strokes.length))
    .sort((a, b) => b.updated.localeCompare(a.updated))
    .slice(0, 3)

  const list: Record<Filter, Task[]> = {
    open,
    late,
    today: dueToday,
    week,
    nodate: noDate,
    done: myTasks.filter((t) => t.done).sort((a, b) => (b.doneAt ?? '').localeCompare(a.doneAt ?? '')),
  }

  const teamToReview = state.tasks.filter((t) => t.assignee && !t.done && t.status === 'review').length

  const tiles = [
    { label: 'Overdue', value: late.length, tone: late.length ? 'red' : '', onClick: () => setFilter('late') },
    { label: 'Due today', value: dueToday.length, tone: 'accent', onClick: () => setFilter('today') },
    { label: 'Next 7 days', value: week.length, tone: '', onClick: () => setFilter('week') },
    { label: 'Waiting on others', value: waiting.length, tone: '', onClick: () => go('waiting') },
    { label: 'Team work to review', value: teamToReview, tone: teamToReview ? 'accent-text' : '', onClick: () => go('team') },
    { label: 'Done this week', value: doneThisWeek.length, tone: 'done', onClick: () => setFilter('done') },
  ]

  return (
    <div className="screen">
      <ScreenHeader
        title="Dashboard"
        subtitle={`${fmtLong(now)}. Everything you need, in one place.`}
        right={
          <div className="row">
            <button className="chip" onClick={() => editor.newEvent()}>
              <Plus size={18} /> Event
            </button>
            <button className="chip primary" onClick={() => editor.newTask()}>
              <Plus size={18} /> Task
            </button>
          </div>
        }
      />

      <div className="tiles">
        {tiles.map((t) => (
          <button key={t.label} className={`tile ${t.tone}`} onClick={t.onClick}>
            <b>{t.value}</b>
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      <div className="dash-grid">
        <section className="card lists dash-tasks">
          <div className="card-head">
            <h2>Tasks</h2>
          </div>
          <div className="filters">
            {FILTERS.map((f) => (
              <button key={f.id} className={`filter${filter === f.id ? ' on' : ''}`} onClick={() => setFilter(f.id)}>
                {f.label}
                <i>{list[f.id].length}</i>
              </button>
            ))}
          </div>
          <div className="dash-list">
            {filter === 'open' ? (
              <GroupedTasks tasks={open} today={today} in7={in7} />
            ) : list[filter].length ? (
              list[filter].map((t) => <TaskRow key={t.id} task={t} />)
            ) : (
              <p className="muted empty-note">Nothing here.</p>
            )}
          </div>
        </section>

        <div className="dash-side">
          <section className="card lists">
            <div className="card-head">
              <h2>Coming up</h2>
              <button className="link" onClick={() => go('week')}>
                Week
              </button>
            </div>
            {upcoming.length === 0 && <p className="muted">No meetings in the next 7 days.</p>}
            {upcoming.map((e) => {
              const start = new Date(e.start)
              const when = sameDay(start, now) ? 'Today' : daysBetween(now, start) === 1 ? 'Tomorrow' : fmtShort(start)
              return (
                <div key={e.id} className="agenda event" onClick={() => editor.editEvent(e)}>
                  <small>
                    {when}, {hhmm(start)}
                    {new Date(e.start) <= now && ' (now)'}
                  </small>
                  <b>{e.title}</b>
                </div>
              )
            })}
          </section>

          <section className="card lists">
            <div className="card-head">
              <h2>Waiting on a reply</h2>
              <button className="link" onClick={() => go('waiting')}>
                All
              </button>
            </div>
            {waiting.length === 0 && <p className="muted">Nobody owes you anything.</p>}
            {waiting.slice(0, 4).map((w) => {
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
                </div>
              )
            })}
          </section>

          <section className="card lists">
            <div className="card-head">
              <h2>Recent notes</h2>
              <button className="link" onClick={() => go('notes')}>
                All
              </button>
            </div>
            {recentPages.map((p) => {
              const firstLine = p.lines.find((l) => l.text.trim())?.text
              return (
                <button key={p.id} className="note-row" onClick={() => go('notes', p.id)}>
                  <b>{p.day ? (p.day === today ? 'Today' : fmtShort(parseIsoDate(p.day))) : p.title}</b>
                  {firstLine && <span>{firstLine}</span>}
                </button>
              )
            })}
          </section>
        </div>
      </div>
    </div>
  )
}

function GroupedTasks({ tasks, today, in7 }: { tasks: Task[]; today: string; in7: string }) {
  const tomorrow = isoDate(addDays(parseIsoDate(today), 1))
  const groups: [string, Task[]][] = [
    ['Overdue', tasks.filter((t) => t.due && t.due < today)],
    ['Today', tasks.filter((t) => t.due === today)],
    ['Tomorrow', tasks.filter((t) => t.due === tomorrow)],
    ['This week', tasks.filter((t) => t.due && t.due > tomorrow && t.due <= in7)],
    ['Later', tasks.filter((t) => t.due && t.due > in7)],
    ['No date', tasks.filter((t) => !t.due)],
  ]
  const sort = (list: Task[]) =>
    [...list].sort((a, b) => (a.due ?? '').localeCompare(b.due ?? '') || (a.time ?? '99').localeCompare(b.time ?? '99'))

  if (!tasks.length) return <p className="muted empty-note">All clear. Add a task with the + button.</p>
  return (
    <>
      {groups
        .filter(([, list]) => list.length)
        .map(([name, list]) => (
          <div key={name} className="task-group">
            <h3 className={name === 'Overdue' ? 'late' : ''}>{name}</h3>
            {sort(list).map((t) => (
              <TaskRow key={t.id} task={t} showDue={name !== 'Today' && name !== 'Tomorrow'} />
            ))}
          </div>
        ))}
    </>
  )
}
