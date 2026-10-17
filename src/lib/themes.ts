// Colour schemes. Each one sets the CSS variables the whole app is styled with.

export interface Theme {
  id: string
  name: string
  bg: string // page background
  accent: string // buttons, ticks, highlights
  accentSoft: string
  dark: string // selected menu item, today's date
  line: string // dividers
  tint: string // very light fill (cards inside cards)
  paperLine: string // notepad ruling
  paperSel: string // selected note line
  event: string // meetings
  eventSoft: string
  ink: string // default text colour
}

export const THEMES: Theme[] = [
  { id: 'pink', name: 'Baby pink', bg: '#fbe8ee', accent: '#c2497a', accentSoft: '#fcdde8', dark: '#6e2f4a', line: '#f3dbe3', tint: '#fff5f8', paperLine: '#f6d3df', paperSel: '#fcd2e0', event: '#7a4fb0', eventSoft: '#efe6fa', ink: '#3a2430' },
  { id: 'lavender', name: 'Lavender', bg: '#efe9fb', accent: '#7c4dcc', accentSoft: '#e6dcfa', dark: '#3f2a6b', line: '#e3dcf3', tint: '#f8f5fe', paperLine: '#ddd2f3', paperSel: '#e3d6fb', event: '#c2497a', eventSoft: '#fbe3ec', ink: '#2d2440' },
  { id: 'mint', name: 'Mint', bg: '#e3f2ec', accent: '#1f8a63', accentSoft: '#d3efe3', dark: '#1d4d3c', line: '#d8ebe2', tint: '#f4fbf8', paperLine: '#cfe6db', paperSel: '#d0f0e2', event: '#2f6db5', eventSoft: '#e1ecf9', ink: '#1f2e28' },
  { id: 'sky', name: 'Sky blue', bg: '#e4eef9', accent: '#2f6db5', accentSoft: '#d9e6f7', dark: '#1f3d66', line: '#d9e3f0', tint: '#f5f9fe', paperLine: '#d0ddee', paperSel: '#d6e6fb', event: '#7a4fb0', eventSoft: '#efe6fa', ink: '#1e2a3a' },
  { id: 'peach', name: 'Peach', bg: '#fcebe0', accent: '#d0683a', accentSoft: '#fbdccb', dark: '#6b3520', line: '#f3dfd2', tint: '#fff7f2', paperLine: '#f2d5c3', paperSel: '#fde0cc', event: '#2f6db5', eventSoft: '#e1ecf9', ink: '#3a2a22' },
  { id: 'sage', name: 'Sage', bg: '#e8ece6', accent: '#1e7a46', accentSoft: '#e3efe3', dark: '#202322', line: '#e4e7e3', tint: '#f6f8f5', paperLine: '#e2e6df', paperSel: '#fde58a', event: '#1e4fa3', eventSoft: '#dfe9f8', ink: '#1f2421' },
  { id: 'slate', name: 'Slate', bg: '#e6e8ec', accent: '#3d4a5c', accentSoft: '#dde1e8', dark: '#1f2733', line: '#dcdfe5', tint: '#f5f6f8', paperLine: '#d9dde4', paperSel: '#e1e6ef', event: '#2f6db5', eventSoft: '#e1ecf9', ink: '#1d232c' },
]

export const themeById = (id?: string) => THEMES.find((t) => t.id === id) ?? THEMES[0]

/** Applies a scheme to the page. A text colour picked in Settings still wins over the scheme's. */
export function applyTheme(theme: Theme, textColor?: string) {
  const root = document.documentElement.style
  const vars: Record<string, string> = {
    '--bg': theme.bg,
    '--accent': theme.accent,
    '--accent-soft': theme.accentSoft,
    '--dark': theme.dark,
    '--line': theme.line,
    '--tint': theme.tint,
    '--paper-line': theme.paperLine,
    '--paper-sel': theme.paperSel,
    '--event': theme.event,
    '--event-soft': theme.eventSoft,
    '--ink': textColor || theme.ink,
  }
  for (const [k, v] of Object.entries(vars)) root.setProperty(k, v)
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme.bg)
}
