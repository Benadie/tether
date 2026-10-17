import { useEffect, useRef, useState } from 'react'
import { CalendarDays, CalendarRange, CheckSquare, Hourglass, LayoutDashboard, NotebookPen, Pencil, Plus, SlidersHorizontal, Table2, Timer, Users } from 'lucide-react'
import { useStore } from './data/store'
import { TodayScreen } from './screens/TodayScreen'
import { WeekScreen } from './screens/WeekScreen'
import { CalendarScreen } from './screens/CalendarScreen'
import { NotesScreen } from './screens/NotesScreen'
import { WaitingScreen } from './screens/WaitingScreen'
import { SettingsScreen } from './screens/SettingsScreen'
import { DashboardScreen } from './screens/DashboardScreen'
import { TeamScreen } from './screens/TeamScreen'
import { EditorProvider, useEditor } from './components/Editor'
import { UpdateBanner } from './components/UpdateBanner'
import { prepareHandwriting } from './lib/handwriting'
import { autoBackupIfDue } from './lib/backup'

export type Screen = 'dashboard' | 'today' | 'week' | 'calendar' | 'notes' | 'waiting' | 'team' | 'settings'
export type Nav = (screen: Screen, pageId?: string) => void

const NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'today', label: 'Today', icon: CalendarDays },
  { id: 'week', label: 'Week', icon: Table2 },
  { id: 'calendar', label: 'Calendar', icon: CalendarRange },
  { id: 'notes', label: 'Notes', icon: Pencil },
  { id: 'waiting', label: 'Waiting', icon: Hourglass },
  { id: 'team', label: 'Team', icon: Users },
] as const

const SYNC_EVERY_MS = 10 * 60_000

export function App() {
  return (
    <EditorProvider>
      <Shell />
    </EditorProvider>
  )
}

function Shell() {
  const store = useStore()
  const [screen, setScreen] = useState<Screen>('today')
  const [pageId, setPageId] = useState<string>()

  const go: Nav = (s, id) => {
    setScreen(s)
    if (id) setPageId(id)
  }

  // Keep Outlook fresh while the app is open.
  useEffect(() => {
    if (!store.outlookReady) return
    const sync = () => store.syncOutlook().catch((e) => console.warn('Sync failed', e))
    sync()
    const t = setInterval(sync, SYNC_EVERY_MS)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.outlookReady])

  useReminders()
  useBackgroundJobs()

  // Colours picked in Settings override the stylesheet defaults.
  const { textColor, inkColor } = store.state.settings
  useEffect(() => {
    const root = document.documentElement.style
    if (textColor) root.setProperty('--ink', textColor)
    else root.removeProperty('--ink')
    if (inkColor) root.setProperty('--pen', inkColor)
    else root.removeProperty('--pen')
  }, [textColor, inkColor])

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="logo">T</div>
        <AddMenu go={go} />
        <nav>
          {NAV.map(({ id, label, icon: Icon }) => (
            <button key={id} className={screen === id ? 'on' : ''} onClick={() => go(id)}>
              <Icon size={22} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
        <button
          className={`settings-btn${screen === 'settings' ? ' on' : ''}`}
          aria-label="Settings"
          onClick={() => go('settings')}
        >
          <SlidersHorizontal size={22} />
        </button>
      </aside>

      <main>
        <UpdateBanner />
        {screen === 'dashboard' && <DashboardScreen go={go} />}
        {screen === 'today' && <TodayScreen go={go} />}
        {screen === 'week' && <WeekScreen go={go} />}
        {screen === 'calendar' && <CalendarScreen />}
        {screen === 'notes' && <NotesScreen pageId={pageId} setPageId={setPageId} />}
        {screen === 'waiting' && <WaitingScreen />}
        {screen === 'team' && <TeamScreen go={go} />}
        {screen === 'settings' && <SettingsScreen />}
      </main>
    </div>
  )
}

/** The "+" button: add a task, event, waiting item or note page from any screen. */
function AddMenu({ go }: { go: Nav }) {
  const [open, setOpen] = useState(false)
  const editor = useEditor()
  const { newPage } = useStore()
  const pick = (fn: () => void) => () => {
    setOpen(false)
    fn()
  }

  return (
    <div className="add-menu">
      <button className="add-btn" aria-label="Add" aria-expanded={open} onClick={() => setOpen(!open)}>
        <Plus size={28} strokeWidth={2.5} />
      </button>
      {open && (
        <>
          <div className="menu-scrim" onPointerDown={() => setOpen(false)} />
          <div className="menu" role="menu">
            <button onClick={pick(() => editor.newTask())}>
              <CheckSquare size={20} /> Task
            </button>
            <button onClick={pick(() => editor.newEvent())}>
              <CalendarDays size={20} /> Event
            </button>
            <button onClick={pick(() => editor.newWaiting())}>
              <Timer size={20} /> Waiting on someone
            </button>
            <button onClick={pick(() => go('notes', newPage().id))}>
              <NotebookPen size={20} /> Note page
            </button>
          </div>
        </>
      )}
    </div>
  )
}

/** Gets handwriting recognition ready and makes the daily on-tablet backup (Android app only). */
function useBackgroundJobs() {
  const { state } = useStore()
  const latest = useRef(state)
  latest.current = state
  useEffect(() => {
    prepareHandwriting()
    const backup = () => autoBackupIfDue(latest.current).catch((e) => console.warn('Automatic backup failed', e))
    // A little after start so it doesn't slow opening the app, then hourly (it only writes once a day).
    const first = setTimeout(backup, 5000)
    const hourly = setInterval(backup, 3_600_000)
    return () => {
      clearTimeout(first)
      clearInterval(hourly)
    }
  }, [])
}

/** Shows reminders while the app is open. (Reminders also go to Microsoft To Do when Outlook is linked,
 *  which notifies you even when Tether is closed.) */
function useReminders() {
  const { state } = useStore()
  useEffect(() => {
    const now = Date.now()
    const timers = state.tasks
      .filter((t) => t.remindAt && !t.done)
      .map((t) => ({ t, ms: new Date(t.remindAt!).getTime() - now }))
      .filter(({ ms }) => ms > 0 && ms < 24 * 3_600_000)
      .map(({ t, ms }) =>
        setTimeout(() => {
          if ('Notification' in window && Notification.permission === 'granted') new Notification('Tether', { body: t.title })
          else alert(`Reminder: ${t.title}`)
        }, ms),
      )
    return () => timers.forEach(clearTimeout)
  }, [state.tasks])
}
