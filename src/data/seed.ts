import { addDays, at, isoDate, startOfDay, workWeekStart } from '../lib/dates'
import { uid } from '../lib/id'
import type { AppState, CalEvent, Clerk, NoteLine, NotePage, Task } from './types'

/** Demo data for an audit & accounting practice, laid out around today's date.
 *  Client names are made up. Clear it from Settings. */
export function makeSeed(now = new Date()): AppState {
  const today = startOfDay(now)
  const mon = workWeekStart(today)
  const day = (n: number) => addDays(today, n)
  const wk = (n: number) => addDays(mon, n)

  const event = (d: Date, title: string, start: string, end: string): CalEvent => ({
    id: uid(),
    title,
    start: at(d, start),
    end: at(d, end),
    source: 'local',
  })
  const task = (title: string, d: Date, extra: Partial<Task> = {}): Task => ({
    id: uid(),
    title,
    due: isoDate(d),
    done: false,
    source: 'local',
    ...extra,
  })

  const events: CalEvent[] = []
  for (let i = 0; i < 10; i++) {
    const d = addDays(mon, i + (i >= 5 ? 2 : 0))
    events.push(event(d, 'Audit team stand-up', '08:30', '09:00'))
  }
  events.push(
    event(today, 'Kick-off: Harlow Logistics audit', '10:00', '11:00'),
    event(today, 'Partner review, Brightwater file', '15:00', '16:00'),
    event(wk(1), 'Stocktake attendance, Kestrel Retail', '07:00', '12:00'),
    event(wk(2), 'Client meeting: Oakfield Trust', '13:00', '14:30'),
    event(wk(3), 'Audit committee, Brightwater Foods', '10:00', '12:00'),
    event(wk(4), 'CPD: IFRS 18 update', '14:00', '16:00'),
  )

  const mgmtLetter = task('Send draft management letter to Brightwater', today, { time: '14:00', source: 'note' })
  const goingConcern = task('Finalise going concern memo, Harlow', day(-2), { from: 'Audit partner', source: 'note' })
  const clerks: Clerk[] = [
    { id: uid(), name: 'Aisha Patel', role: 'Trainee, year 3' },
    { id: uid(), name: 'Ben Carter', role: 'Trainee, year 1' },
    { id: uid(), name: 'Chloe Martin', role: 'Trainee, year 2' },
  ]
  const [aisha, ben, chloe] = clerks.map((c) => c.id)
  const clerkTask = (title: string, d: Date, assignee: string, status: Task['status'], client: string) =>
    task(title, d, { assignee, status, client })

  const tasks: Task[] = [
    goingConcern,
    task('Submit VAT return, Oakfield Trust', day(-1), { from: 'Tax deadline', repeat: 'monthly' }),
    mgmtLetter,
    task('Clear review notes on revenue section', today, { time: '16:00' }),
    task('Reconcile trial balance to AFS', today, { from: 'Audit manager' }),
    task('Update timesheets and WIP', today, { from: 'Practice manager', repeat: 'weekly' }),
    task('Sign engagement letter, Kestrel Retail', wk(1)),
    task('Debtors circularisation follow-up', wk(3)),
    task('Weekly WIP report to partners', wk(4), { repeat: 'weekly' }),

    clerkTask('Bank reconciliation testing', today, aisha, 'doing', 'Harlow Logistics'),
    clerkTask('Revenue cut-off testing', day(-1), aisha, 'todo', 'Harlow Logistics'),
    clerkTask('Lead schedules for AFS', wk(3), aisha, 'review', 'Brightwater Foods'),
    clerkTask('Fixed asset additions testing', wk(1), ben, 'todo', 'Harlow Logistics'),
    clerkTask('Stocktake: prepare count sheets', wk(1), ben, 'doing', 'Kestrel Retail'),
    clerkTask('Payroll walkthrough', today, chloe, 'review', 'Brightwater Foods'),
    clerkTask('Debtors circularisation letters', wk(2), chloe, 'doing', 'Brightwater Foods'),
  ]


  const line = (text: string, tags: NoteLine['tags'] = []): NoteLine => ({ id: uid(), text, strokes: [], tags })
  const page = (title: string, created: Date, lines: NoteLine[], extra: Partial<NotePage> = {}): NotePage => ({
    id: uid(),
    title,
    created: created.toISOString(),
    updated: created.toISOString(),
    lines,
    ...extra,
  })

  const daily = page('', today, [
    line('Mgmt letter: 3 findings', [{ kind: 'task', label: '14:00 task', refId: mgmtLetter.id }]),
    line('Ask client for FA register'),
    line('Bank conf: chase bank Wed'),
    line(''),
    line('Materiality: 1.2m, perf. 75%'),
  ])
  daily.id = `daily-${isoDate(today)}`
  daily.day = isoDate(today)
  daily.updated = now.toISOString()

  const planning = page('Planning meeting, Harlow', day(-3), [
    line('Going concern: cash flow forecast', [{ kind: 'task', label: 'Task made', refId: goingConcern.id }]),
    line('Revenue: test cut-off both sides of YE'),
    line(''),
    line('Related parties? ask FD'),
    line('Stocktake Tues 07:00', [{ kind: 'calendar', label: 'On calendar' }]),
  ])
  planning.updated = at(day(-3), '11:20')

  return {
    tasks,
    events,
    waiting: [
      { id: uid(), title: 'Bank confirmation, Harlow', who: 'Bank', since: isoDate(day(-6)), done: false },
      { id: uid(), title: 'Signed rep letter', who: 'Brightwater FD', since: isoDate(day(-4)), done: false },
      { id: uid(), title: 'Legal confirmation letter', who: 'Lawyers', since: isoDate(day(-3)), done: false },
      { id: uid(), title: 'Fixed asset register', who: 'Client, Oakfield', since: isoDate(day(-1)), done: false },
    ],
    pages: [
      daily,
      planning,
      page('Stocktake checklist', day(-5), [
        line('Count sheets numbered + controlled'),
        line('Test counts: floor to sheet, sheet to floor'),
        line('Cut-off: last GRN / delivery note'),
        line('Note damaged / obsolete stock'),
      ]),
      page('Brightwater: PBC list', day(-6), [line('Debtors age analysis'), line('Payroll recons'), line('Loan agreements')], {
        linkedEmail: 'Brightwater FD',
      }),
      page('Ideas', day(-11), [line('Shared PBC tracker with clients')]),
    ],
    clerks,
    settings: { name: '' },
  }
}
