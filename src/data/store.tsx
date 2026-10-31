import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { get, set } from 'idb-keyval'
import { addDays, addMonths, isoDate, parseIsoDate } from '../lib/dates'
import { uid } from '../lib/id'
import { makeSeed } from './seed'
import { OLD_INK_TO_NEW } from '../components/ColorPicker'
import type { AppState, CalEvent, Clerk, NoteLine, NotePage, Repeat, Settings, Task, VatChecks, VatClient } from './types'

// Everything lives on the tablet (IndexedDB); nothing is sent anywhere.
const KEY = 'tether-state-v1'

type Store = {
  state: AppState
  update: (fn: (s: AppState) => AppState) => void
  addTask: (t: Omit<Task, 'id' | 'done'>) => Task
  toggleTask: (id: string) => void
  updateTask: (id: string, patch: Partial<Task>) => void
  deleteTask: (id: string) => void
  addEvent: (e: Omit<CalEvent, 'id'>) => CalEvent
  updateEvent: (id: string, patch: Partial<CalEvent>) => void
  deleteEvent: (id: string) => void
  savePage: (p: NotePage) => void
  setLineOcr: (pageId: string, lineId: string, ocr: string | undefined) => void
  convertLineInk: (pageId: string, lineId: string, strokeIds: string[], text: string, color: string) => void
  newPage: () => NotePage
  deletePage: (id: string) => void
  dailyPage: (day: string) => NotePage
  addClerk: (c: Omit<Clerk, 'id'>) => Clerk
  updateClerk: (id: string, patch: Partial<Clerk>) => void
  deleteClerk: (id: string) => void
  addVatClient: (c: Omit<VatClient, 'id'>) => VatClient
  updateVatClient: (id: string, patch: Partial<VatClient>) => void
  removeVatClient: (id: string) => void
  toggleVatCheck: (clientId: string, period: string, item: keyof VatChecks) => void
  setSettings: (patch: Partial<Settings>) => void
  resetDemo: () => void
  restore: (data: AppState) => void
  clearAll: () => void
}

const Ctx = createContext<Store | null>(null)
export const useStore = () => useContext(Ctx)!

const emptyState = (name = ''): AppState => ({
  tasks: [],
  events: [],
  pages: [],
  clerks: [],
  vatClients: [],
  vatChecks: {},
  settings: { name },
})

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState | null>(null)
  const stateRef = useRef<AppState | null>(null)
  stateRef.current = state

  useEffect(() => {
    // If storage is unavailable or stuck, start with demo data rather than hang on "Loading".
    const timeout = new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), 3000))
    Promise.race([get<AppState>(KEY), timeout])
      .catch(() => undefined)
      .then((saved) => setState(saved ? upgrade(saved) : makeSeed()))
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

    return {
      state,
      update,

      addTask(t) {
        const task: Task = { ...t, id: uid(), done: false }
        update((s) => ({ ...s, tasks: [...s.tasks, task] }))
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

      addEvent(e) {
        const ev: CalEvent = { ...e, id: uid() }
        update((s) => ({ ...s, events: [...s.events, ev] }))
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


      addVatClient(c) {
        const client: VatClient = { ...c, id: uid() }
        update((s) => ({ ...s, vatClients: [...s.vatClients, client] }))
        return client
      },

      updateVatClient(id, patch) {
        update((s) => ({ ...s, vatClients: s.vatClients.map((x) => (x.id === id ? { ...x, ...patch } : x)) }))
      },

      // Takes the client off the VAT list. Their past checklists are kept.
      removeVatClient(id) {
        update((s) => ({ ...s, vatClients: s.vatClients.filter((x) => x.id !== id) }))
      },

      toggleVatCheck(clientId, period, item) {
        const key = `${clientId}:${period}`
        update((s) => {
          const current = s.vatChecks[key] ?? {}
          return {
            ...s,
            vatChecks: { ...s.vatChecks, [key]: { ...current, [item]: current[item] ? undefined : new Date().toISOString() } },
          }
        })
      },

      setSettings(patch) {
        update((s) => ({ ...s, settings: { ...s.settings, ...patch } }))
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
  }, [state, update])

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
// Data from features taken out of the app (the Waiting list, Outlook sync) is never deleted:
// it stays in the saved data and in backups, just no longer shown.
function upgrade(stored: AppState): AppState {
  // Data saved before the VAT tab existed starts with an empty VAT list.
  const saved = { ...stored, vatClients: stored.vatClients ?? [], vatChecks: stored.vatChecks ?? {} }
  if (saved.clerks) return tidy(saved)
  return tidy(addDemoTeam(saved))
}

/** Small fixes on load. Nothing is ever deleted. */
function tidy(s: AppState): AppState {
  const known = new Set(s.clerks.map((c) => c.id))
  const isOrphan = (id?: string) => !!id && !known.has(id)
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
    // Never deletes tasks: work for a clerk who no longer exists comes back to you.
    tasks: s.tasks.map((t) => (isOrphan(t.assignee) ? { ...t, assignee: undefined, status: undefined } : t)),
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
