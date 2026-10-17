import { useState } from 'react'
import { useStore } from '../data/store'
import { fmtShort, hhmm } from '../lib/dates'
import { ScreenHeader } from '../components/common'
import * as outlook from '../sync/outlook'
import { APP_VERSION, checkForUpdate, updatesEnabled } from '../lib/updates'
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
          <h2>Colours</h2>
          <ColorPicker
            label="App text"
            swatches={TEXT_SWATCHES}
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
          <p className="muted">New pen strokes use the ink colour; what you've already written keeps its colour.</p>
        </section>

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
                  {busy ? 'Syncingâ€¦' : 'Sync now'}
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

        <section className="card form">
          <h2>App version</h2>
          <p>
            Tether <b>{APP_VERSION}</b>
          </p>
          {updatesEnabled() ? (
            <>
              <button
                className="chip"
                disabled={updateMsg === 'Checkingâ€¦'}
                onClick={async () => {
                  setUpdateMsg('Checkingâ€¦')
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
