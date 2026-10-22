import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { get, set } from 'idb-keyval'
import { addDays, addMonths, isoDate, parseIsoDate, startOfWeek } from '../lib/dates'
import { uid } from '../lib/id'
import * as outlook from '../sync/outlook'
import { makeSeed } from './seed'
import { OLD_INK_TO_NEW } from '../components/ColorPicker'
import type { AppState, CalEvent, Clerk, NoteLine, NotePage, Repeat, Settings, Task, WaitingItem } from './types'

// Everything lives on the tablet (IndexedDB), so the app works on its own.
// Outlook is an optional source that is merged in on sync.
const KEY = 'tether-state-v1'

type Store = {
  state: AppState
  outlookReady: boolean
  update: (fn: (s: AppState) => AppState) => void
  addTask: (t: Omit<Task, 'id' | 'done'>) => Task
  toggleTask: (id: string) => void
  updateTask: (id: string, patch: Partial<Task>) => void
  deleteTask: (id: string) => void
  addEvent: (e: Omit<CalEvent, 'id'>) => CalEvent
  updateEvent: (id: string, patch: Partial<CalEvent>) => void
  deleteEvent: (id: string) => void
  updateWaiting: (id: string, patch: Partial<WaitingItem>) => void
  deleteWaiting: (id: string) => void
  savePage: (p: NotePage) => void
  setLineOcr: (pageId: string, lineId: string, ocr: string | undefined) => void
  convertLineInk: (pageId: string, lineId: string, strokeIds: string[], text: string, color: string) => void
  newPage: () => NotePage
  deletePage: (id: string) => void
  dailyPage: (day: string) => NotePage
  addWaiting: (w: Omit<WaitingItem, 'id' | 'done'>) => void
  resolveWaiting: (id: string) => void
  nudge: (id: string) => Promise<void>
  addClerk: (c: Omit<Clerk, 'id'>) => Clerk
  updateClerk: (id: string, patch: Partial<Clerk>) => void
  deleteClerk: (id: string) => void
  setSettings: (patch: Partial<Settings>) => void
  syncOutlook: () => Promise<void>
  resetDemo: () => void
  restore: (data: AppState) => void
  clearAll: () => void
}

const Ctx = createContext<Store | null>(null)
export const useStore = () => useContext(Ctx)!

const emptyState = (name = ''): AppState => ({
  tasks: [],
  events: [],
  waiting: [],
  pages: [],
  clerks: [],
  settings: { name },
})

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState | null>(null)
  const [outlookReady, setOutlookReady] = useState(false)
  const stateRef = useRef<AppState | null>(null)
  stateRef.current = state

  useEffect(() => {
    // If storage is unavailable or stuck, start with demo data rather than hang on "Loading".
    const timeout = new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), 3000))
    Promise.race([get<AppState>(KEY), timeout])
      .catch(() => undefined)
      .then((saved) => setState(saved ? upgrade(saved) : makeSeed()))
    outlook
      .initOutlook()
      .then((acc) => {
        if (!acc) return
        setOutlookReady(true)
        setState((s) => s && { ...s, settings: { ...s.settings, outlookAccount: acc.username } })
      })
      .catch((e) => console.warn('Outlook init failed', e))
  }, [])

  // Debounced save
  useEffect(() => {
    if (!state) return
    const t = setTimeout(() => set(KEY, state).catch((e) => console.error('Save failed', e)), 400)
    return () => clearTimeout(t)
  }, [state])

  const update = useCallback((fn: (s: AppState) => AppState) => setState((s) => (s ? fn(s) : s)), [])

  const store = useMemo<Store | null>(() => {
    if (!state) return null
    const connected = () => outlookReady

    const pushToOutlook = (what: string, p: Promise<unknown>) =>
      p.catch((e) => console.warn(`Could not ${what} in Outlook`, e))

    return {
      state,
      outlookReady,
      update,

      addTask(t) {
        const task: Task = { ...t, id: uid(), done: false }
        update((s) => ({ ...s, tasks: [...s.tasks, task] }))
        if (connected() && task.source !== 'outlook')
          pushToOutlook('create task', outlook.createTodoTask(task.title, task.due, task.remindAt ? new Date(task.remindAt) : undefined))
        return task
      },

      toggleTask(id) {
        const t = state.tasks.find((x) => x.id === id)
        const doneAt = new Date().toISOString()
        // Ticking off a repeating task schedules the next one.
        const next: Task | null =
          t && !t.done && t.repeat
            ? { ...t, id: uid(), done: false, doneAt: undefined, status: undefined, due: nextDue(t.due, t.repeat) }
            : null
        update((s) => ({
          ...s,
          tasks: [
            ...s.tasks.map((x) => (x.id === id ? { ...x, done: !x.done, doneAt: x.done ? undefined : doneAt } : x)),
            ...(next ? [next] : []),
          ],
        }))
        if (connected() && t?.outlookId && !t.done) pushToOutlook('complete flag', outlook.completeFlag(t.outlookId))
      },

      updateTask(id, patch) {
        update((s) => ({ ...s, tasks: s.tasks.map((x) => (x.id === id ? { ...x, ...patch } : x)) }))
      },

      deleteTask(id) {
        update((s) => ({
          ...s,
          tasks: s.tasks.filter((x) => x.id !== id),
          // Drop the "Task made" tag from the note line it came from.
          pages: s.pages.map((p) => ({
            ...p,
            lines: p.lines.map((l) => (l.tags.some((t) => t.refId === id) ? { ...l, tags: l.tags.filter((t) => t.refId !== id) } : l)),
          })),
        }))
      },

      updateEvent(id, patch) {
        update((s) => ({ ...s, events: s.events.map((x) => (x.id === id ? { ...x, ...patch } : x)) }))
      },

      deleteEvent(id) {
        update((s) => ({ ...s, events: s.events.filter((x) => x.id !== id) }))
      },

      updateWaiting(id, patch) {
        update((s) => ({ ...s, waiting: s.waiting.map((x) => (x.id === id ? { ...x, ...patch } : x)) }))
      },

      deleteWaiting(id) {
        update((s) => ({ ...s, waiting: s.waiting.filter((x) => x.id !== id) }))
      },

      addEvent(e) {
        const ev: CalEvent = { ...e, id: uid() }
        update((s) => ({ ...s, events: [...s.events, ev] }))
        if (connected())
          pushToOutlook('create event', outlook.createEvent(ev.title, new Date(ev.start), new Date(ev.end)))
        return ev
      },

      savePage(p) {
        const page = { ...p, updated: new Date().toISOString() }
        update((s) => {
          const exists = s.pages.some((x) => x.id === p.id)
          return { ...s, pages: exists ? s.pages.map((x) => (x.id === p.id ? page : x)) : [...s.pages, page] }
        })
      },

      // Patches one line only, so it never overwrites ink written while recognition ran.
      setLineOcr(pageId, lineId, ocr) {
        update((s) => ({
          ...s,
          pages: s.pages.map((p) =>
            p.id !== pageId ? p : { ...p, lines: p.lines.map((l) => (l.id === lineId ? { ...l, ocr } : l)) },
          ),
        }))
      },

      // Swaps the given pen strokes for typed text. Only those strokes go, so anything written
      // on the line while it was being read is kept.
      convertLineInk(pageId, lineId, strokeIds, text, color) {
        const ids = new Set(strokeIds)
        update((s) => ({
          ...s,
          pages: s.pages.map((p) =>
            p.id !== pageId
              ? p
              : {
                  ...p,
                  updated: new Date().toISOString(),
                  lines: p.lines.map((l) =>
                    l.id !== lineId
                      ? l
                      : {
                          ...l,
                          text: [l.text.trim(), text].filter(Boolean).join(' '),
                          // The text keeps the colour of the ink it came from (a line already started keeps its colour).
                          color: l.text.trim() ? (l.color ?? color) : color,
                          strokes: l.strokes.filter((st) => !ids.has(st.id)),
                          ocr: undefined,
                        },
                  ),
                },
          ),
        }))
      },

      newPage() {
        const now = new Date().toISOString()
        const page: NotePage = { id: uid(), title: 'Untitled page', created: now, updated: now, lines: [] }
        update((s) => ({ ...s, pages: [...s.pages, page] }))
        return page
      },

      deletePage(id) {
        update((s) => ({ ...s, pages: s.pages.filter((p) => p.id !== id) }))
      },

      // Not stored until something is written on it.
      dailyPage(day) {
        return (
          state.pages.find((p) => p.day === day) ?? {
            id: `daily-${day}`,
            title: '',
            day,
            created: new Date().toISOString(),
            updated: new Date().toISOString(),
            lines: [],
          }
        )
      },

      addWaiting(w) {
        update((s) => ({ ...s, waiting: [...s.waiting, { ...w, id: uid(), done: false }] }))
      },

      resolveWaiting(id) {
        update((s) => ({ ...s, waiting: s.waiting.map((w) => (w.id === id ? { ...w, done: true } : w)) }))
      },

      async nudge(id) {
        const w = state.waiting.find((x) => x.id === id)
        if (!w) return
        if (connected() && w.outlookId) {
          const link = await outlook.draftNudge(w.outlookId)
          window.open(link, '_blank')
        } else {
          const subject = encodeURIComponent(`Following up: ${w.title}`)
          const body = encodeURIComponent('Hi, just following up on this. Any update?')
          window.location.href = `mailto:${w.email ?? ''}?subject=${subject}&body=${body}`
        }
        update((s) => ({
          ...s,
          waiting: s.waiting.map((x) => (x.id === id ? { ...x, nudgedAt: new Date().toISOString() } : x)),
        }))
      },

      addClerk(c) {
        const clerk: Clerk = { ...c, id: uid() }
        update((s) => ({ ...s, clerks: [...s.clerks, clerk] }))
        return clerk
      },

      updateClerk(id, patch) {
        update((s) => ({ ...s, clerks: s.clerks.map((x) => (x.id === id ? { ...x, ...patch } : x)) }))
      },

      // Their open work comes back to you rather than disappearing.
      deleteClerk(id) {
        update((s) => ({
          ...s,
          clerks: s.clerks.filter((x) => x.id !== id),
          tasks: s.tasks.map((t) => (t.assignee === id ? { ...t, assignee: undefined } : t)),
        }))
      },


      setSettings(patch) {
        update((s) => ({ ...s, settings: { ...s.settings, ...patch } }))
      },

      async syncOutlook() {
        const from = startOfWeek(new Date())
        const [events, flagged, waiting] = await Promise.all([
          outlook.fetchEvents(from, addDays(from, 14)),
          outlook.fetchFlagged(),
          outlook.fetchWaiting(),
        ])
        update((s) => {
          const byOutlookId = <T extends { outlookId?: string }>(list: T[]) =>
            new Map(list.filter((x) => x.outlookId).map((x) => [x.outlookId!, x]))
          const oldTasks = byOutlookId(s.tasks)
          const oldWaiting = byOutlookId(s.waiting)
          return {
            ...s,
            events: [...s.events.filter((e) => e.source !== 'outlook'), ...events],
            // Unflagged/completed emails drop out; keep our ids so note links survive.
            tasks: [
              ...s.tasks.filter((t) => t.source !== 'outlook'),
              ...flagged.map((t) => {
                const old = oldTasks.get(t.outlookId!)
                return old ? { ...t, id: old.id, noteRef: old.noteRef, time: old.time } : t
              }),
            ],
            waiting: [
              ...s.waiting.filter((w) => !w.outlookId),
              ...waiting.map((w) => {
                const old = oldWaiting.get(w.outlookId!)
                return old ? { ...w, id: old.id, done: old.done, nudgedAt: old.nudgedAt } : w
              }),
            ],
            settings: { ...s.settings, lastSync: new Date().toISOString() },
          }
        })
      },

      resetDemo() {
        setState({ ...makeSeed(), settings: state.settings })
      },

      // Replaces everything with a backup (older backups are brought up to date the same way as saved data).
      restore(data) {
        setState(upgrade({ ...emptyState(), ...data }))
      },

      clearAll() {
        setState({ ...emptyState(state.settings.name), settings: state.settings })
      },
    }
  }, [state, outlookReady, update])

  if (!store) return <div className="loading">Loading…</div>
  return <Ctx.Provider value={store}>{children}</Ctx.Provider>
}

export const todayIso = () => isoDate(new Date())

/** Your own tasks; ones handed to a clerk live on the Team board. */
export const isMine = (t: Task) => !t.assignee

function nextDue(due: string | undefined, repeat: Repeat) {
  const from = due ? parseIsoDate(due) : new Date()
  const next = repeat === 'weekly' ? addDays(from, 7) : addMonths(from, repeat === 'monthly' ? 1 : 12)
  return isoDate(next)
}

/** Data saved before clerks existed gets the demo team so the Team board isn't empty. */
function upgrade(saved: AppState): AppState {
  if (saved.clerks) return tidy(saved)
  return tidy(addDemoTeam(saved))
}

/** Tasks pointing at a clerk who no longer exists: drop exact duplicates, otherwise hand them back to you. */
function tidy(s: AppState): AppState {
  const known = new Set(s.clerks.map((c) => c.id))
  const isOrphan = (id?: string) => !!id && !known.has(id)
  const duplicate = (t: Task) =>
    s.tasks.some((o) => o !== t && !isOrphan(o.assignee) && o.assignee && o.title === t.title && o.client === t.client)
  // The old, darker pen colours looked black as typed text: swap them for the brighter versions.
  const brighter = (c?: string) => (c && OLD_INK_TO_NEW[c.toLowerCase()]) || c
  const inkColor = brighter(s.settings.inkColor)
  // Typed text from before lines remembered their colour: fix it to the pen colour in use now,
  // so it no longer changes when you pick a different pen.
  const penNow = inkColor ?? DEFAULT_PEN
  const fixLine = (l: NoteLine): NoteLine => {
    const color = l.text.trim() && !l.color ? penNow : brighter(l.color)
    const strokes = l.strokes.some((st) => st.tool === 'pen' && brighter(st.color) !== st.color)
      ? l.strokes.map((st) => (st.tool === 'pen' ? { ...st, color: brighter(st.color)! } : st))
      : l.strokes
    return color === l.color && strokes === l.strokes ? l : { ...l, color, strokes }
  }
  return {
    ...s,
    settings: inkColor === s.settings.inkColor ? s.settings : { ...s.settings, inkColor },
    tasks: s.tasks
      .filter((t) => !(isOrphan(t.assignee) && duplicate(t)))
      .map((t) => (isOrphan(t.assignee) ? { ...t, assignee: undefined, status: undefined } : t)),
    pages: s.pages.map((p) => {
      const lines = p.lines.map(fixLine)
      return lines.some((l, i) => l !== p.lines[i]) ? { ...p, lines } : p
    }),
  }
}

/** Default pen colour (a clear blue), used when none has been picked */
export const DEFAULT_PEN = '#1d4ed8'

function addDemoTeam(saved: AppState): AppState {
  const demo = makeSeed()
  return {
    ...saved,
    clerks: saved.clerks ?? demo.clerks,
    tasks: [
      // Demo tasks that now repeat (matched by title, so your own tasks are untouched).
      ...saved.tasks.map((t) => {
        const match = demo.tasks.find((d) => d.repeat && d.title === t.title)
        return match ? { ...t, repeat: match.repeat } : t
      }),
      ...demo.tasks.filter((t) => t.assignee),
    ],
  }
}
