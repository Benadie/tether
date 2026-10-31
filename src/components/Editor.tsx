import { createContext, useContext, useState, type FormEvent, type ReactNode } from 'react'
import { Trash2 } from 'lucide-react'
import { useStore } from '../data/store'
import type { CalEvent, Clerk, Repeat, Task, TaskStatus, VatClient, VatCycle } from '../data/types'
import { CYCLE_HINT, CYCLE_LABEL } from '../lib/vat'
import { at, hhmm, isoDate, pad, parseIsoDate } from '../lib/dates'
import { DateInput } from './DateInput'

// One place that opens the add/edit dialogs, so any screen can say
// "edit this task" or "add an event on this day".
type Open =
  | { kind: 'task'; task?: Task; initial?: Partial<Task> }
  | { kind: 'event'; event?: CalEvent; date?: string }
  | { kind: 'clerk'; clerk?: Clerk }
  | { kind: 'vat'; vat?: VatClient; cycle?: VatCycle }

type EditorApi = {
  editTask: (task: Task) => void
  newTask: (initial?: Partial<Task>) => void
  editEvent: (event: CalEvent) => void
  newEvent: (date?: string) => void
  editClerk: (clerk: Clerk) => void
  newClerk: () => void
  editVatClient: (vat: VatClient) => void
  newVatClient: (cycle?: VatCycle) => void
}

export const STATUS_LABEL: Record<TaskStatus, string> = {
  todo: 'Not started',
  doing: 'In progress',
  review: 'Ready for review',
}

const Ctx = createContext<EditorApi | null>(null)
export const useEditor = () => useContext(Ctx)!

export function EditorProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState<Open | null>(null)
  const close = () => setOpen(null)

  const api: EditorApi = {
    editTask: (task) => setOpen({ kind: 'task', task }),
    newTask: (initial) => setOpen({ kind: 'task', initial }),
    editEvent: (event) => setOpen({ kind: 'event', event }),
    newEvent: (date) => setOpen({ kind: 'event', date }),
    editClerk: (clerk) => setOpen({ kind: 'clerk', clerk }),
    newClerk: () => setOpen({ kind: 'clerk' }),
    editVatClient: (vat) => setOpen({ kind: 'vat', vat }),
    newVatClient: (cycle) => setOpen({ kind: 'vat', cycle }),
  }

  return (
    <Ctx.Provider value={api}>
      {children}
      {open?.kind === 'task' && <TaskDialog task={open.task} initial={open.initial} onClose={close} />}
      {open?.kind === 'event' && <EventDialog event={open.event} date={open.date} onClose={close} />}
      {open?.kind === 'clerk' && <ClerkDialog clerk={open.clerk} onClose={close} />}
      {open?.kind === 'vat' && <VatClientDialog vat={open.vat} cycle={open.cycle} onClose={close} />}
    </Ctx.Provider>
  )
}

function Shell(props: {
  title: string
  onClose: () => void
  onSubmit: () => void
  onDelete?: () => void
  saveLabel: string
  children: ReactNode
}) {
  // Delete asks for a second tap instead of a pop-up.
  const [armed, setArmed] = useState(false)
  const submit = (e: FormEvent) => {
    e.preventDefault()
    props.onSubmit()
  }
  return (
    <div className="scrim" onPointerDown={props.onClose}>
      <form className="dialog" onPointerDown={(e) => e.stopPropagation()} onSubmit={submit}>
        <h2>{props.title}</h2>
        {props.children}
        <div className="dialog-actions">
          {props.onDelete && (
            <button
              type="button"
              className={`chip danger${armed ? ' armed' : ''}`}
              onClick={() => {
                if (!armed) return setArmed(true)
                props.onDelete!()
                props.onClose()
              }}
            >
              <Trash2 size={18} /> {armed ? 'Tap again to delete' : 'Delete'}
            </button>
          )}
          <button type="button" className="chip" onClick={props.onClose}>
            Cancel
          </button>
          <button type="submit" className="chip primary">
            {props.saveLabel}
          </button>
        </div>
      </form>
    </div>
  )
}

function TaskDialog({ task, initial, onClose }: { task?: Task; initial?: Partial<Task>; onClose: () => void }) {
  const store = useStore()
  const base = task ?? initial
  const [title, setTitle] = useState(base?.title ?? '')
  const [due, setDue] = useState(base?.due ?? (task ? '' : isoDate(new Date())))
  const [time, setTime] = useState(base?.time ?? '')
  const [from, setFrom] = useState(base?.from ?? '')
  const [client, setClient] = useState(base?.client ?? '')
  const [assignee, setAssignee] = useState(base?.assignee ?? '')
  const [status, setStatus] = useState<TaskStatus>(base?.status ?? 'todo')
  const [repeat, setRepeat] = useState<Repeat | ''>(base?.repeat ?? '')

  function save() {
    if (!title.trim()) return
    const fields: Partial<Task> = {
      title: title.trim(),
      due: due || undefined,
      time: (due && time) || undefined,
      from: from.trim() || undefined,
      client: client.trim() || undefined,
      assignee: assignee || undefined,
      status: assignee ? status : undefined,
      repeat: repeat || undefined,
    }
    if (task) store.updateTask(task.id, fields)
    else store.addTask({ ...fields, title: fields.title!, source: 'local' })
    onClose()
  }

  return (
    <Shell
      title={task ? 'Edit task' : 'New task'}
      onClose={onClose}
      onSubmit={save}
      onDelete={task ? () => store.deleteTask(task.id) : undefined}
      saveLabel={task ? 'Save' : 'Add task'}
    >
      <label>
        What needs doing
        <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Review bank reconciliation, Harlow" />
      </label>
      <div className="row">
        <label>
          Due day (optional)
          <DateInput value={due} onChange={setDue} placeholder="No date" />
        </label>
        <label>
          Time (optional)
          <input type="time" value={time} disabled={!due} onChange={(e) => setTime(e.target.value)} />
        </label>
      </div>
      <div className="row">
        <label>
          Client
          <ClientInput value={client} onChange={setClient} />
        </label>
        <label>
          Asked by (optional)
          <input value={from} onChange={(e) => setFrom(e.target.value)} placeholder="e.g. Audit partner" />
        </label>
      </div>
      <div className="row">
        <label>
          Assigned to
          <select value={assignee} onChange={(e) => setAssignee(e.target.value)}>
            <option value="">Me</option>
            {store.state.clerks.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        {assignee && (
          <label>
            Status
            <select value={status} onChange={(e) => setStatus(e.target.value as TaskStatus)}>
              {Object.entries(STATUS_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          Repeats
          <select value={repeat} onChange={(e) => setRepeat(e.target.value as Repeat | '')}>
            <option value="">Never</option>
            <option value="weekly">Every week</option>
            <option value="monthly">Every month</option>
            <option value="yearly">Every year</option>
          </select>
        </label>
      </div>
    </Shell>
  )
}

function EventDialog({ event, date, onClose }: { event?: CalEvent; date?: string; onClose: () => void }) {
  const store = useStore()
  const start = event ? new Date(event.start) : null
  const end = event ? new Date(event.end) : null
  const [title, setTitle] = useState(event?.title ?? '')
  const [day, setDay] = useState(start ? isoDate(start) : (date ?? isoDate(new Date())))
  const [from, setFrom] = useState(start ? hhmm(start) : '09:00')
  const [to, setTo] = useState(end ? hhmm(end) : '10:00')

  function save() {
    if (!title.trim()) return
    const d = parseIsoDate(day)
    let until = to
    if (until <= from) {
      // End before start: make it an hour long.
      const [h, m] = from.split(':').map(Number)
      until = `${pad(Math.min(23, h + 1))}:${pad(m)}`
    }
    const fields = { title: title.trim(), start: at(d, from), end: at(d, until) }
    if (event) store.updateEvent(event.id, fields)
    else store.addEvent({ ...fields, source: 'local' })
    onClose()
  }

  return (
    <Shell
      title={event ? 'Edit event' : 'New event'}
      onClose={onClose}
      onSubmit={save}
      onDelete={event ? () => store.deleteEvent(event.id) : undefined}
      saveLabel={event ? 'Save' : 'Add event'}
    >
      <label>
        What
        <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Client meeting, Oakfield Trust" />
      </label>
      <div className="row">
        <label>
          Day
          <DateInput value={day} onChange={(v) => v && setDay(v)} />
        </label>
        <label>
          Start
          <input type="time" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label>
          End
          <input type="time" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
      </div>
    </Shell>
  )
}

/** Free text with suggestions from clients already used in tasks. */
function ClientInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { state } = useStore()
  const clients = [...new Set([...state.tasks.map((t) => t.client), ...state.vatClients.map((v) => v.client)])]
    .filter(Boolean)
    .sort() as string[]
  return (
    <>
      <input list="known-clients" value={value} onChange={(e) => onChange(e.target.value)} placeholder="e.g. Harlow Logistics" />
      <datalist id="known-clients">
        {clients.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
    </>
  )
}

/** Suggestions for a name box: clerks plus names already used on the VAT list. */
function NameInput(props: { id: string; value: string; onChange: (v: string) => void; extra: string[]; placeholder?: string }) {
  const { state } = useStore()
  const names = [...new Set([...state.clerks.map((c) => c.name.split(' ')[0]), ...props.extra])].filter(Boolean).sort()
  return (
    <>
      <input list={props.id} value={props.value} onChange={(e) => props.onChange(e.target.value)} placeholder={props.placeholder} />
      <datalist id={props.id}>
        {names.map((n) => (
          <option key={n} value={n} />
        ))}
      </datalist>
    </>
  )
}

function VatClientDialog({ vat, cycle, onClose }: { vat?: VatClient; cycle?: VatCycle; onClose: () => void }) {
  const store = useStore()
  const list = store.state.vatClients
  const [client, setClient] = useState(vat?.client ?? '')
  const [period, setPeriod] = useState<VatCycle>(vat?.cycle ?? cycle ?? 'monthly')
  const [responsible, setResponsible] = useState(vat?.responsible ?? '')
  const [manager, setManager] = useState(vat?.portfolioManager ?? '')
  const [notes, setNotes] = useState(vat?.notes ?? '')

  function save() {
    if (!client.trim()) return
    const fields = {
      client: client.trim(),
      cycle: period,
      responsible: responsible.trim() || undefined,
      portfolioManager: manager.trim() || undefined,
      notes: notes.trim() || undefined,
    }
    if (vat) store.updateVatClient(vat.id, fields)
    else store.addVatClient(fields)
    onClose()
  }

  return (
    <Shell
      title={vat ? 'VAT client' : 'Add a VAT client'}
      onClose={onClose}
      onSubmit={save}
      onDelete={vat ? () => store.removeVatClient(vat.id) : undefined}
      saveLabel={vat ? 'Save' : 'Add client'}
    >
      <label>
        Client
        <ClientInput value={client} onChange={setClient} />
      </label>
      <div className="row">
        <label>
          Period
          <select value={period} onChange={(e) => setPeriod(e.target.value as VatCycle)}>
            {(Object.keys(CYCLE_LABEL) as VatCycle[]).map((c) => (
              <option key={c} value={c}>
                {CYCLE_LABEL[c]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Responsible
          <NameInput id="vat-responsible" value={responsible} onChange={setResponsible} extra={list.map((v) => v.responsible ?? '')} placeholder="e.g. Lyrisha" />
        </label>
        <label>
          Portfolio manager
          <NameInput id="vat-manager" value={manager} onChange={setManager} extra={list.map((v) => v.portfolioManager ?? '')} placeholder="e.g. Chane" />
        </label>
      </div>
      <p className="muted small-note">{CYCLE_HINT[period]}</p>
      <label>
        Notes
        <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Processing; VAT; payroll" />
      </label>
      {vat && <p className="muted small-note">Removing a client takes them off the VAT list; their past ticks are kept.</p>}
    </Shell>
  )
}

function ClerkDialog({ clerk, onClose }: { clerk?: Clerk; onClose: () => void }) {
  const store = useStore()
  const [name, setName] = useState(clerk?.name ?? '')
  const [role, setRole] = useState(clerk?.role ?? '')
  const open = clerk ? store.state.tasks.filter((t) => t.assignee === clerk.id && !t.done).length : 0

  function save() {
    if (!name.trim()) return
    const fields = { name: name.trim(), role: role.trim() || undefined }
    if (clerk) store.updateClerk(clerk.id, fields)
    else store.addClerk(fields)
    onClose()
  }

  return (
    <Shell
      title={clerk ? 'Edit clerk' : 'Add a clerk'}
      onClose={onClose}
      onSubmit={save}
      onDelete={clerk ? () => store.deleteClerk(clerk.id) : undefined}
      saveLabel={clerk ? 'Save' : 'Add clerk'}
    >
      <label>
        Name
        <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Aisha Patel" />
      </label>
      <label>
        Role (optional)
        <input value={role} onChange={(e) => setRole(e.target.value)} placeholder="e.g. Trainee, year 2" />
      </label>
      {clerk && open > 0 && <p className="muted">If you remove {clerk.name}, their {open} open tasks come back to you.</p>}
    </Shell>
  )
}
