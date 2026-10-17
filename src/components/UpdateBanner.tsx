import { useEffect, useState } from 'react'
import { App as NativeApp } from '@capacitor/app'
import { Browser } from '@capacitor/browser'
import { Download, X } from 'lucide-react'
import { checkForUpdate, updatesEnabled, type Update } from '../lib/updates'

const CHECK_EVERY_MS = 6 * 3_600_000

/** "Version 1.1.0 is ready" bar. Update downloads the new APK; Android then asks to install it over this one. */
export function UpdateBanner() {
  const [update, setUpdate] = useState<Update | null>(null)
  const [dismissed, setDismissed] = useState('')

  useEffect(() => {
    if (!updatesEnabled()) return
    let last = 0
    const check = () => {
      if (Date.now() - last < 60_000) return
      last = Date.now()
      checkForUpdate().then(setUpdate)
    }
    check()
    const timer = setInterval(check, CHECK_EVERY_MS)
    // Also check whenever the app comes back to the front.
    const sub = NativeApp.addListener('resume', check)
    return () => {
      clearInterval(timer)
      sub.then((s) => s.remove())
    }
  }, [])

  if (!update || dismissed === update.version) return null
  return (
    <div className="update-banner" role="status">
      <Download size={20} />
      <span>
        <b>Version {update.version} is ready.</b> Your notes and tasks are kept when you update.
      </span>
      <button className="chip primary" onClick={() => Browser.open({ url: update.url })}>
        Update
      </button>
      <button className="round ghost" aria-label="Later" onClick={() => setDismissed(update.version)}>
        <X size={18} />
      </button>
    </div>
  )
}
