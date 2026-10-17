// Outlook / Microsoft 365 connection through Microsoft Graph.
// Works with work/school (Microsoft 365) and personal (outlook.com) accounts.
// Set VITE_MS_CLIENT_ID in .env.local; see OUTLOOK-SETUP.md for the 10-minute setup.
import { PublicClientApplication, type AccountInfo, InteractionRequiredAuthError } from '@azure/msal-browser'
import { hhmm, isoDate } from '../lib/dates'
import { uid } from '../lib/id'
import type { CalEvent, Task, WaitingItem } from '../data/types'

const CLIENT_ID = import.meta.env.VITE_MS_CLIENT_ID as string | undefined
const AUTHORITY = (import.meta.env.VITE_MS_AUTHORITY as string | undefined) ?? 'https://login.microsoftonline.com/common'
const GRAPH = 'https://graph.microsoft.com/v1.0'

export const SCOPES = ['User.Read', 'Calendars.ReadWrite', 'Mail.ReadWrite', 'Tasks.ReadWrite']

/** Outlook category you put on sent emails you are waiting on. */
export const WAITING_CATEGORY = 'Waiting'

export const outlookConfigured = () => Boolean(CLIENT_ID)

let pca: PublicClientApplication | null = null
let account: AccountInfo | null = null

/** Call once at startup: finishes a sign-in redirect and restores the last account. */
export async function initOutlook(): Promise<AccountInfo | null> {
  if (!CLIENT_ID) return null
  pca = new PublicClientApplication({
    auth: { clientId: CLIENT_ID, authority: AUTHORITY, redirectUri: window.location.origin },
    cache: { cacheLocation: 'localStorage' },
  })
  await pca.initialize()
  const result = await pca.handleRedirectPromise()
  account = result?.account ?? pca.getAllAccounts()[0] ?? null
  return account
}

// Redirect rather than popup: popups are unreliable in an installed tablet app.
export async function signIn() {
  if (!pca) throw new Error('Outlook is not set up yet (missing VITE_MS_CLIENT_ID)')
  await pca.loginRedirect({ scopes: SCOPES, prompt: 'select_account' })
}

export async function signOut() {
  if (pca && account) await pca.logoutRedirect({ account })
  account = null
}

async function token() {
  if (!pca || !account) throw new Error('Not signed in to Outlook')
  try {
    return (await pca.acquireTokenSilent({ scopes: SCOPES, account })).accessToken
  } catch (e) {
    if (e instanceof InteractionRequiredAuthError) await pca.acquireTokenRedirect({ scopes: SCOPES, account })
    throw e
  }
}

async function graph<T = any>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(path.startsWith('http') ? path : GRAPH + path, {
    ...init,
    headers: {
      Authorization: `Bearer ${await token()}`,
      'Content-Type': 'application/json',
      Prefer: `outlook.timezone="${Intl.DateTimeFormat().resolvedOptions().timeZone}"`,
      ...init.headers,
    },
  })
  if (!res.ok) throw new Error(`Graph ${res.status}: ${await res.text()}`)
  return res.status === 204 ? (undefined as T) : res.json()
}

// Graph returns local wall-clock times without an offset when Prefer: outlook.timezone is set.
const localDate = (s: string) => new Date(s.replace(/\.\d+$/, ''))
const tz = () => Intl.DateTimeFormat().resolvedOptions().timeZone
const local = (d: Date) => `${isoDate(d)}T${hhmm(d)}:00`

/* ---------- Reading ---------- */

export async function fetchEvents(from: Date, to: Date): Promise<CalEvent[]> {
  const q = new URLSearchParams({
    startDateTime: from.toISOString(),
    endDateTime: to.toISOString(),
    $select: 'id,subject,start,end,isAllDay,isCancelled',
    $top: '200',
  })
  const data = await graph<{ value: any[] }>(`/me/calendarView?${q}`)
  return data.value
    .filter((e) => !e.isCancelled && !e.isAllDay)
    .map((e) => ({
      id: uid(),
      outlookId: e.id,
      title: e.subject || '(no subject)',
      start: localDate(e.start.dateTime).toISOString(),
      end: localDate(e.end.dateTime).toISOString(),
      source: 'outlook' as const,
    }))
}

/** Flagged emails become tasks. The flag's due date sets the task's day. */
export async function fetchFlagged(): Promise<Task[]> {
  const q = new URLSearchParams({
    $filter: "flag/flagStatus eq 'flagged'",
    $select: 'id,subject,from,flag,receivedDateTime',
    $top: '100',
  })
  const data = await graph<{ value: any[] }>(`/me/messages?${q}`)
  return data.value.map((m) => ({
    id: uid(),
    outlookId: m.id,
    title: m.subject || '(no subject)',
    due: m.flag?.dueDateTime ? isoDate(localDate(m.flag.dueDateTime.dateTime)) : isoDate(new Date()),
    from: m.from?.emailAddress?.name,
    done: false,
    source: 'outlook' as const,
  }))
}

/** Sent emails you tagged with the "Waiting" category become "Waiting on a reply". */
export async function fetchWaiting(): Promise<WaitingItem[]> {
  const q = new URLSearchParams({
    $filter: `categories/any(c:c eq '${WAITING_CATEGORY}')`,
    $select: 'id,subject,toRecipients,sentDateTime',
    $top: '50',
  })
  const data = await graph<{ value: any[] }>(`/me/mailFolders/sentitems/messages?${q}`)
  return data.value.map((m) => {
    const to = m.toRecipients?.[0]?.emailAddress
    return {
      id: uid(),
      outlookId: m.id,
      title: m.subject || '(no subject)',
      who: to?.name || to?.address || 'Someone',
      email: to?.address,
      since: isoDate(new Date(m.sentDateTime)),
      done: false,
    }
  })
}

/* ---------- Writing ---------- */

export async function createEvent(title: string, start: Date, end: Date) {
  const e = await graph('/me/events', {
    method: 'POST',
    body: JSON.stringify({
      subject: title,
      start: { dateTime: local(start), timeZone: tz() },
      end: { dateTime: local(end), timeZone: tz() },
    }),
  })
  return e.id as string
}

/** Adds the task to Microsoft To Do (it also shows in Outlook's task list). */
export async function createTodoTask(title: string, due?: string, remindAt?: Date) {
  const lists = await graph<{ value: any[] }>('/me/todo/lists')
  const list = lists.value.find((l) => l.wellknownListName === 'defaultList') ?? lists.value[0]
  const body: any = { title }
  if (due) body.dueDateTime = { dateTime: `${due}T00:00:00`, timeZone: tz() }
  if (remindAt) {
    body.isReminderOn = true
    body.reminderDateTime = { dateTime: local(remindAt), timeZone: tz() }
  }
  const t = await graph(`/me/todo/lists/${list.id}/tasks`, { method: 'POST', body: JSON.stringify(body) })
  return t.id as string
}

/** Ticking off a flagged-email task marks the flag complete in Outlook. */
export async function completeFlag(messageId: string) {
  await graph(`/me/messages/${messageId}`, {
    method: 'PATCH',
    body: JSON.stringify({ flag: { flagStatus: 'complete' } }),
  })
}

/** Creates a draft in Outlook and returns a link that opens it. */
export async function createDraft(subject: string, body: string, to?: string) {
  const m = await graph('/me/messages', {
    method: 'POST',
    body: JSON.stringify({
      subject,
      body: { contentType: 'Text', content: body },
      toRecipients: to ? [{ emailAddress: { address: to } }] : [],
    }),
  })
  return m.webLink as string
}

/** Drafts a follow-up reply to a sent email and returns a link that opens it. */
export async function draftNudge(messageId: string) {
  const reply = await graph(`/me/messages/${messageId}/createReply`, {
    method: 'POST',
    body: JSON.stringify({ comment: 'Hi, just following up on this. Any update?' }),
  })
  return reply.webLink as string
}
