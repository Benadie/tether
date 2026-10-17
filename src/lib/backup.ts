// Backups of everything in Tether (tasks, notes and ink, events, team, settings).
// - Daily automatic copy on the tablet: Documents/Tether (last 14 kept)
// - "Back up now": share the file to OneDrive / Google Drive / email
// - Restore from a backup file
import { Capacitor } from '@capacitor/core'
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'
import type { AppState } from '../data/types'
import { hhmm, isoDate } from './dates'
import { APP_VERSION } from './updates'

const native = Capacitor.isNativePlatform()
const FOLDER = 'Tether'
const KEEP = 14
const LAST_KEY = 'tether-last-auto-backup'

export interface BackupFile {
  app: 'tether'
  version: string
  exportedAt: string
  data: AppState
}

const toJson = (state: AppState) =>
  JSON.stringify({ app: 'tether', version: APP_VERSION, exportedAt: new Date().toISOString(), data: state } satisfies BackupFile)

const fileName = (d = new Date()) => `Tether-backup-${isoDate(d)}-${hhmm(d).replace(':', '')}.json`

export function lastAutoBackup(): string | null {
  try {
    return localStorage.getItem(LAST_KEY)
  } catch {
    return null
  }
}

/** Once a day: writes a copy to Documents/Tether on the tablet and prunes old ones. */
export async function autoBackupIfDue(state: AppState, force = false): Promise<string | null> {
  if (!native) return null
  const last = lastAutoBackup()
  if (!force && last && last.slice(0, 10) === isoDate(new Date())) return null
  const name = fileName()
  await Filesystem.writeFile({
    path: `${FOLDER}/${name}`,
    data: toJson(state),
    directory: Directory.Documents,
    encoding: Encoding.UTF8,
    recursive: true,
  })
  try {
    localStorage.setItem(LAST_KEY, new Date().toISOString())
  } catch {
    /* not critical */
  }
  // Keep the newest KEEP backups.
  const { files } = await Filesystem.readdir({ path: FOLDER, directory: Directory.Documents })
  const old = files
    .map((f) => f.name)
    .filter((n) => /^Tether-backup-.*\.json$/.test(n))
    .sort()
    .reverse()
    .slice(KEEP)
  await Promise.all(old.map((n) => Filesystem.deleteFile({ path: `${FOLDER}/${n}`, directory: Directory.Documents })))
  return name
}

/** Opens the share sheet (Android) or downloads the file (browser) so it can go to the cloud. */
export async function shareBackup(state: AppState) {
  const name = fileName()
  const json = toJson(state)
  if (native) {
    const { uri } = await Filesystem.writeFile({ path: name, data: json, directory: Directory.Cache, encoding: Encoding.UTF8 })
    await Share.share({ title: 'Tether backup', text: `Tether backup ${isoDate(new Date())}`, files: [uri], dialogTitle: 'Save your Tether backup' })
    return
  }
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

/** Reads and checks a backup file the user picked. Throws a readable message if it isn't one. */
export async function readBackup(file: File): Promise<BackupFile> {
  let parsed: any
  try {
    parsed = JSON.parse(await file.text())
  } catch {
    throw new Error("That file isn't a Tether backup.")
  }
  const d = parsed?.data
  if (parsed?.app !== 'tether' || !d || !Array.isArray(d.tasks) || !Array.isArray(d.pages) || !d.settings) {
    throw new Error("That file isn't a Tether backup.")
  }
  return parsed as BackupFile
}
