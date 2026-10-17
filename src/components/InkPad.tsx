import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { getStroke } from 'perfect-freehand'
import { Calendar, Check, Eraser, Highlighter, Keyboard, Link2, Bell, Mail, Pencil, Type, Undo2 } from 'lucide-react'
import { useStore } from '../data/store'
import type { LineTag, NoteLine, NotePage, Stroke } from '../data/types'
import { at, fmtShort, hhmm, parseIsoDate, sameDay } from '../lib/dates'
import { uid } from '../lib/id'
import { handwritingAvailable, recognize } from '../lib/handwriting'
import * as outlook from '../sync/outlook'
import { ActionDialog, type ActionKind, type ActionResult } from './ActionDialog'
import { ColorPicker, INK_SWATCHES } from './ColorPicker'

export const LINE_H = 50
export const DEFAULT_INK = '#1d3a8a'
const HIGHLIGHT = 'rgba(244, 114, 182, 0.35)'

type Tool = 'pen' | 'highlighter' | 'eraser' | 'type'

type Gesture =
  | { kind: 'draw'; id: number; simulate: boolean }
  | { kind: 'erase'; id: number }
  | { kind: 'touch'; id: number; startY: number; lastY: number; moved: boolean }

/* ---------- Ink rendering ---------- */

function outlineToPath(points: number[][]) {
  if (!points.length) return ''
  const d: (string | number)[] = ['M', ...points[0], 'Q']
  points.forEach(([x0, y0], i) => {
    const [x1, y1] = points[(i + 1) % points.length]
    d.push(x0.toFixed(1), y0.toFixed(1), ((x0 + x1) / 2).toFixed(1), ((y0 + y1) / 2).toFixed(1))
  })
  d.push('Z')
  return d.join(' ')
}

function strokePath(points: number[], tool: Stroke['tool'], size: number, simulate: boolean) {
  const pts: number[][] = []
  for (let i = 0; i < points.length; i += 3) pts.push([points[i], points[i + 1], points[i + 2]])
  return outlineToPath(
    getStroke(pts, {
      size,
      thinning: tool === 'pen' ? 0.6 : 0,
      smoothing: 0.5,
      streamline: 0.35,
      simulatePressure: simulate,
      last: true,
    }),
  )
}

const inkRight = (line: NoteLine) => {
  let max = 0
  for (const s of line.strokes) for (let i = 0; i < s.points.length; i += 3) max = Math.max(max, s.points[i])
  return max
}

const isEmpty = (l?: NoteLine) => !l || (!l.text.trim() && !l.strokes.length)

const blankLine = (): NoteLine => ({ id: uid(), text: '', strokes: [], tags: [] })

function padLines(lines: NoteLine[], n: number) {
  const out = lines.slice()
  while (out.length < n) out.push(blankLine())
  return out
}

/* ---------- Component ---------- */

export function InkPad(props: {
  page: NotePage
  variant: 'full' | 'card'
  heading: ReactNode
  extra?: ReactNode
  minRows?: number
}) {
  const { page, variant } = props
  const store = useStore()
  const ink = store.state.settings.inkColor ?? DEFAULT_INK
  const [tool, setTool] = useState<Tool>('pen')
  const [inkOpen, setInkOpen] = useState(false)
  const [selected, setSelected] = useState<number | null>(null)
  const [live, setLive] = useState<{ points: number[]; tool: Stroke['tool']; simulate: boolean } | null>(null)
  const [dialog, setDialog] = useState<{ kind: ActionKind; row: number; title: string } | null>(null)

  const paperRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const gesture = useRef<Gesture | null>(null)
  const points = useRef<number[]>([])
  const frame = useRef(0)
  const working = useRef<NoteLine[]>(page.lines)
  const history = useRef<NoteLine[][]>([])
  const latest = useRef(page)
  latest.current = page
  const ocrTimers = useRef(new Map<string, number>())
  const [notice, setNotice] = useState('')

  // Switching pages resets selection and undo.
  useEffect(() => {
    setSelected(null)
    history.current = []
  }, [page.id])

  useEffect(() => () => ocrTimers.current.forEach((t) => clearTimeout(t)), [])

  // Settings › Handwriting: turn lines into typed text (default) or keep the ink.
  const convertMode = useRef(true)
  convertMode.current = (store.state.settings.handwriting ?? 'convert') === 'convert'

  /**
   * A moment after you stop writing on a line, reads the handwriting and either turns it into
   * typed text (Undo brings the ink back) or keeps the ink and stores the words for search.
   */
  function scheduleOcr(lineId: string) {
    if (!handwritingAvailable()) return
    const timers = ocrTimers.current
    clearTimeout(timers.get(lineId))
    const pageId = page.id
    timers.set(
      lineId,
      window.setTimeout(
        async () => {
          timers.delete(lineId)
          const line = latest.current.lines.find((l) => l.id === lineId)
          if (!line) return
          const pen = line.strokes.filter((s) => s.tool === 'pen')
          if (!pen.length) {
            if (line.ocr) store.setLineOcr(pageId, lineId, undefined)
            return
          }
          const text = await recognize(line.strokes)
          if (convertMode.current) {
            if (!text) {
              flash("Couldn't read that line. Try writing a little larger.")
              return
            }
            history.current.push(latest.current.lines)
            store.convertLineInk(pageId, lineId, pen.map((s) => s.id), text)
            return
          }
          if ((text ?? undefined) !== line.ocr) store.setLineOcr(pageId, lineId, text ?? undefined)
        },
        // A little longer when converting, so a pause between words doesn't cut a line in half.
        convertMode.current ? 1600 : 1200,
      ),
    )
  }

  function flash(message: string) {
    setNotice(message)
    window.setTimeout(() => setNotice(''), 3500)
  }

  const rows = Math.max(props.minRows ?? 12, page.lines.length + 4)
  const drawTool: Stroke['tool'] = tool === 'highlighter' ? 'highlighter' : 'pen'

  function commit(lines: NoteLine[], snapshot = true) {
    if (snapshot) history.current.push(page.lines)
    if (history.current.length > 50) history.current.shift()
    store.savePage({ ...page, lines })
  }

  function undo() {
    const prev = history.current.pop()
    if (prev) store.savePage({ ...page, lines: prev })
  }

  const local = (e: { clientX: number; clientY: number }) => {
    const r = paperRef.current!.getBoundingClientRect()
    return [e.clientX - r.left, e.clientY - r.top] as const
  }

  // While a line is selected its action chips take up one extra row below it.
  const gap = selected == null ? 0 : 1
  const rowTop = (i: number) => (i + (selected != null && i > selected ? 1 : 0)) * LINE_H

  function rowAt(y: number) {
    if (selected != null && y >= (selected + 2) * LINE_H) y -= LINE_H
    else if (selected != null && y >= (selected + 1) * LINE_H) return selected
    return Math.max(0, Math.min(rows - 1, Math.floor(y / LINE_H)))
  }

  function tap(y: number) {
    const row = rowAt(y)
    setSelected(isEmpty(page.lines[row]) || row === selected ? null : row)
  }

  function eraseAt(x: number, y: number) {
    const row = rowAt(y)
    let changed = false
    const erased: string[] = []
    const lines = working.current.map((line, i) => {
      if (Math.abs(i - row) > 1) return line
      const ly = y - rowTop(i)
      const strokes = line.strokes.filter((s) => {
        for (let k = 0; k < s.points.length; k += 3)
          if (Math.hypot(s.points[k] - x, s.points[k + 1] - ly) < 14) return false
        return true
      })
      if (strokes.length === line.strokes.length) return line
      changed = true
      erased.push(line.id)
      return { ...line, strokes }
    })
    if (changed) {
      working.current = lines
      commit(lines, false)
      erased.forEach(scheduleOcr)
    }
  }

  function addPoint(e: PointerEvent | ReactPointerEvent) {
    const [x, y] = local(e)
    const p = e.pointerType === 'pen' ? e.pressure || 0.5 : 0.5
    points.current.push(x, y, p)
  }

  /* ---------- Pointer handling ----------
   * Pen (and mouse, for testing on a PC) writes. A finger never writes:
   * a finger tap selects a line, a finger drag scrolls. That gives palm rejection for free.
   * The pen's eraser end / side button (buttons & 32) erases. */

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (gesture.current || tool === 'type') return
    const el = e.currentTarget
    el.setPointerCapture(e.pointerId)

    if (e.pointerType === 'touch') {
      gesture.current = { kind: 'touch', id: e.pointerId, startY: e.clientY, lastY: e.clientY, moved: false }
      return
    }
    e.preventDefault()
    if (tool === 'eraser' || (e.buttons & 32) !== 0) {
      history.current.push(page.lines)
      working.current = page.lines
      gesture.current = { kind: 'erase', id: e.pointerId }
      eraseAt(...local(e))
      return
    }
    const simulate = e.pointerType !== 'pen'
    gesture.current = { kind: 'draw', id: e.pointerId, simulate }
    points.current = []
    addPoint(e)
    setLive({ points: points.current.slice(), tool: drawTool, simulate })
  }

  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const g = gesture.current
    if (!g || g.id !== e.pointerId) return
    if (g.kind === 'touch') {
      if (Math.abs(e.clientY - g.startY) > 8) g.moved = true
      if (g.moved && scrollRef.current) scrollRef.current.scrollTop -= e.clientY - g.lastY
      g.lastY = e.clientY
      return
    }
    const events = e.nativeEvent.getCoalescedEvents?.() ?? [e.nativeEvent]
    if (g.kind === 'erase') {
      for (const ev of events) eraseAt(...local(ev))
      return
    }
    for (const ev of events.length ? events : [e.nativeEvent]) addPoint(ev)
    cancelAnimationFrame(frame.current)
    frame.current = requestAnimationFrame(() => setLive((l) => l && { ...l, points: points.current.slice() }))
  }

  function onPointerUp(e: ReactPointerEvent<HTMLDivElement>) {
    const g = gesture.current
    if (!g || g.id !== e.pointerId) return
    gesture.current = null
    cancelAnimationFrame(frame.current)
    setLive(null)

    if (g.kind === 'touch') {
      if (!g.moved) tap(local(e)[1])
      return
    }
    if (g.kind === 'erase') return setSelected(null)

    const pts = points.current
    const xs = pts.filter((_, i) => i % 3 === 0)
    const ys = pts.filter((_, i) => i % 3 === 1)
    const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys))
    // A mouse click without dragging selects a line, so the app is usable on a PC too.
    if (e.pointerType === 'mouse' && span < 4) {
      tap(ys[0])
      return
    }

    const avgY = ys.reduce((a, b) => a + b, 0) / ys.length
    const row = rowAt(avgY)
    const rel = pts.map((v, i) => (i % 3 === 1 ? v - rowTop(row) : v))
    const stroke: Stroke = {
      id: uid(),
      tool: drawTool,
      color: drawTool === 'pen' ? ink : HIGHLIGHT,
      size: drawTool === 'pen' ? 4.5 : 22,
      points: rel,
      simulate: g.simulate,
    }
    const lines = padLines(page.lines, row + 1)
    lines[row] = { ...lines[row], strokes: [...lines[row].strokes, stroke] }
    commit(lines)
    setSelected(null)
    if (stroke.tool === 'pen') scheduleOcr(lines[row].id)
  }

  function onPointerCancel() {
    gesture.current = null
    setLive(null)
  }

  /* ---------- Line actions ---------- */

  async function startAction(kind: ActionKind) {
    if (selected == null) return
    const line = page.lines[selected]
    const title = line.text.trim() || line.ocr || (await recognize(line.strokes)) || ''
    setDialog({ kind, row: selected, title })
  }

  /** Replaces a line's handwriting with typed text (undo brings the ink back). */
  async function convertToText() {
    if (selected == null) return
    const row = selected
    const line = page.lines[row]
    const read = line.ocr || (await recognize(line.strokes))
    if (!read) {
      flash("Couldn't read that line. Try writing it a little larger.")
      return
    }
    const lines = page.lines.slice()
    lines[row] = {
      ...line,
      text: [line.text.trim(), read].filter(Boolean).join(' '),
      strokes: line.strokes.filter((s) => s.tool !== 'pen'),
      ocr: undefined,
    }
    commit(lines)
    setSelected(null)
  }


  async function confirmAction(r: ActionResult) {
    if (!dialog) return
    const { kind, row } = dialog
    const line = page.lines[row]
    const noteRef = { pageId: page.id, lineId: line.id }
    let tag: LineTag

    if (kind === 'task') {
      const t = store.addTask({ title: r.title, due: r.date, time: r.time || undefined, source: 'note', noteRef })
      tag = { kind: 'task', label: r.time ? `${r.time} task` : 'Task made', refId: t.id }
    } else if (kind === 'remind') {
      const remindAt = at(parseIsoDate(r.date), r.time)
      const t = store.addTask({ title: r.title, due: r.date, source: 'note', noteRef, remindAt })
      tag = { kind: 'reminder', label: `Remind ${r.time}`, refId: t.id }
      if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission()
    } else if (kind === 'calendar') {
      const day = parseIsoDate(r.date)
      const ev = store.addEvent({ title: r.title, start: at(day, r.time), end: at(day, r.end), source: 'local' })
      tag = { kind: 'calendar', label: 'On calendar', refId: ev.id }
    } else {
      const body = `${r.title}\n\nFrom my notes: ${page.title || 'Day notes'}`
      if (store.outlookReady) {
        window.open(await outlook.createDraft(r.title, body, r.to || undefined), '_blank')
      } else {
        window.location.href = `mailto:${r.to}?subject=${encodeURIComponent(r.title)}&body=${encodeURIComponent(body)}`
      }
      tag = { kind: 'email', label: 'Emailed' }
    }

    const lines = page.lines.slice()
    lines[row] = { ...line, tags: [...line.tags.filter((t) => t.kind !== tag.kind), tag] }
    commit(lines)
    setDialog(null)
    setSelected(null)
  }

  /* ---------- Typing ---------- */

  function setText(row: number, text: string) {
    const lines = padLines(page.lines, row + 1)
    lines[row] = { ...lines[row], text }
    // One undo step per line you start typing on, not per keystroke.
    commit(lines, !page.lines[row]?.text)
  }

  function focusRow(row: number) {
    paperRef.current?.querySelector<HTMLInputElement>(`input[data-row="${row}"]`)?.focus()
  }

  /* ---------- Render ---------- */

  const updated = new Date(page.updated)
  const saved = sameDay(updated, new Date()) ? hhmm(updated) : `${fmtShort(updated)}, ${hhmm(updated)}`

  const tools =
    variant === 'card' ? (
      <>
        <div className="segmented compact">
          <button className={tool !== 'type' ? 'on' : ''} title="Pen" aria-label="Pen" onClick={() => setTool('pen')}>
            <Pencil size={18} />
          </button>
          <button className={tool === 'type' ? 'on' : ''} title="Type" aria-label="Type" onClick={() => setTool('type')}>
            <Keyboard size={18} />
          </button>
        </div>
        <button className="round small-round" title="Undo" aria-label="Undo" onClick={undo} disabled={!history.current.length}>
          <Undo2 size={18} />
        </button>
      </>
    ) : (
      <div className="toolbar">
        {(
          [
            ['pen', <Pencil size={20} />, 'Pen'],
            ['highlighter', <Highlighter size={20} />, 'Highlighter'],
            ['eraser', <Eraser size={20} />, 'Eraser'],
            ['type', <Keyboard size={20} />, 'Type'],
          ] as const
        ).map(([t, icon, label]) => (
          <button key={t} className={tool === t ? 'on' : ''} title={label} aria-label={label} onClick={() => setTool(t)}>
            {icon}
          </button>
        ))}
        <button title="Undo" aria-label="Undo" onClick={undo} disabled={!history.current.length}>
          <Undo2 size={20} />
        </button>
      </div>
    )

  const inkButton = (
    <div className="ink-color">
      <button
        className="ink-dot"
        style={{ background: ink }}
        title="Ink colour"
        aria-label="Ink colour"
        aria-expanded={inkOpen}
        onClick={() => setInkOpen(!inkOpen)}
      />
      {inkOpen && (
        <>
          <div className="menu-scrim" onPointerDown={() => setInkOpen(false)} />
          <div className="ink-popover">
            <ColorPicker
              label="Ink colour"
              swatches={INK_SWATCHES}
              value={store.state.settings.inkColor}
              onChange={(c) => store.setSettings({ inkColor: c })}
            />
          </div>
        </>
      )}
    </div>
  )

  return (
    <section className={`inkpad ${variant}`}>
      <header className="inkpad-head">
        <div className="inkpad-title">{props.heading}</div>
        {tools}
        {inkButton}
        {props.extra}
      </header>

      <div className="paper-scroll" ref={scrollRef}>
        <div
          ref={paperRef}
          className={`paper tool-${tool}`}
          style={{ height: (rows + gap) * LINE_H }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
          onContextMenu={(e) => e.preventDefault()}
        >
          {Array.from({ length: rows }, (_, i) => {
            const line = page.lines[i]
            const right = line ? inkRight(line) : 0
            return (
              <div key={line?.id ?? `empty-${i}`} className={`line${selected === i ? ' sel' : ''}`} style={{ top: rowTop(i) }}>
                {line?.strokes.length ? (
                  <svg className="ink" width="100%" height={LINE_H}>
                    {[...line.strokes]
                      .sort((a) => (a.tool === 'highlighter' ? -1 : 1))
                      .map((s) => (
                        <path key={s.id} d={strokePath(s.points, s.tool, s.size, !!s.simulate)} fill={s.color} />
                      ))}
                  </svg>
                ) : null}
                {tool === 'type' ? (
                  <input
                    data-row={i}
                    className="line-text"
                    value={line?.text ?? ''}
                    onChange={(e) => setText(i, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') focusRow(i + 1)
                      if (e.key === 'ArrowUp') focusRow(i - 1)
                      if (e.key === 'ArrowDown') focusRow(i + 1)
                    }}
                  />
                ) : (
                  line?.text && <span className="line-text">{line.text}</span>
                )}
                {line?.tags.length ? (
                  <span className="tags" style={line.strokes.length && !line.text ? { left: right + 14, position: 'absolute' } : undefined}>
                    {line.tags.map((t) => (
                      <Tag key={t.kind} tag={t} />
                    ))}
                  </span>
                ) : null}
              </div>
            )
          })}

          {live && (
            <svg className="ink live" width="100%" height="100%">
              <path
                d={strokePath(live.points, live.tool, live.tool === 'pen' ? 4.5 : 22, live.simulate)}
                fill={live.tool === 'pen' ? ink : HIGHLIGHT}
              />
            </svg>
          )}

          {selected != null && (
            <div className="line-actions" style={{ top: (selected + 1) * LINE_H + 5 }} onPointerDown={(e) => e.stopPropagation()}>
              <button className="chip primary" onClick={() => startAction('task')}>
                Make it a task
              </button>
              {page.lines[selected]?.strokes.some((s) => s.tool === 'pen') && (
                <button className="chip" onClick={convertToText} title={page.lines[selected]?.ocr ? `Reads as: ${page.lines[selected].ocr}` : undefined}>
                  <Type size={16} /> Convert to text
                </button>
              )}
              <button className="chip" onClick={() => startAction('remind')}>
                Remind me
              </button>
              <button className="chip" onClick={() => startAction('email')}>
                Attach to email
              </button>
              {variant === 'full' && (
                <button className="chip" onClick={() => startAction('calendar')}>
                  Put on calendar
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <footer className={`saved${notice ? ' notice' : ''}`}>{notice || `Saved ${saved}`}</footer>

      {dialog && (
        <ActionDialog kind={dialog.kind} initialTitle={dialog.title} onCancel={() => setDialog(null)} onConfirm={confirmAction} />
      )}
    </section>
  )
}

function Tag({ tag }: { tag: LineTag }) {
  const icon = {
    task: tag.label === 'Task made' ? <Check size={15} /> : <Link2 size={15} />,
    calendar: <Calendar size={15} />,
    reminder: <Bell size={15} />,
    email: <Mail size={15} />,
  }[tag.kind]
  return (
    <span className={`tag tag-${tag.kind}`}>
      {icon}
      {tag.label}
    </span>
  )
}
