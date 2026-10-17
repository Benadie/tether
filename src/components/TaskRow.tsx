import { Repeat2 } from 'lucide-react'
import { useStore } from '../data/store'
import type { Repeat, Task } from '../data/types'
import { daysBetween, fmtShort, isoDate, parseIsoDate, startOfDay } from '../lib/dates'
import { Checkbox } from './common'
import { useEditor } from './Editor'

const REPEAT_LABEL: Record<Repeat, string> = { weekly: 'weekly', monthly: 'monthly', yearly: 'yearly' }

/** "Today", "Tomorrow", "Fri 23/10/2026", or "2 days late" */
export function dueLabel(t: Task, now = new Date()) {
  if (!t.due) return 'No date'
  const diff = daysBetween(startOfDay(now), parseIsoDate(t.due))
  if (diff < 0 && !t.done) return diff === -1 ? '1 day late' : `${-diff} days late`
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  return fmtShort(parseIsoDate(t.due))
}

export const isLate = (t: Task, todayIso: string) => !t.done && !!t.due && t.due < todayIso

/** A task line: tick box, title, and when / who. Tap the row to edit it. */
export function TaskRow({ task, showDue = true }: { task: Task; showDue?: boolean }) {
  const { toggleTask } = useStore()
  const { editTask } = useEditor()
  const now = new Date()
  const late = isLate(task, isoDate(now))
  const meta = [showDue && dueLabel(task, now), task.time, task.client, task.from && `from ${task.from}`]
    .filter(Boolean)
    .join(', ')

  return (
    <div className={`item tappable${task.done ? ' done' : ''}`} onClick={() => editTask(task)}>
      <Checkbox done={task.done} late={late} onToggle={() => toggleTask(task.id)} />
      <div>
        <b>{task.title}</b>
        {(meta || task.repeat) && (
          <small className={late ? 'late' : ''}>
            {meta.charAt(0).toUpperCase() + meta.slice(1)}
            {task.repeat && (
              <span className="repeat-note">
                <Repeat2 size={13} className="inline-icon" /> {REPEAT_LABEL[task.repeat]}
              </span>
            )}
          </small>
        )}
      </div>
    </div>
  )
}
