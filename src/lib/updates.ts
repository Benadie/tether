// Auto-update for the Android APK. Each new version is published as a GitHub
// Release with the APK attached; the app checks the latest release and offers it.
// Set VITE_UPDATE_REPO=owner/repo in .env.local (the repo must be public).
import { Capacitor } from '@capacitor/core'

declare const __APP_VERSION__: string
export const APP_VERSION = __APP_VERSION__

const REPO = import.meta.env.VITE_UPDATE_REPO as string | undefined

export const updatesEnabled = () => Capacitor.isNativePlatform() && Boolean(REPO)

export interface Update {
  version: string
  url: string
  notes: string
}

/** 1.2.10 > 1.2.9 */
export function isNewer(candidate: string, current: string) {
  const a = candidate.replace(/^v/, '').split('.').map(Number)
  const b = current.replace(/^v/, '').split('.').map(Number)
  for (let i = 0; i < 3; i++) {
    if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) > (b[i] ?? 0)
  }
  return false
}

/** The newer release with an APK attached, or null when up to date / offline / not configured. */
export async function checkForUpdate(): Promise<Update | null> {
  if (!updatesEnabled()) return null
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
      headers: { Accept: 'application/vnd.github+json' },
    })
    if (!res.ok) return null
    const release = await res.json()
    const apk = (release.assets as any[])?.find((a) => String(a.name).endsWith('.apk'))
    if (!apk || !isNewer(release.tag_name, APP_VERSION)) return null
    return { version: String(release.tag_name).replace(/^v/, ''), url: apk.browser_download_url, notes: release.body ?? '' }
  } catch {
    return null
  }
}
