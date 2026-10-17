import { useState } from 'react'
import { addDays, hhmm, isoDate } from '../lib/dates'
import { DateInput } from './DateInput'

export type ActionKind = 'task' | 'remind' | 'calendar' | 'email'

export interface ActionResult {
  title: string
  date: string
  time: string
  end: string
  to: string
}

const HEADINGS: Record<ActionKind, string> = {
  task: 'Make it a task',
  remind: 'Remind me',
  calendar: 'Put on calendar',
  email: 'Attach to email',
}

const CONFIRM: Record<ActionKind, string> = {
  task: 'Add task',
  remind: 'Set reminder',
  calendar: 'Add to calendar',
  email: 'Write email',
}

export function ActionDialog(props: {
  kind: ActionKind
  initialTitle: string
  initialDate?: string
  /** HH:MM, e.g. from a time written in the note */
  initialTime?: string
  onCancel: () => void
  onConfirm: (r: ActionResult) => void
}) {
  const { kind } = props
  const inAnHour = new Date(Date.now() + 3_600_000)
  inAnHour.setMinutes(inAnHour.getMinutes() < 30 ? 0 : 30)
  const start = props.initialTime ?? (kind === 'task' ? '' : kind === 'calendar' ? '10:00' : kind === 'remind' && props.initialDate ? '09:00' : hhmm(inAnHour))
  const [sh, sm] = (start || '10:00').split(':').map(Number)
  const [r, setR] = useState<ActionResult>({
    title: props.initialTitle,
    date: props.initialDate ?? isoDate(kind === 'calendar' ? addDays(new Date(), 1) : new Date()),
    time: start,
    end: `${String(Math.min(23, sh + 1)).padStart(2, '0')}:${String(sm).padStart(2, '0')}`,
    to: '',
  })
  const set = (patch: Partial<ActionResult>) => setR({ ...r, ...patch })

  return (
    <div className="scrim" onPointerDown={props.onCancel}>
      <form
        className="dialog"
        onPointerDown={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault()
          if (r.title.trim()) props.onConfirm({ ...r, title: r.title.trim() })
        }}
      >
        <h2>{HEADINGS[kind]}</h2>
        <label>
          {kind === 'email' ? 'Subject' : 'What'}
          <input
            autoFocus
            value={r.title}
            placeholder="Write or type it here"
            onChange={(e) => set({ title: e.target.value })}
          />
        </label>
        {kind === 'email' ? (
          <label>
            To (optional)
            <input type="email" value={r.to} onChange={(e) => set({ to: e.target.value })} />
          </label>
        ) : (
          <div className="row">
            <label>
              Day
              <DateInput value={r.date} onChange={(v) => v && set({ date: v })} />
            </label>
            <label>
              {kind === 'calendar' ? 'Start' : kind === 'task' ? 'Time (optional)' : 'Time'}
              <input type="time" value={r.time} onChange={(e) => set({ time: e.target.value })} />
            </label>
            {kind === 'calendar' && (
              <label>
                End
                <input type="time" value={r.end} onChange={(e) => set({ end: e.target.value })} />
              </label>
            )}
          </div>
        )}
        <div className="dialog-actions">
          <button type="button" className="chip" onClick={props.onCancel}>
            Cancel
          </button>
          <button type="submit" className="chip primary">
            {CONFIRM[kind]}
          </button>
        </div>
      </form>
    </div>
  )
}
