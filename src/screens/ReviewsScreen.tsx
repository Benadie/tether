import { useState, type MouseEvent } from 'react'
import { Plus } from 'lucide-react'
import { useStore } from '../data/store'
import type { ReviewNote, ReviewStatus } from '../data/types'
import { daysBetween, fmtDmy, parseIsoDate } from '../lib/dates'
import { ScreenHeader } from '../components/common'
import { useEditor } from '../components/Editor'
import { clerkColour, initials } from './TeamScreen'

type Filter = ReviewStatus | 'all'

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'open', label: 'Open' },
  { id: 'cleared', label: 'Cleared, needs sign-off' },
  { id: 'signed', label: 'Signed off' },
  { id: 'all', label: 'All' },
]

/** Open longer than this shows in red */
const AGEING_DAYS = 5

export function ReviewsScreen() {
  const { state } = useStore()
  const editor = useEditor()
  const now = new Date()
  const [filter, setFilter] = useState<Filter>('open')
  const [client, setClient] = useState('')

  const notes = state.reviewNotes
  const clients = [...new Set(notes.map((n) => n.client))].sort()
  const shown = notes.filter((n) => (filter === 'all' || n.status === filter) && (!client || n.client === client))
  const byClient = clients
    .map((c) => [c, shown.filter((n) => n.client === c).sort((a, b) => a.raised.localeCompare(b.raised))] as const)
    .filter(([, list]) => list.length)

  const open = notes.filter((n) => n.status === 'open')
  const toSign = notes.filter((n) => n.status === 'cleared')
  const age = (n: ReviewNote) => daysBetween(parseIsoDate(n.raised), now)

  return (
    <div className="screen">
      <ScreenHeader
        title="Review notes"
        subtitle={`${open.length} open, ${toSign.length} cleared and waiting for your sign-off.`}
        right={
          <button className="chip primary" onClick={() => editor.newReview({ client })}>
            <Plus size={18} /> Review note
          </button>
        }
      />

      <div className="reviews-grid">
        <section className="card lists reviews-main">
          <div className="filters">
            {FILTERS.map((f) => {
              const count = f.id === 'all' ? notes.length : notes.filter((n) => n.status === f.id).length
              return (
                <button key={f.id} className={`filter${filter === f.id ? ' on' : ''}`} onClick={() => setFilter(f.id)}>
                  {f.label}
                  <i>{count}</i>
                </button>
              )
            })}
            <select className="filter-select" value={client} onChange={(e) => setClient(e.target.value)} aria-label="Client">
              <option value="">All clients</option>
              {clients.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="dash-list">
            {byClient.length === 0 && <p className="muted empty-note">Nothing here.</p>}
            {byClient.map(([c, list]) => (
              <div key={c} className="task-group">
                <h3>{c}</h3>
                {list.map((n) => (
                  <ReviewRow key={n.id} note={n} age={age(n)} />
                ))}
              </div>
            ))}
          </div>
        </section>

        <div className="dash-side">
          <section className="card lists">
            <h2>By clerk</h2>
            {[...state.clerks.map((c) => c.id), undefined].map((id) => {
              const theirs = open.filter((n) => n.assignee === id)
              const cleared = toSign.filter((n) => n.assignee === id).length
              if (!theirs.length && !cleared) return null
              const clerk = state.clerks.find((c) => c.id === id)
              const oldest = Math.max(0, ...theirs.map(age))
              return (
                <div key={id ?? 'me'} className="item">
                  <span className="avatar" style={{ background: clerkColour(state.clerks, id), color: '#fff' }}>
                    {clerk ? initials(clerk.name) : 'Me'}
                  </span>
                  <div>
                    <b>{clerk?.name ?? 'You'}</b>
                    <small className={oldest >= AGEING_DAYS ? 'late' : ''}>
                      {theirs.length} open{theirs.length ? `, oldest ${oldest} ${oldest === 1 ? 'day' : 'days'}` : ''}
                      {cleared ? `, ${cleared} to sign off` : ''}
                    </small>
                  </div>
                </div>
              )
            })}
            {open.length + toSign.length === 0 && <p className="muted">All review notes are signed off.</p>}
          </section>

          <section className="card lists">
            <h2>By client</h2>
            {clients.map((c) => {
              const o = open.filter((n) => n.client === c)
              const s = toSign.filter((n) => n.client === c).length
              return (
                <button key={c} className="note-row" onClick={() => setClient(client === c ? '' : c)}>
                  <b>{c}</b>
                  <small className={o.some((n) => age(n) >= AGEING_DAYS) ? 'late' : ''}>
                    {o.length ? `${o.length} open` : 'Nothing open'}
                    {s ? `, ${s} to sign off` : ''}
                    {!o.length && !s ? ', ready to sign' : ''}
                  </small>
                </button>
              )
            })}
          </section>
        </div>
      </div>
    </div>
  )
}

function ReviewRow({ note, age }: { note: ReviewNote; age: number }) {
  const { state, setReviewStatus } = useStore()
  const editor = useEditor()
  const clerk = state.clerks.find((c) => c.id === note.assignee)
  const act = (status: ReviewStatus) => (e: MouseEvent) => {
    e.stopPropagation()
    setReviewStatus(note.id, status)
  }

  return (
    <div className={`review-row ${note.status}`} onClick={() => editor.editReview(note)}>
      <span className="avatar" style={{ background: clerkColour(state.clerks, note.assignee), color: '#fff' }}>
        {clerk ? initials(clerk.name) : 'Me'}
      </span>
      <div>
        <b>{note.text}</b>
        <small className={note.status === 'open' && age >= AGEING_DAYS ? 'late' : ''}>
          {clerk?.name ?? 'You'}, raised {fmtDmy(parseIsoDate(note.raised))}
          {note.status === 'open' && `, open ${age} ${age === 1 ? 'day' : 'days'}`}
          {note.status === 'signed' && note.signedAt && `, signed off ${fmtDmy(new Date(note.signedAt))}`}
        </small>
        {note.response && <span className="response">â€œ{note.response}â€</span>}
      </div>
      <div className="review-actions">
        {note.status === 'open' && (
          <button className="chip small" onClick={act('cleared')}>
            Mark cleared
          </button>
        )}
        {note.status === 'cleared' && (
          <>
            <button className="chip small primary" onClick={act('signed')}>
              Sign off
            </button>
            <button className="chip small" onClick={act('open')}>
              Reopen
            </button>
          </>
        )}
        {note.status === 'signed' && (
          <button className="chip small" onClick={act('open')}>
            Reopen
          </button>
        )}
      </div>
    </div>
  )
}
