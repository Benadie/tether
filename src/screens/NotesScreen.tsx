import { Plus, Trash2 } from 'lucide-react'
import { useStore } from '../data/store'
import { fmtShort, isoDate, parseIsoDate } from '../lib/dates'
import { ScreenHeader } from '../components/common'
import { InkPad } from '../components/InkPad'
import type { NotePage } from '../data/types'

export function NotesScreen({ pageId, setPageId }: { pageId?: string; setPageId: (id: string) => void }) {
  const { state, newPage, savePage, deletePage } = useStore()
  const today = isoDate(new Date())
  const pages = [...state.pages].sort((a, b) => b.updated.localeCompare(a.updated))
  const page = pages.find((p) => p.id === pageId) ?? pages[0]

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
          <div className="page-list">
            {pages.map((p) => (
              <button key={p.id} className={`page-item${p.id === page?.id ? ' on' : ''}`} onClick={() => setPageId(p.id)}>
                <b>{pageTitle(p, today)}</b>
                <small>{pageSubtitle(p, state.tasks.filter((t) => t.noteRef?.pageId === p.id).length)}</small>
              </button>
            ))}
          </div>
          <p className="muted hint">A page linked to an email shows up on that task too.</p>
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
              !page.day && (
                <button
                  className="round ghost"
                  aria-label="Delete page"
                  onClick={() => confirm(`Delete "${page.title}"?`) && deletePage(page.id)}
                >
                  <Trash2 size={18} />
                </button>
              )
            }
          />
        ) : (
          <section className="card empty">No pages yet.</section>
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
