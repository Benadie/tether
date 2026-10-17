import { useState } from 'react'
import { useStore } from '../data/store'
import { daysBetween, fmtShort, isoDate, parseIsoDate } from '../lib/dates'
import { ScreenHeader } from '../components/common'
import { useEditor } from '../components/Editor'

export function WaitingScreen() {
  const { state, addWaiting, resolveWaiting, nudge } = useStore()
  const editor = useEditor()
  const [title, setTitle] = useState('')
  const [who, setWho] = useState('')
  const [email, setEmail] = useState('')
  const now = new Date()
  const open = state.waiting.filter((w) => !w.done).sort((a, b) => a.since.localeCompare(b.since))
  const done = state.waiting.filter((w) => w.done)

  return (
    <div className="screen">
      <ScreenHeader
        title="Waiting on a reply"
        subtitle="Things you asked for and are still waiting on. Nudge anyone who has gone quiet."
      />
      <div className="waiting-grid">
        <section className="card lists">
          {open.length === 0 && <p className="muted">Nothing outstanding.</p>}
          {open.map((w) => {
            const days = daysBetween(parseIsoDate(w.since), now)
            return (
              <div key={w.id} className="item wide tappable" onClick={() => editor.editWaiting(w)}>
                <span className="avatar">{w.who[0]}</span>
                <div>
                  <b>{w.title}</b>
                  <small className={days >= 4 ? 'late' : ''}>
                    {w.who}, {days} {days === 1 ? 'day' : 'days'}
                    {w.nudgedAt && `, nudged ${fmtShort(new Date(w.nudgedAt))}`}
                    {w.outlookId && ', from Outlook'}
                  </small>
                </div>
                <button className="chip outline" onClick={(e) => {
                    e.stopPropagation()
                    nudge(w.id)
                  }}>
                  Nudge
                </button>
                <button className="chip" onClick={(e) => {
                    e.stopPropagation()
                    resolveWaiting(w.id)
                  }}>
                  Got it
                </button>
              </div>
            )
          })}
          {done.length > 0 && <p className="muted">{done.length} answered</p>}
        </section>

        <form
          className="card add-form"
          onSubmit={(e) => {
            e.preventDefault()
            if (!title.trim() || !who.trim()) return
            addWaiting({ title: title.trim(), who: who.trim(), email: email.trim() || undefined, since: isoDate(now) })
            setTitle('')
            setWho('')
            setEmail('')
          }}
        >
          <h2>Add something you're waiting on</h2>
          <label>
            What
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Printer fault photos" />
          </label>
          <label>
            From who
            <input value={who} onChange={(e) => setWho(e.target.value)} placeholder="Branch" />
          </label>
          <label>
            Their email (for nudges)
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <button className="chip primary" type="submit">
            Add
          </button>
          <p className="muted">
            Tip: once Outlook is connected, put the <b>Waiting</b> category on an email you send and it appears here
            by itself.
          </p>
        </form>
      </div>
    </div>
  )
}
