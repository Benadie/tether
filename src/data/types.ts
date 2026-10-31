export type Source = 'local' | 'note'

export interface Task {
  id: string
  title: string
  /** YYYY-MM-DD; no due date means "someday" */
  due?: string
  /** HH:MM; puts the task on the schedule */
  time?: string
  done: boolean
  /** When it was ticked off (ISO) */
  doneAt?: string
  /** Who asked for it, e.g. "Manager" */
  from?: string
  source: Source
  noteRef?: { pageId: string; lineId: string }
  /** ISO timestamp of a reminder */
  remindAt?: string
  /** Clerk id when the task is delegated; no assignee means it's yours */
  assignee?: string
  /** Progress for delegated work (ticking it off still means done) */
  status?: TaskStatus
  /** Client / engagement, e.g. "Harlow Logistics" */
  client?: string
  /** Comes back automatically when ticked off */
  repeat?: Repeat
  /** The client (Clients tab) this task belongs to */
  clientId?: string
  /** Which company in the client's group it's for, e.g. "Moretti Properties (Pty) Ltd" */
  company?: string
}

/** A client on the Clients tab: one company, or a group of companies. */
export interface Client {
  id: string
  name: string
  /** e.g. "MOR001" */
  code?: string
  /** The companies in the group (empty for a single company) */
  companies: Company[]
  created: string
}

export interface Company {
  id: string
  name: string
  /** Short remark, e.g. "dormant" or "year end Feb" */
  note?: string
}

export type TaskStatus = 'todo' | 'doing' | 'review'
export type Repeat = 'weekly' | 'monthly' | 'yearly'

export interface Clerk {
  id: string
  name: string
  /** e.g. "Trainee, year 2" */
  role?: string
}

/** VAT period: every month, or two-monthly ending in even (Feb, Apr…) or uneven (Jan, Mar…) months */
export type VatCycle = 'monthly' | 'even' | 'uneven'

export interface VatClient {
  id: string
  client: string
  cycle: VatCycle
  /** Name of the person doing it, e.g. "Lyrisha" */
  responsible?: string
  /** No longer shown (you're the portfolio manager for all); kept so saved values aren't lost */
  portfolioManager?: string
  /** e.g. "Processing; VAT; payroll" */
  notes?: string
}

/** The checklist for one client's VAT period. Each item holds the date it was ticked (ISO). */
export interface VatChecks {
  followedUp?: string
  doneByClerk?: string
  reviewed?: string
  empHandedIn?: string
}

export interface PayrollClient {
  id: string
  client: string
  /** Name of the person doing it, e.g. "Azhar" */
  responsible?: string
  /** Task / comments / payroll department, e.g. "Only EMP submission" */
  comments?: string
}

/** A payroll checklist box: ✓ done, ✗ not done, or n/a; with the date it was set. */
export interface PayrollMark {
  s: 'done' | 'no' | 'na'
  at: string
}

export type PayrollItem = 'followedUp' | 'completedByClerk' | 'sentToClient' | 'empSubmitted'
export type PayrollChecks = Partial<Record<PayrollItem, PayrollMark>>

export interface CalEvent {
  id: string
  title: string
  start: string // ISO
  end: string // ISO
  source: Source
}

export interface Stroke {
  id: string
  tool: 'pen' | 'highlighter'
  color: string
  size: number
  /** Flat [x, y, pressure, x, y, pressure, ...], y relative to the top of its line */
  points: number[]
  /** Mouse / finger input has no real pressure, so we simulate it */
  simulate?: boolean
}

export type LineTagKind = 'task' | 'calendar' | 'reminder' | 'email'

export interface LineTag {
  kind: LineTagKind
  label: string
  refId?: string
}

export interface NoteLine {
  id: string
  text: string
  strokes: Stroke[]
  tags: LineTag[]
  /** What the handwriting on this line reads as (filled in automatically, used for search) */
  ocr?: string
  /** Colour of the typed text: the pen colour it was written in, so changing pens later doesn't recolour it */
  color?: string
}

export interface NotePage {
  id: string
  title: string
  created: string
  updated: string
  /** Set for the automatic per-day page (YYYY-MM-DD) */
  day?: string
  /** Who the linked email came from, e.g. "HR" */
  linkedEmail?: string
  /** Set for a client's notes page (Clients tab) */
  clientId?: string
  lines: NoteLine[]
}

export interface Settings {
  name: string
  /** App text colour (headings, lists, labels) */
  textColor?: string
  /** Handwriting and typed-note colour */
  inkColor?: string
  /** Highlighter colour (drawn see-through) */
  highlightColor?: string
  /** What happens after you write a line: turn it into typed text (default) or keep the ink */
  handwriting?: 'convert' | 'keep'
  /** Colour scheme id (see lib/themes.ts) */
  theme?: string
  notifications?: NotificationSettings
}

export interface NotificationSettings {
  enabled: boolean
  /** Minutes before a task that has a time */
  taskLead: number
  /** Minutes before a meeting */
  eventLead: number
  /** Morning summary of the day */
  summary: boolean
  /** HH:MM */
  summaryTime: string
}

export interface AppState {
  tasks: Task[]
  events: CalEvent[]
  pages: NotePage[]
  clerks: Clerk[]
  vatClients: VatClient[]
  /** Checklists keyed "clientId:YYYY-MM" (the month the VAT period ends) */
  vatChecks: Record<string, VatChecks>
  payrollClients: PayrollClient[]
  /** Checklists keyed "clientId:YYYY-MM" (the payroll month) */
  payrollChecks: Record<string, PayrollChecks>
  clients: Client[]
  settings: Settings
}
