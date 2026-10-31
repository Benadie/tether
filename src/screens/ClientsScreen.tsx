import { useMemo, useState } from 'react'
import { Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { useStore } from '../data/store'
import type { Client } from '../data/types'
import { isoDate } from '../lib/dates'
import { ScreenHeader } from '../components/common'
import { useEditor } from '../components/Editor'
import { TaskRow } from '../components/TaskRow'
import { InkPad } from '../components/InkPad'

/** Clients and groups: which companies a group has, what's to do and when, and notes. */
export function ClientsScreen() {
  const { state } = useStore()
  const editor = useEditor()
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | undefined>(() => {
    try {
      return localStorage.getItem('tether-client') ?? undefined
    } catch {
      return undefined
    }
  })
  const select = (id: string) => {
    setSelectedId(id)
    try {
      localStorage.setItem('tether-client', id)
    } catch {
      /* not critical */
    }
  }

  const today = isoDate(new Date())
  const openByClient = useMemo(() => {
    const m = new Map<string, { open: number; late: number }>()
    for (const t of state.tasks) {
      if (!t.clientId || t.done) continue
      const e = m.get(t.clientId) ?? { open: 0, late: 0 }
      e.open++
      if (t.due && t.due < today) e.late++
      m.set(t.clientId, e)
    }
    return m
  }, [state.tasks, today])

  // Search matches the client, its code, or any company in the group.
  const q = query.trim().toLowerCase()
  const sorted = [...state.clients].sort((a, b) => a.name.localeCompare(b.name))
  const shown = q
    ? sorted.filter((c) => [c.name, c.code ?? '', ...c.companies.map((x) => x.name)].some((s) => s.toLowerCase().includes(q)))
    : sorted
  const selected = state.clients.find((c) => c.id === selectedId) ?? shown[0]

  const dueSoon = state.tasks.filter((t) => t.clientId && !t.done && t.due && t.due <= isoDate(new Date(Date.now() + 7 * 86_400_000))).length

  return (
    <div className="screen">
      <ScreenHeader
        title="Clients"
        subtitle={
          state.clients.length
            ? `${state.clients.length} ${state.clients.length === 1 ? 'client' : 'clients'}, ${dueSoon} ${dueSoon === 1 ? 'thing' : 'things'} due in the next 7 days.`
            : 'Your clients and groups: their companies, what to do and when, and notes.'
        }
        right={
          <button className="chip primary" onClick={() => editor.newClient((c) => select(c.id))}>
            <Plus size={18} /> Client
          </button>
        }
      />

      <div className="clients-grid">
        <section className="card client-list">
          <label className="search">
            <Search size={18} />
            <input
              id="client-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search clients or companies"
              aria-label="Search clients"
            />
          </label>
          <div className="client-rows">
            {shown.map((c, i) => {
              const letter = c.name[0]?.toUpperCase() ?? '#'
              const showLetter = !q && letter !== shown[i - 1]?.name[0]?.toUpperCase()
              const counts = openByClient.get(c.id)
              return (
                <div key={c.id}>
                  {showLetter && <div className="letter">{letter}</div>}
                  <button className={`client-row${c.id === selected?.id ? ' on' : ''}`} onClick={() => select(c.id)}>
                    <span className="client-name">
                      <b>{c.name}</b>
                      <small>
                        {[c.code, c.companies.length ? `${c.companies.length} ${c.companies.length === 1 ? 'company' : 'companies'}` : '']
                          .filter(Boolean)
                          .join(' · ')}
                      </small>
                    </span>
                    {counts && (
                      <span className={`count${counts.late ? ' late' : ''}`} title={counts.late ? `${counts.late} overdue` : 'Open tasks'}>
                        {counts.open}
                      </span>
                    )}
                  </button>
                </div>
              )
            })}
            {q && shown.length === 0 && <p className="muted hint">No client or company matches “{query}”.</p>}
            {!state.clients.length && (
              <div className="vat-empty">
                <p className="muted">No clients yet.</p>
                <button className="chip primary" onClick={() => editor.newClient((c) => select(c.id))}>
                  <Plus size={18} /> Add a client
                </button>
              </div>
            )}
          </div>
        </section>

        {selected ? <ClientPage key={selected.id} client={selected} /> : <section className="card empty">Add a client to get started.</section>}
      </div>
    </div>
  )
}

function ClientPage({ client }: { client: Client }) {
  const store = useStore()
  const editor = useEditor()
  const [newCompany, setNewCompany] = useState('')
  const [showDone, setShowDone] = useState(false)
  const [armed, setArmed] = useState<string | null>(null)

  const tasks = store.state.tasks
    .filter((t) => t.clientId === client.id)
    .sort((a, b) => (a.due ?? '9999').localeCompare(b.due ?? '9999'))
  const open = tasks.filter((t) => !t.done)
  const done = tasks.filter((t) => t.done)

  function addCompany() {
    if (!newCompany.trim()) return
    store.addCompany(client.id, newCompany.trim())
    setNewCompany('')
  }

  return (
    <div className="client-page">
      <section className="card client-main">
        <div className="client-head">
          <div>
            <h2>{client.name}</h2>
            <small className="muted">
              {[client.code, client.companies.length ? `Group of ${client.companies.length}` : 'Single company'].filter(Boolean).join(' · ')}
            </small>
          </div>
          <button className="round ghost" aria-label="Edit client" onClick={() => editor.editClient(client)}>
            <Pencil size={18} />
          </button>
        </div>

        <div className="client-section">
          <div className="group-head">
            <h3>Tasks and due dates</h3>
            <button className="chip small" onClick={() => editor.newTask({ client: client.name, clientId: client.id })}>
              <Plus size={16} /> Task
            </button>
          </div>
          {open.length === 0 && <p className="muted small-note">Nothing to do. Add a task, e.g. “Audit due” at the end of the month.</p>}
          {open.map((t) => (
            <TaskRow key={t.id} task={t} />
          ))}
          {done.length > 0 && (
            <button className="link small" onClick={() => setShowDone(!showDone)}>
              {showDone ? 'Hide' : 'Show'} {done.length} done
            </button>
          )}
          {showDone && done.map((t) => <TaskRow key={t.id} task={t} />)}
        </div>

        <div className="client-section">
          <h3>Companies in the group</h3>
          {client.companies.length === 0 && <p className="muted small-note">A single company. Add the companies if this is a group.</p>}
          {client.companies.map((co) => (
            <div key={co.id} className="company-row">
              <span className="company-name">{co.name}</span>
              <input
                className="company-note"
                id={`company-note-${co.id}`}
                value={co.note ?? ''}
                placeholder="Note"
                aria-label={`Note for ${co.name}`}
                onChange={(e) => store.updateCompany(client.id, co.id, { note: e.target.value || undefined })}
              />
              <button
                className={`page-delete${armed === co.id ? ' armed' : ''}`}
                aria-label={armed === co.id ? `Tap again to remove ${co.name}` : `Remove ${co.name}`}
                onClick={() => {
                  if (armed !== co.id) return setArmed(co.id)
                  store.removeCompany(client.id, co.id)
                  setArmed(null)
                }}
              >
                {armed === co.id ? 'Remove?' : <Trash2 size={16} />}
              </button>
            </div>
          ))}
          <form
            className="company-add"
            onSubmit={(e) => {
              e.preventDefault()
              addCompany()
            }}
          >
            <input
              id="new-company"
              value={newCompany}
              onChange={(e) => setNewCompany(e.target.value)}
              placeholder="Add a company, e.g. Moretti Properties (Pty) Ltd"
              aria-label="Add a company"
            />
            <button className="chip small" type="submit">
              Add
            </button>
          </form>
        </div>
      </section>

      <InkPad variant="card" page={store.clientPage(client.id)} heading={<h2>Notes</h2>} minRows={10} />
    </div>
  )
}
