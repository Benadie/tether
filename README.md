# Tether

A pen-first day planner for an 11" Lenovo tablet: today's schedule, week, month
calendar, handwritten notes and "waiting on a reply". Any written line can become a
task, a reminder, a calendar event or an email. Optional link to Outlook; see
[OUTLOOK-SETUP.md](OUTLOOK-SETUP.md).

## Why it's a web app (PWA)

Lenovo's 11" tablets (Tab P11 / M11 / Tab Plus) run Android with Chrome, which gives
web apps full stylus input: pressure, the eraser button and palm rejection. Tether
**installs to the home screen like a normal app**, runs full-screen and works offline.
The same code also runs on a Windows PC or an iPad, and can later be wrapped as a
Play Store app with Capacitor without a rewrite.

## Run it on your PC

```bash
npm install
npm run dev
```

Open http://localhost:5173. A mouse acts as the pen; a click without dragging selects a line.

## Put it on the tablet

**Testing over Wi-Fi:** run `npm run dev:tablet` on the PC, then open the
`https://<pc-ip>:5173` address it prints, using Chrome on the tablet. Accept the
self-signed certificate warning (dev only).

**For daily use:** host the built app on any free HTTPS static host
(Azure Static Web Apps fits a Microsoft 365 firm; Netlify or Cloudflare Pages also work):

```bash
npm run build
```

Upload the `dist` folder. On the tablet, open the address in Chrome → menu (⋮) → **Install app**.
Then add that address as a redirect URI in the Outlook app registration.

## Using the pen

| Input | Does |
|---|---|
| Pen tip | Writes (pressure-sensitive) |
| Pen side button / eraser end | Erases |
| Finger tap on a line | Selects it → *Make it a task, Remind me, Attach to email, Put on calendar* |
| Finger drag | Scrolls (your palm never draws) |
| Toolbar | Pen, highlighter, eraser, keyboard typing, undo |

When you turn a handwritten line into a task, Tether asks for its text. On Android,
Gboard's handwriting mode lets you write that with the pen too.

## Project layout

```
src/
  App.tsx                 sidebar + screen switching, reminders, auto-sync
  data/types.ts           Task, CalEvent, NotePage, Stroke…
  data/store.tsx          state, saved on the tablet (IndexedDB), Outlook merge
  data/seed.ts            demo data (audit firm); clear it in Settings
  sync/outlook.ts         Microsoft sign-in + Graph calls
  components/InkPad.tsx   lined paper, stylus ink, line actions
  screens/                Today, Week, Calendar, Notes, Waiting, Settings
```

## Next steps worth doing

1. **Handwriting to text:** wrap with Capacitor and use Google ML Kit *Digital Ink
   Recognition* (on-device, free) so written lines become text automatically.
2. **Reminders when the app is closed:** with Outlook linked they already go to Microsoft
   To Do. Standalone needs the Capacitor local-notifications plugin.
3. **Client/engagement tags** on tasks and pages (e.g. filter everything for Harlow).
