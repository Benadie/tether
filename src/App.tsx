import { useEffect, useRef, useState } from 'react'
import { Building2, CalendarDays, CalendarRange, LayoutDashboard, Pencil, Receipt, Settings as Gear, Table2, Users, Wallet } from 'lucide-react'
import { useStore } from './data/store'
import { TodayScreen } from './screens/TodayScreen'
import { WeekScreen } from './screens/WeekScreen'
import { CalendarScreen } from './screens/CalendarScreen'
import { NotesScreen } from './screens/NotesScreen'
import { SettingsScreen } from './screens/SettingsScreen'
import { DashboardScreen } from './screens/DashboardScreen'
import { TeamScreen } from './screens/TeamScreen'
import { VatScreen } from './screens/VatScreen'
import { PayrollScreen } from './screens/PayrollScreen'
import { ClientsScreen } from './screens/ClientsScreen'
import { EditorProvider } from './components/Editor'
import { UpdateBanner } from './components/UpdateBanner'
import { applyTheme, themeById } from './lib/themes'
import { prepareHandwriting } from './lib/handwriting'
import { autoBackupIfDue } from './lib/backup'
import { askNotificationPermission, notificationPermission, notificationSettings, useNotifications } from './lib/notify'

export type Screen = 'dashboard' | 'today' | 'week' | 'calendar' | 'notes' | 'clients' | 'vat' | 'payroll' | 'team' | 'settings'
export type Nav = (screen: Screen, pageId?: string) => void

const NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'today', label: 'Today', icon: CalendarDays },
  { id: 'week', label: 'Week', icon: Table2 },
  { id: 'calendar', label: 'Calendar', icon: CalendarRange },
  { id: 'notes', label: 'Notes', icon: Pencil },
  { id: 'clients', label: 'Clients', icon: Building2 },
  { id: 'vat', label: 'VAT', icon: Receipt },
  { id: 'payroll', label: 'Payroll', icon: Wallet },
  { id: 'team', label: 'Team', icon: Users },
] as const

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

  useNotifications(store.state)
  useBackgroundJobs()

  // Colours picked in Settings override the stylesheet defaults.
  const { textColor, inkColor, theme } = store.state.settings
  useEffect(() => {
    applyTheme(themeById(theme), textColor)
    const root = document.documentElement.style
    if (inkColor) root.setProperty('--pen', inkColor)
    else root.removeProperty('--pen')
  }, [textColor, inkColor, theme])

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="logo">T</div>
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
          <Gear size={24} />
        </button>
      </aside>

      <main>
        <UpdateBanner />
        {screen === 'dashboard' && <DashboardScreen go={go} />}
        {screen === 'today' && <TodayScreen go={go} />}
        {screen === 'week' && <WeekScreen go={go} />}
        {screen === 'calendar' && <CalendarScreen />}
        {screen === 'notes' && <NotesScreen pageId={pageId} setPageId={setPageId} />}
        {screen === 'clients' && <ClientsScreen />}
        {screen === 'vat' && <VatScreen />}
        {screen === 'payroll' && <PayrollScreen />}
        {screen === 'team' && <TeamScreen go={go} />}
        {screen === 'settings' && <SettingsScreen />}
      </main>
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
    // Ask once for permission to show notifications (Android shows its own prompt).
    if (notificationSettings(latest.current).enabled)
      notificationPermission()
        .then((p) => p === 'prompt' && askNotificationPermission())
        .catch(() => undefined)
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
