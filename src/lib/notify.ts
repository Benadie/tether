// Reminders as real notifications.
// Android app: scheduled with the system (they appear even when Tether is closed,
// and survive a restart). Browser: shown while the page is open.
import { useEffect, useRef } from 'react'
import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import { isMine } from '../data/store'
import type { AppState, NotificationSettings } from '../data/types'
import { addDays, at, hhmm, isoDate, parseIsoDate, sameDay } from './dates'

export const DEFAULT_NOTIFICATIONS: NotificationSettings = {
  enabled: true,
  taskLead: 15,
  eventLead: 10,
  summary: true,
  summaryTime: '08:00',
}

export const notificationSettings = (s: AppState) => ({ ...DEFAULT_NOTIFICATIONS, ...s.settings.notifications })

const native = Capacitor.isNativePlatform()
const CHANNEL = 'reminders'
const HORIZON_DAYS = 7
const MAX = 60

export interface Planned {
  id: number
  at: Date
  title: string
  body: string
}

/** Small stable number for a notification, from a text key. */
function idFor(key: string) {
  let h = 0
  for (let i = 0; i < key.length; i++) h = (Math.imul(31, h) + key.charCodeAt(i)) | 0
  return Math.abs(h) % 2_000_000_000 || 1
}

export function leadLabel(min: number) {
  if (min === 0) return 'At the time'
  if (min < 60) return `${min} min before`
  if (min < 1440) return `${min / 60} hour${min === 60 ? '' : 's'} before`
  return `${min / 1440} day${min === 1440 ? '' : 's'} before`
}

/** Everything Tether should notify about in the coming week, soonest first. */
export function planNotifications(state: AppState, now = new Date()): Planned[] {
  const cfg = notificationSettings(state)
  if (!cfg.enabled) return []
  const until = addDays(now, HORIZON_DAYS)
  const out: Planned[] = []
  const add = (key: string, when: Date, title: string, body: string) => {
    if (when > now && when < until) out.push({ id: idFor(key), at: when, title, body })
  }

  const open = state.tasks.filter((t) => !t.done && isMine(t))
  for (const t of open) {
    if (t.remindAt) {
      add(`remind:${t.id}`, new Date(t.remindAt), 'Reminder', t.title)
    } else if (t.due && t.time) {
      const start = new Date(at(parseIsoDate(t.due), t.time))
      add(`task:${t.id}:${cfg.taskLead}`, new Date(start.getTime() - cfg.taskLead * 60_000), t.title, cfg.taskLead ? `Due at ${t.time} (in ${leadLabel(cfg.taskLead).replace(' before', '')})` : `Due now, ${t.time}`)
    }
  }

  for (const e of state.events) {
    const start = new Date(e.start)
    add(`event:${e.id}:${e.start}:${cfg.eventLead}`, new Date(start.getTime() - cfg.eventLead * 60_000), e.title, cfg.eventLead ? `Starts at ${hhmm(start)}` : 'Starting now')
  }

  if (cfg.summary) {
    for (let i = 0; i <= HORIZON_DAYS; i++) {
      const day = addDays(now, i)
      const iso = isoDate(day)
      const due = open.filter((t) => t.due === iso).length
      const late = i === 0 ? open.filter((t) => t.due && t.due < iso).length : 0
      const meetings = state.events.filter((e) => sameDay(new Date(e.start), day)).sort((a, b) => a.start.localeCompare(b.start))
      if (!due && !late && !meetings.length) continue
      const parts = [
        due ? `${due} ${due === 1 ? 'task' : 'tasks'} due` : '',
        late ? `${late} running late` : '',
        meetings.length ? `first meeting ${hhmm(new Date(meetings[0].start))} ${meetings[0].title}` : '',
      ].filter(Boolean)
      add(`summary:${iso}`, new Date(at(day, cfg.summaryTime)), 'Your day', parts.join(', ').replace(/^./, (c) => c.toUpperCase()))
    }
  }

  return out.sort((a, b) => a.at.getTime() - b.at.getTime()).slice(0, MAX)
}

/* ---------- Android ---------- */

let channelReady = false

export async function notificationPermission(): Promise<'granted' | 'denied' | 'prompt'> {
  if (native) {
    const p = await LocalNotifications.checkPermissions()
    return p.display === 'granted' ? 'granted' : p.display === 'denied' ? 'denied' : 'prompt'
  }
  if (!('Notification' in window)) return 'denied'
  return Notification.permission === 'default' ? 'prompt' : Notification.permission
}

export async function askNotificationPermission() {
  if (native) return (await LocalNotifications.requestPermissions()).display === 'granted'
  if (!('Notification' in window)) return false
  return (await Notification.requestPermission()) === 'granted'
}

/** Android 12+: exact timing needs "Alarms & reminders" allowed; otherwise reminders can be a few minutes late. */
export async function exactTiming(): Promise<boolean | null> {
  if (!native) return null
  try {
    return (await LocalNotifications.checkExactNotificationSetting()).exact_alarm === 'granted'
  } catch {
    return null
  }
}

export async function openExactTimingSettings() {
  if (native) await LocalNotifications.changeExactNotificationSetting()
}

async function ensureChannel() {
  if (channelReady) return
  // Importance 4 = pops up on screen with sound.
  await LocalNotifications.createChannel({ id: CHANNEL, name: 'Reminders', description: 'Tasks, meetings and your morning summary', importance: 4, vibration: true })
  channelReady = true
}

async function syncNative(plan: Planned[]) {
  if ((await LocalNotifications.checkPermissions()).display !== 'granted') return
  await ensureChannel()
  const pending = await LocalNotifications.getPending()
  if (pending.notifications.length) await LocalNotifications.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) })
  if (!plan.length) return
  await LocalNotifications.schedule({
    notifications: plan.map((p) => ({
      id: p.id,
      title: p.title,
      body: p.body,
      channelId: CHANNEL,
      smallIcon: 'ic_stat_tether',
      iconColor: '#c2497a',
      schedule: { at: p.at, allowWhileIdle: true },
    })),
  })
}

export async function sendTestNotification() {
  const when = new Date(Date.now() + 5000)
  if (native) {
    if ((await LocalNotifications.checkPermissions()).display !== 'granted' && !(await askNotificationPermission())) return false
    await ensureChannel()
    await LocalNotifications.schedule({
      notifications: [{ id: 1, title: 'Tether', body: 'Notifications are working.', channelId: CHANNEL, smallIcon: 'ic_stat_tether', iconColor: '#c2497a', schedule: { at: when, allowWhileIdle: true } }],
    })
    return true
  }
  if (!(await askNotificationPermission())) return false
  setTimeout(() => new Notification('Tether', { body: 'Notifications are working.' }), 5000)
  return true
}

/* ---------- Keep them in step with the data ---------- */

export function useNotifications(state: AppState) {
  const timers = useRef<number[]>([])
  useEffect(() => {
    // Wait a moment so a burst of edits only reschedules once.
    const t = window.setTimeout(() => {
      const plan = planNotifications(state)
      if (native) {
        syncNative(plan).catch((e) => console.warn('Could not schedule notifications', e))
        return
      }
      // Browser: only while the page is open, next 24 hours.
      timers.current.forEach(clearTimeout)
      timers.current = []
      if (!('Notification' in window) || Notification.permission !== 'granted') return
      const soon = Date.now() + 86_400_000
      for (const p of plan.filter((x) => x.at.getTime() < soon)) {
        timers.current.push(window.setTimeout(() => new Notification(p.title, { body: p.body }), p.at.getTime() - Date.now()))
      }
    }, 1500)
    return () => clearTimeout(t)
  }, [state.tasks, state.events, state.settings.notifications])

  useEffect(() => () => timers.current.forEach(clearTimeout), [])
}
