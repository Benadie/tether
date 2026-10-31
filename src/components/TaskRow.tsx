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

/** Clerk tasks marked "Ready for review" on the Team board: they belong on your to-do list. */
export const readyForReview = (tasks: Task[]) =>
  tasks
    .filter((t) => t.assignee && !t.done && t.status === 'review')
    .sort((a, b) => (a.due ?? '9').localeCompare(b.due ?? '9'))

/** A clerk's task waiting for your review. Ticking it means reviewed: the task is done for the clerk too. */
export function ReviewRow({ task }: { task: Task }) {
  const { state, toggleTask } = useStore()
  const { editTask } = useEditor()
  const clerk = state.clerks.find((c) => c.id === task.assignee)
  const meta = [clerk ? `From ${clerk.name.split(' ')[0]}` : 'From the team', task.company ?? task.client, task.due && dueLabel(task)]
    .filter(Boolean)
    .join(', ')
  return (
    <div className="item tappable review-item" onClick={() => editTask(task)}>
      <Checkbox done={false} onToggle={() => toggleTask(task.id)} />
      <div>
        <b>Review: {task.title}</b>
        <small>{meta}</small>
      </div>
    </div>
  )
}

/** A task line: tick box, title, and when / who. Tap the row to edit it. */
export function TaskRow({ task, showDue = true }: { task: Task; showDue?: boolean }) {
  const { toggleTask } = useStore()
  const { editTask } = useEditor()
  const now = new Date()
  const late = isLate(task, isoDate(now))
  const meta = [showDue && dueLabel(task, now), task.time, task.company ?? task.client, task.from && `from ${task.from}`]
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
