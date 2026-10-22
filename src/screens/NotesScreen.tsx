import { useEffect, useRef, useState } from 'react'
import { Plus, Search, Trash2 } from 'lucide-react'
import { useStore } from '../data/store'
import { fmtShort, isoDate, parseIsoDate } from '../lib/dates'
import { ScreenHeader } from '../components/common'
import { InkPad } from '../components/InkPad'
import type { NotePage } from '../data/types'

const UNDO_MS = 8000

export function NotesScreen({ pageId, setPageId }: { pageId?: string; setPageId: (id: string) => void }) {
  const { state, newPage, savePage, deletePage } = useStore()
  const today = isoDate(new Date())
  const [query, setQuery] = useState('')
  // Deleting asks for a second tap; the page id that is waiting for it.
  const [armed, setArmed] = useState<string | null>(null)
  const [deleted, setDeleted] = useState<NotePage | null>(null)
  const undoTimer = useRef(0)
  const pages = [...state.pages].sort((a, b) => b.updated.localeCompare(a.updated))

  // Matches the title, typed text and what the handwriting reads as.
  const q = query.trim().toLowerCase()
  const shown = q
    ? pages.flatMap((p) => {
        const line = p.lines.find((l) => `${l.text} ${l.ocr ?? ''}`.toLowerCase().includes(q))
        if (line) return [{ page: p, hit: line.text.trim() || line.ocr || '' }]
        return pageTitle(p, today).toLowerCase().includes(q) ? [{ page: p, hit: '' }] : []
      })
    : pages.map((p) => ({ page: p, hit: '' }))
  const page = pages.find((p) => p.id === pageId) ?? shown[0]?.page ?? pages[0]

  useEffect(() => () => clearTimeout(undoTimer.current), [])

  // Disarm when you tap somewhere else.
  useEffect(() => {
    if (!armed) return
    const t = setTimeout(() => setArmed(null), 4000)
    return () => clearTimeout(t)
  }, [armed])

  function remove(p: NotePage) {
    if (armed !== p.id) return setArmed(p.id)
    setArmed(null)
    deletePage(p.id)
    setDeleted(p)
    clearTimeout(undoTimer.current)
    undoTimer.current = window.setTimeout(() => setDeleted(null), UNDO_MS)
    if (p.id === page?.id) {
      const next = pages.find((x) => x.id !== p.id)
      if (next) setPageId(next.id)
    }
  }

  function undo() {
    if (!deleted) return
    savePage(deleted)
    setPageId(deleted.id)
    setDeleted(null)
    clearTimeout(undoTimer.current)
  }

  return (
    <div className="screen">
      <ScreenHeader
        title="Notes"
        subtitle="Write with the pen or type. Any line can become a task or a reminder."
        right={
          <button className="btn-dark" onClick={() => setPageId(newPage().id)}>
            <Plus size={20} /> New page
          </button>
        }
      />

      <div className="notes-grid">
        <section className="card pages">
          <h2>Pages</h2>
          <label className="search">
            <Search size={18} />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search notes, handwriting too"
              aria-label="Search notes"
            />
          </label>
          <div className="page-list">
            {shown.map(({ page: p, hit }) => (
              <div key={p.id} className={`page-item${p.id === page?.id ? ' on' : ''}`}>
                <button className="page-open" onClick={() => setPageId(p.id)}>
                  <b>{pageTitle(p, today)}</b>
                  {hit ? (
                    <span className="search-hit">{hit}</span>
                  ) : (
                    <small>{pageSubtitle(p, state.tasks.filter((t) => t.noteRef?.pageId === p.id).length)}</small>
                  )}
                </button>
                <button
                  className={`page-delete${armed === p.id ? ' armed' : ''}`}
                  aria-label={armed === p.id ? `Tap again to delete ${pageTitle(p, today)}` : `Delete ${pageTitle(p, today)}`}
                  onClick={() => remove(p)}
                >
                  {armed === p.id ? 'Delete?' : <Trash2 size={18} />}
                </button>
              </div>
            ))}
            {q && shown.length === 0 && <p className="muted hint">Nothing matches “{query}”.</p>}
          </div>
          {deleted ? (
            <div className="undo-bar">
              <span>“{pageTitle(deleted, today)}” deleted</span>
              <button className="chip small" onClick={undo}>
                Undo
              </button>
            </div>
          ) : (
            <p className="muted hint">A page linked to an email shows up on that task too.</p>
          )}
        </section>

        {page ? (
          <InkPad
            variant="full"
            page={page}
            minRows={14}
            heading={
              <>
                {page.day ? (
                  <h2>{pageTitle(page, today)}</h2>
                ) : (
                  <input
                    className="title-input"
                    value={page.title}
                    aria-label="Page title"
                    onChange={(e) => savePage({ ...page, title: e.target.value })}
                  />
                )}
                <span className="muted">{fmtShort(new Date(page.created))}</span>
              </>
            }
            extra={
              <button
                className={`chip danger small${armed === page.id ? ' armed' : ''}`}
                aria-label="Delete page"
                onClick={() => remove(page)}
              >
                <Trash2 size={16} /> {armed === page.id ? 'Tap again to delete' : 'Delete'}
              </button>
            }
          />
        ) : (
          <section className="card empty">No pages yet. Tap New page to start one.</section>
        )}
      </div>
    </div>
  )
}

function pageTitle(p: NotePage, today: string) {
  if (!p.day) return p.title || 'Untitled page'
  return p.day === today ? 'Today' : fmtShort(parseIsoDate(p.day))
}

function pageSubtitle(p: NotePage, tasks: number) {
  if (p.linkedEmail) return `Linked to an email from ${p.linkedEmail}`
  const date = fmtShort(new Date(p.created))
  if (tasks) return `${date}, ${tasks} ${tasks === 1 ? 'task' : 'tasks'} made`
  if (p.day) {
    const n = p.lines.filter((l) => l.text.trim() || l.strokes.length).length
    return `${date}, ${n} ${n === 1 ? 'note' : 'notes'}`
  }
  return date
}
