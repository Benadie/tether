import { Plus, Repeat2, UserPlus } from 'lucide-react'
import { useStore } from '../data/store'
import type { Clerk, Task, TaskStatus } from '../data/types'
import { isoDate } from '../lib/dates'
import { Checkbox, ScreenHeader } from '../components/common'
import { STATUS_LABEL, useEditor } from '../components/Editor'
import { dueLabel, isLate } from '../components/TaskRow'
import type { Nav } from '../App'

const ORDER: TaskStatus[] = ['review', 'doing', 'todo']
const NEXT: Record<TaskStatus, TaskStatus> = { todo: 'doing', doing: 'review', review: 'todo' }
const AVATAR_COLOURS = ['#c2497a', '#7a4fb0', '#12625e', '#b5651d', '#1d3a8a', '#9c2f5e']

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

export function clerkColour(clerks: Clerk[], id?: string) {
  const i = clerks.findIndex((c) => c.id === id)
  return i < 0 ? 'var(--muted)' : AVATAR_COLOURS[i % AVATAR_COLOURS.length]
}

export function TeamScreen({ go }: { go: Nav }) {
  const { state } = useStore()
  const editor = useEditor()
  const today = isoDate(new Date())
  const open = state.tasks.filter((t) => t.assignee && !t.done)
  const forReview = open.filter((t) => t.status === 'review').length
  const openNotes = state.reviewNotes.filter((r) => r.status === 'open')

  return (
    <div className="screen">
      <ScreenHeader
        title="Team"
        subtitle={
          forReview
            ? `${forReview} ${forReview === 1 ? 'item is' : 'items are'} ready for your review. Tap a status to move it on.`
            : 'Who is working on what. Tap a status to move it on, tap a task to change it.'
        }
        right={
          <div className="row">
            <button className="chip" onClick={editor.newClerk}>
              <UserPlus size={18} /> Clerk
            </button>
            <button className="chip primary" onClick={() => editor.newTask({ assignee: state.clerks[0]?.id, status: 'todo' })}>
              <Plus size={18} /> Assign task
            </button>
          </div>
        }
      />

      {state.clerks.length === 0 ? (
        <section className="card empty-team">
          <h2>No clerks yet</h2>
          <p className="muted">Add the clerks you manage, then assign them tasks and review notes.</p>
          <button className="chip primary" onClick={editor.newClerk}>
            <UserPlus size={18} /> Add a clerk
          </button>
        </section>
      ) : (
        <div className="board">
          {state.clerks.map((c) => {
            const mine = open.filter((t) => t.assignee === c.id)
            const late = mine.filter((t) => isLate(t, today)).length
            const notes = openNotes.filter((r) => r.assignee === c.id).length
            return (
              <section key={c.id} className="card column">
                <button className="column-head" onClick={() => editor.editClerk(c)}>
                  <span className="avatar big" style={{ background: clerkColour(state.clerks, c.id) }}>
                    {initials(c.name)}
                  </span>
                  <span>
                    <b>{c.name}</b>
                    {c.role && <small>{c.role}</small>}
                  </span>
                </button>
                <div className="workload">
                  <span>{mine.length} open</span>
                  {late > 0 && <span className="late">{late} overdue</span>}
                  {notes > 0 && (
                    <button className="link small" onClick={() => go('reviews')}>
                      {notes} review {notes === 1 ? 'note' : 'notes'}
                    </button>
                  )}
                </div>
                <div className="column-body">
                  {mine.length === 0 && <p className="muted">Nothing assigned.</p>}
                  {ORDER.map((status) => {
                    const list = mine
                      .filter((t) => (t.status ?? 'todo') === status)
                      .sort((a, b) => (a.due ?? '9').localeCompare(b.due ?? '9'))
                    return list.length ? (
                      <div key={status} className="status-group">
                        <h3 className={status === 'review' ? 'needs-you' : ''}>{STATUS_LABEL[status]}</h3>
                        {list.map((t) => (
                          <TeamCard key={t.id} task={t} today={today} />
                        ))}
                      </div>
                    ) : null
                  })}
                </div>
                <button className="add-row" onClick={() => editor.newTask({ assignee: c.id, status: 'todo' })}>
                  <Plus size={18} /> Assign to {c.name.split(' ')[0]}
                </button>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}

function TeamCard({ task, today }: { task: Task; today: string }) {
  const { toggleTask, updateTask } = useStore()
  const editor = useEditor()
  const status = task.status ?? 'todo'
  const late = isLate(task, today)
  return (
    <div className={`team-card status-${status}`} onClick={() => editor.editTask(task)}>
      <Checkbox done={task.done} late={late} onToggle={() => toggleTask(task.id)} />
      <div>
        <b>{task.title}</b>
        <small className={late ? 'late' : ''}>
          {[task.client, task.due && dueLabel(task)].filter(Boolean).join(', ')}
          {task.repeat && <Repeat2 size={13} className="inline-icon" />}
        </small>
        <button
          className={`status-pill ${status}`}
          title="Tap to move on"
          onClick={(e) => {
            e.stopPropagation()
            updateTask(task.id, { status: NEXT[status] })
          }}
        >
          {STATUS_LABEL[status]}
        </button>
      </div>
    </div>
  )
}
