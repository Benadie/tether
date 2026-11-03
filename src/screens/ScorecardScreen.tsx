import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { Check, Plus } from 'lucide-react'
import { isMine, useStore } from '../data/store'
import type { PayrollChecks, Task } from '../data/types'
import { addDays, fmtLong, fmtMonth, isoDate, startOfWeek } from '../lib/dates'
import { CHECKS, checksDone, monthKey, periodEndsIn } from '../lib/vat'
import { countdown, deadlineDue, describe } from '../lib/deadlines'
import { ScreenHeader } from '../components/common'
import { useEditor } from '../components/Editor'
import { readyForReview } from '../components/TaskRow'
import { useNow } from './TodayScreen'
import type { Nav } from '../App'

type Range = 'week' | 'month'

const reducedMotion = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches

/** Counts up to the number (and glides when it changes). */
function useCountUp(target: number, ms = 900) {
  const [shown, setShown] = useState(reducedMotion() ? target : 0)
  const from = useRef(shown)
  useEffect(() => {
    if (reducedMotion()) return setShown(target)
    const start = performance.now()
    const a = from.current
    let raf = 0
    const step = (t: number) => {
      const p = Math.min(1, (t - start) / ms)
      setShown(a + (target - a) * (1 - Math.pow(1 - p, 3)))
      if (p < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => {
      cancelAnimationFrame(raf)
      from.current = target
    }
  }, [target, ms])
  return Math.round(shown)
}

const delay = (i: number) => ({ '--i': i }) as CSSProperties

/** A box that counts as finished on the payroll sheet: every item ✓ or n/a. */
const PAYROLL_ITEMS = ['followedUp', 'completedByClerk', 'sentToClient', 'empSubmitted'] as const
const payrollFinished = (c?: PayrollChecks) => PAYROLL_ITEMS.every((i) => c?.[i]?.s === 'done' || c?.[i]?.s === 'na')

const doneDay = (t: Task) => (t.doneAt ? isoDate(new Date(t.doneAt)) : '')

export function ScorecardScreen({ go }: { go: Nav }) {
  const { state, toggleDeadline } = useStore()
  const editor = useEditor()
  const now = useNow()
  const today = isoDate(now)
  const [range, setRange] = useState<Range>('month')

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const weekStart = startOfWeek(now)
  const from = range === 'month' ? monthStart : weekStart
  const prevFrom = range === 'month' ? new Date(now.getFullYear(), now.getMonth() - 1, 1) : addDays(weekStart, -7)

  const mine = state.tasks.filter(isMine)
  const doneIn = (a: Date, b: Date) => mine.filter((t) => t.done && t.doneAt && new Date(t.doneAt) >= a && new Date(t.doneAt) < b)
  const completed = doneIn(from, addDays(now, 1))
  // Compared with the same point last month / week, so the 3rd isn't measured against a whole month.
  const completedBefore = doneIn(prevFrom, new Date(prevFrom.getTime() + (now.getTime() - from.getTime())))
  const open = mine.filter((t) => !t.done)
  const overdue = open.filter((t) => t.due && t.due < today)
  const withDue = completed.filter((t) => t.due)
  const onTime = withDue.filter((t) => doneDay(t) <= t.due!)
  const onTimePct = withDue.length ? Math.round((onTime.length / withDue.length) * 100) : 0
  const toReview = readyForReview(state.tasks).length
  const delta = completed.length - completedBefore.length

  // Month by month for the last year: feeds the sparklines and the on-time trend.
  const history = Array.from({ length: 12 }, (_, k) => {
    const start = new Date(now.getFullYear(), now.getMonth() - (11 - k), 1)
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 1)
    const cut = end > now ? now : end
    const done = doneIn(start, end)
    const dated = done.filter((t) => t.due)
    const onTimeCount = dated.filter((t) => doneDay(t) <= t.due!).length
    const notDoneBy = (t: Task) => !t.done || !t.doneAt || new Date(t.doneAt) >= cut
    return {
      label: start.toLocaleDateString('en-GB', { month: 'short' }),
      completed: done.length,
      onTime: dated.length ? Math.round((onTimeCount / dated.length) * 100) : null,
      // Due that month and not done by its end
      notCompleted: mine.filter((t) => t.due && t.due >= isoDate(start) && t.due < isoDate(cut) && notDoneBy(t)).length,
      // Everything past its due date at the end of that month
      overdue: mine.filter((t) => t.due && t.due < isoDate(cut) && notDoneBy(t)).length,
      teamDone: state.tasks.filter((t) => t.assignee && t.done && t.doneAt && new Date(t.doneAt) >= start && new Date(t.doneAt) < end).length,
    }
  })
  const last6 = history.slice(6)
  const series = (k: keyof (typeof history)[number]) => last6.map((h) => h[k] as number | null)
  // On time this month vs the average of the three months before, in percentage points
  const onTimeNow = history[11].onTime
  const onTimeThen = history.slice(8, 11).map((h) => h.onTime).filter((v): v is number => v !== null)
  const onTimeShift = onTimeNow !== null && onTimeThen.length ? onTimeNow - Math.round(onTimeThen.reduce((a, b) => a + b, 0) / onTimeThen.length) : null

  // Last six weeks: what got done, and what was due but missed or finished late.
  const weeks = Array.from({ length: 6 }, (_, k) => {
    const ws = addDays(weekStart, -7 * (5 - k))
    const we = addDays(ws, 7)
    const done = doneIn(ws, we).length
    const missed = mine.filter((t) => {
      if (!t.due || t.due < isoDate(ws) || t.due >= isoDate(we) || t.due >= today) return false
      return !t.done || doneDay(t) > t.due
    }).length
    return { label: ws.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }), done, missed }
  })
  const weekMax = Math.max(1, ...weeks.map((w) => w.done + w.missed))

  // Month-end close: this month's VAT, payroll and checklist together.
  const thisMonth = monthKey(now.getFullYear(), now.getMonth())
  const vatClients = state.vatClients.filter((c) => periodEndsIn(c.cycle, thisMonth))
  const vatDone = vatClients.filter((c) => checksDone(state.vatChecks[`${c.id}:${thisMonth}`]) === CHECKS.length).length
  const payDone = state.payrollClients.filter((c) => payrollFinished(state.payrollChecks[`${c.id}:${thisMonth}`])).length
  const deadlines = state.deadlines
    .map((d) => deadlineDue(d, state.deadlineChecks, now))
    .sort((a, b) => Number(a.status === 'done') - Number(b.status === 'done') || a.due.localeCompare(b.due))
  const checklistDone = deadlines.filter((d) => d.status === 'done').length
  const parts = [
    { label: `VAT, ${fmtMonth(now)}`, done: vatDone, total: vatClients.length, go: () => go('vat') },
    { label: `Payroll, ${fmtMonth(now)}`, done: payDone, total: state.payrollClients.length, go: () => go('payroll') },
    { label: 'Deadline checklist', done: checklistDone, total: deadlines.length, go: undefined },
  ]
  const totalAll = parts.reduce((n, p) => n + p.total, 0)
  const closePct = totalAll ? Math.round((parts.reduce((n, p) => n + p.done, 0) / totalAll) * 100) : 0

  // Team this month
  const team = state.clerks.map((c) => {
    const theirs = state.tasks.filter((t) => t.assignee === c.id)
    return {
      name: c.name.split(' ')[0],
      done: theirs.filter((t) => t.done && t.doneAt && new Date(t.doneAt) >= monthStart).length,
      open: theirs.filter((t) => !t.done).length,
      late: theirs.filter((t) => !t.done && t.due && t.due < today).length,
    }
  })
  const teamMax = Math.max(1, ...team.map((t) => t.done + t.open))

  const attention = deadlines.filter((d) => d.status === 'late' || d.status === 'soon').length + overdue.length

  return (
    <div className="screen scorecard">
      <ScreenHeader
        title="Scorecard"
        subtitle={`${fmtLong(now)}. How the practice is doing.`}
        right={
          <div className="segmented">
            <button className={range === 'week' ? 'on' : ''} onClick={() => setRange('week')}>
              This week
            </button>
            <button className={range === 'month' ? 'on' : ''} onClick={() => setRange('month')}>
              This month
            </button>
          </div>
        }
      />

      <Headline
        month={fmtMonth(now)}
        onTime={history[11].onTime}
        closed={closePct}
        atRisk={attention}
      />

      <div className="kpis">
        <Kpi i={0} label="Completed" value={completed.length} tone="good" spark={series('completed')} onClick={() => go('dashboard')}>
          <span className={delta >= 0 ? 'up' : 'down'}>
            {delta === 0 ? 'Same as' : `${delta > 0 ? '▲' : '▼'} ${Math.abs(delta)} vs`} this time last {range}
          </span>
        </Kpi>
        <Kpi i={1} label="Not completed" value={open.length} spark={series('notCompleted')} onClick={() => go('dashboard')}>
          <span>still open</span>
        </Kpi>
        <Kpi
          i={2}
          label="Overdue"
          value={overdue.length}
          tone={overdue.length ? 'bad' : 'good'}
          pulse={overdue.length > 0}
          spark={series('overdue')}
          onClick={() => go('dashboard')}
        >
          <span>{overdue.length ? 'needs a date or a tick' : 'all on track'}</span>
        </Kpi>
        <Kpi
          i={3}
          label="Done on time"
          value={withDue.length ? onTimePct : null}
          suffix="%"
          tone={!withDue.length ? '' : onTimePct >= 80 ? 'good' : 'bad'}
          spark={series('onTime')}
        >
          {onTimeShift !== null ? (
            <span className={onTimeShift >= 0 ? 'up' : 'down'}>
              {onTimeShift === 0 ? 'Level with' : `${onTimeShift > 0 ? '▲' : '▼'} ${Math.abs(onTimeShift)} pts vs`} last quarter
            </span>
          ) : (
            <span>{withDue.length ? `${onTime.length} of ${withDue.length} by their due date` : `nothing with a due date done this ${range}`}</span>
          )}
        </Kpi>
        <Kpi i={4} label="Team work to review" value={toReview} tone={toReview ? 'accent' : ''} spark={series('teamDone')} onClick={() => go('team')}>
          <span>{toReview ? 'waiting on you' : 'nothing waiting'}</span>
        </Kpi>
      </div>

      <div className="score-grid">
        <section className="card rise close-card" style={delay(5)}>
          <h2>Month-end close</h2>
          <Ring pct={closePct} />
          <div className="close-parts">
            {parts.map((p, i) => (
              <button key={p.label} className="close-part" onClick={p.go} disabled={!p.go}>
                <div className="close-part-head">
                  <span>{p.label}</span>
                  <b>
                    {p.done} of {p.total}
                  </b>
                </div>
                <div className="meter">
                  <i style={{ width: `${p.total ? (p.done / p.total) * 100 : 0}%`, ...delay(i) }} />
                </div>
              </button>
            ))}
          </div>
        </section>

        <section className="card rise" style={delay(6)}>
          <h2>Completed vs missed</h2>
          <small>Your tasks, last 6 weeks</small>
          <div className="week-chart">
            {weeks.map((w, i) => (
              <div key={w.label} className="week-col">
                <div className="week-bar">
                  {w.missed > 0 && (
                    <i className="seg missed" style={{ height: `${(w.missed / weekMax) * 100}%`, ...delay(i) }}>
                      <em>{w.missed}</em>
                    </i>
                  )}
                  <i className="seg done" style={{ height: `${(w.done / weekMax) * 100}%`, ...delay(i) }}>
                    {w.done > 0 && <em>{w.done}</em>}
                  </i>
                </div>
                <small className={i === 5 ? 'this-week' : ''}>{i === 5 ? 'This wk' : w.label}</small>
              </div>
            ))}
          </div>
          <div className="legend">
            <span>
              <i className="done" /> Completed
            </span>
            <span>
              <i className="missed" /> Missed or late
            </span>
          </div>
        </section>

        <section className="card rise deadline-card" style={delay(7)}>
          <div className="card-head">
            <h2>Deadlines</h2>
            <button className="chip small" onClick={() => editor.newDeadline()}>
              <Plus size={16} /> Deadline
            </button>
          </div>
          <div className="deadline-list">
            {deadlines.map((d, i) => (
              <div key={d.key} className={`deadline ${d.status}`} style={delay(i)}>
                <button
                  className={`dl-tick${d.status === 'done' ? ' on' : ''}`}
                  aria-label={d.status === 'done' ? `Untick ${d.deadline.title}` : `Tick ${d.deadline.title}`}
                  onClick={() => toggleDeadline(d.key)}
                >
                  {d.status === 'done' && <Check size={18} strokeWidth={3} />}
                </button>
                <button className="dl-body" onClick={() => editor.editDeadline(d.deadline)}>
                  <b>{d.deadline.title}</b>
                  <small>{describe(d.deadline)}</small>
                </button>
                <span className="dl-when">{countdown(d)}</span>
              </div>
            ))}
            {deadlines.length === 0 && <p className="muted small-note">Add the deadlines you need to hit every month or week.</p>}
          </div>
        </section>
      </div>

      <section className="card rise trend-card" style={delay(8)}>
        <div className="card-head">
          <div>
            <h2>Deadlines met on time</h2>
            <small>Share of your tasks finished by their due date, month by month</small>
          </div>
          {onTimeShift !== null && (
            <span className={`trend-badge ${onTimeShift >= 0 ? 'up' : 'down'}`}>
              {onTimeShift >= 0 ? '▲' : '▼'} {Math.abs(onTimeShift)} pts vs last quarter
            </span>
          )}
        </div>
        <TrendChart points={history.map((h) => ({ label: h.label, value: h.onTime }))} target={90} />
      </section>

      {team.length > 0 && (
        <section className="card rise score-team" style={delay(9)}>
          <div className="card-head">
            <h2>Team this month</h2>
            <button className="link" onClick={() => go('team')}>
              Team
            </button>
          </div>
          <div className="team-bars">
            {team.map((t, i) => (
              <div key={t.name} className="team-row">
                <span className="team-name">{t.name}</span>
                <div className="team-track">
                  <i className="seg done" style={{ width: `${(t.done / teamMax) * 100}%`, ...delay(i) }} />
                  <i className="seg open" style={{ width: `${(t.open / teamMax) * 100}%`, ...delay(i + 1) }} />
                </div>
                <span className="team-nums">
                  <b>{t.done}</b> done · {t.open} open{t.late ? <em> · {t.late} late</em> : ''}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function Kpi(props: {
  i: number
  label: string
  /** null shows a dash (nothing to measure yet) */
  value: number | null
  suffix?: string
  tone?: string
  pulse?: boolean
  /** Last six months, oldest first (null = nothing to measure that month) */
  spark?: (number | null)[]
  onClick?: () => void
  children?: React.ReactNode
}) {
  const shown = useCountUp(props.value ?? 0)
  return (
    <button className={`kpi rise ${props.tone ?? ''}`} style={delay(props.i)} onClick={props.onClick} disabled={!props.onClick}>
      <span className="kpi-label">
        {props.pulse && <i className="pulse" />}
        {props.label}
      </span>
      <b>{props.value === null ? '–' : `${shown}${props.suffix ?? ''}`}</b>
      <small>{props.children}</small>
      {props.spark && <Sparkline values={props.spark} i={props.i} />}
    </button>
  )
}

/** The one line an executive reads: on time, closed, at risk. */
function Headline(props: { month: string; onTime: number | null; closed: number; atRisk: number }) {
  const onTime = useCountUp(props.onTime ?? 0, 1300)
  const closed = useCountUp(props.closed, 1300)
  return (
    <section className="headline rise" style={delay(0)}>
      <span className="headline-month">{props.month}</span>
      <p>
        {props.onTime === null ? (
          <span className="hl-part">No deadlines measured yet</span>
        ) : (
          <span className="hl-part">
            <b className={props.onTime >= 80 ? 'good' : 'bad'}>{onTime}%</b> of deadlines met
          </span>
        )}
        <span className="hl-dot">·</span>
        <span className="hl-part">
          month-end <b>{closed}%</b> closed
        </span>
        <span className="hl-dot">·</span>
        <span className="hl-part">
          {props.atRisk ? (
            <>
              <b className="bad">{props.atRisk}</b> at risk
            </>
          ) : (
            <b className="good">nothing at risk</b>
          )}
        </span>
      </p>
    </section>
  )
}

/** On-time % over the year: a smooth line that draws itself, with a target line. */
function TrendChart({ points, target }: { points: { label: string; value: number | null }[]; target: number }) {
  const W = 1000
  const H = 240
  const L = 44
  // Room on the right for the target label
  const R = 96
  const T = 26
  const B = 34
  const x = (k: number) => L + (k / (points.length - 1)) * (W - L - R)
  const y = (v: number) => T + (1 - v / 100) * (H - T - B)
  const known = points.map((p, k) => ({ ...p, k })).filter((p): p is { label: string; value: number; k: number } => p.value !== null)
  const pts = known.map((p) => [x(p.k), y(p.value)] as [number, number])
  const line = smoothPath(pts)
  return (
    <div className="trend">
      <svg viewBox={`0 0 ${W} ${H}`} aria-label="On-time percentage by month">
        {[0, 25, 50, 75, 100].map((g) => (
          <g key={g}>
            <line className="grid" x1={L} x2={W - R} y1={y(g)} y2={y(g)} />
            <text className="axis" x={L - 10} y={y(g) + 4} textAnchor="end">
              {g}%
            </text>
          </g>
        ))}
        <line className="target" x1={L} x2={W - R} y1={y(target)} y2={y(target)} />
        <text className="target-label" x={W - R + 12} y={y(target) + 5} textAnchor="start">
          Target {target}%
        </text>
        {points.map((p, k) => (
          <text key={k} className={`axis month${k === points.length - 1 ? ' now' : ''}`} x={x(k)} y={H - 8} textAnchor="middle">
            {p.label}
          </text>
        ))}
        {pts.length >= 2 && (
          <>
            <path className="trend-area" d={`${line} L${pts[pts.length - 1][0]},${y(0)} L${pts[0][0]},${y(0)} Z`} />
            <path className="trend-line" d={line} pathLength={1} />
          </>
        )}
        {known.map((p, n) => (
          <g key={p.k} className="trend-point" style={delay(n)}>
            <circle cx={x(p.k)} cy={y(p.value)} r={7} />
            <text x={x(p.k)} y={y(p.value) - 14} textAnchor="middle">
              {p.value}%
            </text>
          </g>
        ))}
      </svg>
      {known.length < 2 && <p className="muted small-note trend-empty">The line builds up as you finish tasks that have due dates.</p>}
    </div>
  )
}

/** A smooth curve through the points (Catmull-Rom as cubic Béziers). */
function smoothPath(pts: [number, number][]) {
  if (pts.length < 2) return ''
  let d = `M${pts[0][0]},${pts[0][1]}`
  for (let k = 0; k < pts.length - 1; k++) {
    const p0 = pts[k - 1] ?? pts[k]
    const p1 = pts[k]
    const p2 = pts[k + 1]
    const p3 = pts[k + 2] ?? p2
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6]
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6]
    d += ` C${c1[0]},${c1[1]} ${c2[0]},${c2[1]} ${p2[0]},${p2[1]}`
  }
  return d
}

/** Six-month trend under a KPI: draws itself in, ends on a dot. */
function Sparkline({ values, i }: { values: (number | null)[]; i: number }) {
  const W = 120
  const H = 30
  const known = values.map((v, x) => [x, v] as const).filter((p): p is readonly [number, number] => p[1] !== null)
  if (known.length < 2) return <div className="spark empty">Trend shows after a month or two</div>
  const max = Math.max(...known.map((p) => p[1]))
  const min = Math.min(...known.map((p) => p[1]))
  const span = max - min || 1
  const pts = known.map(([x, v]) => [(x / (values.length - 1)) * W, H - 4 - ((v - min) / span) * (H - 8)] as [number, number])
  const line = smoothPath(pts)
  const last = pts[pts.length - 1]
  return (
    <svg className="spark" viewBox={`0 0 ${W} ${H}`} style={delay(i)} aria-hidden>
      <path className="spark-area" d={`${line} L${last[0]},${H} L${pts[0][0]},${H} Z`} />
      <path className="spark-line" d={line} pathLength={1} />
      <circle className="spark-dot" cx={last[0]} cy={last[1]} r={3} />
    </svg>
  )
}

/** Progress ring that sweeps round to the percentage. */
function Ring({ pct }: { pct: number }) {
  const r = 62
  const c = 2 * Math.PI * r
  const shown = useCountUp(pct, 1200)
  // Start empty, then let the transition sweep it round.
  const [drawn, setDrawn] = useState(reducedMotion() ? pct : 0)
  useEffect(() => {
    const id = requestAnimationFrame(() => setDrawn(pct))
    return () => cancelAnimationFrame(id)
  }, [pct])
  return (
    <div className="ring">
      <svg viewBox="0 0 160 160" aria-hidden>
        <circle cx="80" cy="80" r={r} className="ring-track" />
        <circle cx="80" cy="80" r={r} className="ring-fill" strokeDasharray={c} strokeDashoffset={c * (1 - drawn / 100)} />
      </svg>
      <div className="ring-label">
        <b>{shown}%</b>
        <small>closed</small>
      </div>
    </div>
  )
}
