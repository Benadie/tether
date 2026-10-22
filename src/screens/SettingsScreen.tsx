import { useEffect, useRef, useState } from 'react'
import { useStore } from '../data/store'
import { fmtDmy, fmtShort, hhmm } from '../lib/dates'
import { ScreenHeader } from '../components/common'
import * as outlook from '../sync/outlook'
import { APP_VERSION, checkForUpdate, updatesEnabled } from '../lib/updates'
import { autoBackupIfDue, lastAutoBackup, readBackup, shareBackup, type BackupFile } from '../lib/backup'
import { prepareHandwriting, useHandwritingStatus } from '../lib/handwriting'
import {
  askNotificationPermission,
  exactTiming,
  leadLabel,
  notificationPermission,
  notificationSettings,
  openExactTimingSettings,
  planNotifications,
  sendTestNotification,
} from '../lib/notify'
import type { NotificationSettings } from '../data/types'
import { THEMES, themeById } from '../lib/themes'
import { Capacitor } from '@capacitor/core'
import { ColorPicker, INK_SWATCHES, TEXT_SWATCHES } from '../components/ColorPicker'

export function SettingsScreen() {
  const store = useStore()
  const { settings } = store.state
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [updateMsg, setUpdateMsg] = useState('')

  async function run(fn: () => Promise<unknown>) {
    setBusy(true)
    setError('')
    try {
      await fn()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="screen">
      <ScreenHeader title="Settings" />
      <div className="settings-grid">
        <section className="card form">
          <h2>You</h2>
          <label>
            Your first name
            <input value={settings.name} onChange={(e) => store.setSettings({ name: e.target.value })} />
          </label>
        </section>

        <section className="card form">
          <h2>Theme</h2>
          <div className="themes">
            {THEMES.map((t) => (
              <button
                key={t.id}
                className={`theme-card${themeById(settings.theme).id === t.id ? ' on' : ''}`}
                style={{ background: t.bg }}
                onClick={() => store.setSettings({ theme: t.id })}
              >
                <span className="theme-preview">
                  <i style={{ background: t.accent }} />
                  <i style={{ background: t.dark }} />
                  <i style={{ background: t.event }} />
                  <i style={{ background: '#fff' }} />
                </span>
                <b style={{ color: t.ink }}>{t.name}</b>
              </button>
            ))}
          </div>
        </section>

        <section className="card form">
          <h2>Colours</h2>
          <ColorPicker
            label="App text"
            // The theme's own text colour is the default (first) swatch.
            swatches={[themeById(settings.theme).ink, ...TEXT_SWATCHES.filter((c) => c !== themeById(settings.theme).ink)]}
            value={settings.textColor}
            onChange={(c) => store.setSettings({ textColor: c })}
          />
          <ColorPicker
            label="Notes & pen ink"
            swatches={INK_SWATCHES}
            value={settings.inkColor}
            onChange={(c) => store.setSettings({ inkColor: c })}
          />
          <p className="handwriting-preview">Preview: Mgmt letter, 3 findings</p>
          <p className="muted">
            Only what you write next uses a new pen colour. Everything already written, handwriting or typed, keeps its
            own colour. You can also change it from the pen button on any notepad (tap the pen again).
          </p>
        </section>

        <NotificationsCard />

        <section className="card form">
          <h2>Outlook</h2>
          {!outlook.outlookConfigured() ? (
            <p className="muted">
              Not set up yet. Tether works on its own; follow <b>OUTLOOK-SETUP.md</b> in the project folder to link
              your Outlook calendar, flagged emails and To Do.
            </p>
          ) : store.outlookReady ? (
            <>
              <p>
                Connected as <b>{settings.outlookAccount}</b>
                {settings.lastSync &&
                  `. Last synced ${fmtShort(new Date(settings.lastSync))}, ${hhmm(new Date(settings.lastSync))}`}
              </p>
              <div className="row">
                <button className="chip primary" disabled={busy} onClick={() => run(store.syncOutlook)}>
                  {busy ? 'Syncing…' : 'Sync now'}
                </button>
                <button className="chip" onClick={() => run(outlook.signOut)}>
                  Disconnect
                </button>
              </div>
            </>
          ) : (
            <button className="chip primary" onClick={() => run(outlook.signIn)}>
              Connect Outlook
            </button>
          )}
          {error && <p className="late">{error}</p>}
        </section>

        <section className="card form">
          <h2>Data</h2>
          <p className="muted">Everything is saved on this tablet. Outlook items are copied in when you sync.</p>
          <div className="row">
            <button className="chip" onClick={() => confirm('Remove all notes, tasks and events?') && store.clearAll()}>
              Start fresh
            </button>
            <button className="chip" onClick={() => confirm('Replace everything with demo data?') && store.resetDemo()}>
              Load demo data
            </button>
          </div>
        </section>

        <BackupCard />

        <section className="card form">
          <h2>Handwriting</h2>
          <HandwritingStatusLine />
          <div className="color-picker">
            <span className="color-label">After I write a line</span>
            <div className="segmented choice">
              <button
                className={(settings.handwriting ?? 'convert') === 'convert' ? 'on' : ''}
                onClick={() => store.setSettings({ handwriting: 'convert' })}
              >
                Turn it into typed text
              </button>
              <button
                className={settings.handwriting === 'keep' ? 'on' : ''}
                onClick={() => store.setSettings({ handwriting: 'keep' })}
              >
                Keep my handwriting
              </button>
            </div>
            <span className="muted small-note">
              {(settings.handwriting ?? 'convert') === 'convert'
                ? 'A moment after you stop writing, the line becomes typed text. Undo brings your handwriting back.'
                : 'Your handwriting stays as it is. It is still read, so search and "Make it a task" use your words.'}
            </span>
          </div>
        </section>

        <section className="card form">
          <h2>App version</h2>
          <p>
            Tether <b>{APP_VERSION}</b>
          </p>
          {updatesEnabled() ? (
            <>
              <button
                className="chip"
                disabled={updateMsg === 'Checking…'}
                onClick={async () => {
                  setUpdateMsg('Checking…')
                  const u = await checkForUpdate()
                  setUpdateMsg(u ? `Version ${u.version} is available, see the banner at the top.` : 'You have the latest version.')
                  if (u) window.location.reload()
                }}
              >
                Check for updates
              </button>
              {updateMsg && <p className="muted">{updateMsg}</p>}
            </>
          ) : (
            <p className="muted">Updates are checked automatically in the Android app.</p>
          )}
        </section>
      </div>
    </div>
  )
}

function BackupCard() {
  const store = useStore()
  const fileInput = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [pending, setPending] = useState<BackupFile | null>(null)
  const [armed, setArmed] = useState(false)
  const last = lastAutoBackup()
  const native = Capacitor.isNativePlatform()

  async function backUpNow() {
    setBusy(true)
    setMessage('')
    try {
      await shareBackup(store.state)
    } catch (e) {
      // Closing the share sheet without choosing an app also lands here; that's fine.
      const msg = e instanceof Error ? e.message : String(e)
      if (!/cancel/i.test(msg)) setMessage(`Backup failed: ${msg}`)
    } finally {
      setBusy(false)
    }
  }

  async function pick(file?: File) {
    setMessage('')
    setArmed(false)
    if (!file) return
    try {
      setPending(await readBackup(file))
    } catch (e) {
      setPending(null)
      setMessage(e instanceof Error ? e.message : String(e))
    }
  }

  async function restore() {
    if (!pending) return
    if (!armed) return setArmed(true)
    // Keep a copy of what's on the tablet now, in case the wrong file was picked.
    await autoBackupIfDue(store.state, true).catch(() => undefined)
    store.restore(pending.data)
    const when = new Date(pending.exportedAt)
    setMessage(`Restored the backup from ${fmtDmy(when)} ${hhmm(when)}.`)
    setPending(null)
    setArmed(false)
  }

  return (
    <section className="card form">
      <h2>Backup</h2>
      {native ? (
        <p className="muted">
          A copy is saved on this tablet every day (Documents › Tether, last 14 kept).
          {last ? ` Last one: ${fmtDmy(new Date(last))} ${hhmm(new Date(last))}.` : ' The first one is made shortly after opening the app.'}
        </p>
      ) : (
        <p className="muted">Download a backup file and keep it somewhere safe.</p>
      )}
      <div className="row">
        <button className="chip primary" disabled={busy} onClick={backUpNow}>
          {native ? 'Back up now (OneDrive, Drive, email…)' : 'Download backup'}
        </button>
        <button className="chip" onClick={() => fileInput.current?.click()}>
          Restore from a file
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            pick(e.target.files?.[0])
            e.target.value = ''
          }}
        />
      </div>
      {pending && (
        <div className="restore-box">
          <p>
            Backup from <b>{fmtDmy(new Date(pending.exportedAt))} {hhmm(new Date(pending.exportedAt))}</b>:{' '}
            {pending.data.tasks.length} tasks, {pending.data.pages.length} note pages, {pending.data.events.length} events.
          </p>
          <p className="muted">Restoring replaces everything currently in Tether on this tablet.</p>
          <div className="row">
            <button className={`chip danger${armed ? ' armed' : ''}`} onClick={restore}>
              {armed ? 'Tap again to restore' : 'Restore this backup'}
            </button>
            <button className="chip" onClick={() => (setPending(null), setArmed(false))}>
              Cancel
            </button>
          </div>
        </div>
      )}
      {message && <p className={message.startsWith('Restored') ? '' : 'late'}>{message}</p>}
    </section>
  )
}

function HandwritingStatusLine() {
  const { status, error } = useHandwritingStatus()
  if (status === 'unavailable')
    return <p className="muted">Handwriting is turned into text in the Android app. In the browser, type or use Gboard's handwriting keyboard.</p>
  if (status === 'downloading') return <p className="muted">Getting handwriting recognition ready (a one-time ~20 MB download)…</p>
  if (status === 'ready')
    return <p>Ready. Your handwriting is read on this tablet (nothing is sent anywhere), so you can search it and turn lines into tasks.</p>
  return (
    <>
      <p className="late">Couldn't get handwriting recognition ready{error ? `: ${error}` : ''}. It needs internet once.</p>
      <button className="chip" onClick={() => prepareHandwriting()}>
        Try again
      </button>
    </>
  )
}

const LEADS = [0, 5, 10, 15, 30, 60, 120, 1440]

function NotificationsCard() {
  const store = useStore()
  const cfg = notificationSettings(store.state)
  const set = (patch: Partial<NotificationSettings>) => store.setSettings({ notifications: { ...cfg, ...patch } })
  const [permission, setPermission] = useState<'granted' | 'denied' | 'prompt' | ''>('')
  const [exact, setExact] = useState<boolean | null>(null)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    const check = () => {
      notificationPermission().then(setPermission).catch(() => setPermission('denied'))
      exactTiming().then(setExact)
    }
    check()
    // Coming back from Android's settings screen.
    window.addEventListener('focus', check)
    document.addEventListener('visibilitychange', check)
    return () => {
      window.removeEventListener('focus', check)
      document.removeEventListener('visibilitychange', check)
    }
  }, [])

  const upcoming = planNotifications(store.state).slice(0, 3)

  return (
    <section className="card form">
      <h2>Notifications</h2>
      <label className="switch-row">
        <span>Notifications</span>
        <input type="checkbox" checked={cfg.enabled} onChange={(e) => set({ enabled: e.target.checked })} />
      </label>

      {cfg.enabled && permission && permission !== 'granted' && (
        <div className="restore-box">
          <p>{permission === 'denied' ? 'Notifications are turned off for Tether in the tablet settings.' : 'Tether needs your permission to show notifications.'}</p>
          <button
            className="chip primary"
            onClick={async () => setPermission((await askNotificationPermission()) ? 'granted' : await notificationPermission())}
          >
            Allow notifications
          </button>
          {permission === 'denied' && <p className="muted small-note">If nothing happens: tablet Settings › Apps › Tether › Notifications › Allow.</p>}
        </div>
      )}

      {cfg.enabled && (
        <>
          <div className="row">
            <label>
              Tasks with a time
              <select value={cfg.taskLead} onChange={(e) => set({ taskLead: Number(e.target.value) })}>
                {LEADS.map((m) => (
                  <option key={m} value={m}>
                    {leadLabel(m)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Meetings
              <select value={cfg.eventLead} onChange={(e) => set({ eventLead: Number(e.target.value) })}>
                {LEADS.map((m) => (
                  <option key={m} value={m}>
                    {leadLabel(m)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="row">
            <label className="switch-row">
              <span>Morning summary of my day</span>
              <input type="checkbox" checked={cfg.summary} onChange={(e) => set({ summary: e.target.checked })} />
            </label>
            {cfg.summary && (
              <label>
                At
                <input type="time" value={cfg.summaryTime} onChange={(e) => e.target.value && set({ summaryTime: e.target.value })} />
              </label>
            )}
          </div>
          <p className="muted small-note">"Remind me" reminders always go off at the exact time you set.</p>

          {exact === false && (
            <div className="restore-box">
              <p>Reminders may arrive a few minutes late. Allow exact timing so they're on the minute.</p>
              <button className="chip" onClick={() => openExactTimingSettings()}>
                Allow exact timing
              </button>
            </div>
          )}

          {upcoming.length > 0 && (
            <div>
              <span className="color-label">Coming up</span>
              {upcoming.map((p) => (
                <p key={p.id} className="small-note">
                  {fmtShort(p.at)}, {hhmm(p.at)}: <b>{p.title}</b> {p.body && `· ${p.body}`}
                </p>
              ))}
            </div>
          )}

          <div className="row">
            <button
              className="chip"
              onClick={async () => setMsg((await sendTestNotification()) ? 'A test notification will appear in 5 seconds.' : "Notifications aren't allowed yet.")}
            >
              Send a test notification
            </button>
          </div>
          {msg && <p className="muted small-note">{msg}</p>}
        </>
      )}
    </section>
  )
}
