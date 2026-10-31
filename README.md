# Tether

A pen-first day planner for an 11" Lenovo Android tablet, built for running an audit
team: today's schedule, week and month calendars, a dashboard, handwritten notes that
turn into text, a team board for your clerks, reminders and notifications. Everything
is stored on the tablet only; nothing is sent anywhere.

## Install on the tablet

Download the latest `Tether-x.y.z.apk` from the
[releases page](https://github.com/Benadie/tether/releases/latest) on the tablet, open
it and tap **Install**. After that, Tether checks for new versions itself and shows an
**Update** bar. Updates keep all your notes and tasks.

## Using the pen

| Input | Does |
|---|---|
| Pen tip | Writes (pressure-sensitive). A moment after you stop, the line becomes typed text (Undo brings the ink back) |
| Pen side button / eraser end | Erases ink and typed words |
| Finger tap on a line | Selects it → *Remind me (spotted date)*, *Make it a task*, *Convert to text*, *Remind me*, *Attach to email*, *Put on calendar*, *Delete* |
| Finger drag | Scrolls (your palm never draws) |
| Pen / highlighter button, tapped again | Pick the colour for what you write next |

Handwriting is read on the tablet with Google ML Kit (the English model downloads once).

## Building a new version (on the PC)

```bash
npm install
npm run apk
```

`npm run apk` builds the app and signs it with the key in `%USERPROFILE%\TetherKeys`
(keep that folder backed up: every update must be signed with it). Bump `version` in
`package.json` first; the output is `release\Tether-<version>.apk`. Publish it as a GitHub
release and installed copies offer the update.

To try changes on the PC: `npm run dev` and open http://localhost:5173 (a mouse acts as the pen).

## Project layout

```
src/
  App.tsx                 sidebar, screen switching, notifications, backups
  data/types.ts           Task, CalEvent, NotePage, Stroke, Clerk…
  data/store.tsx          state, saved on the tablet (IndexedDB)
  data/seed.ts            demo data (audit firm); clear it in Settings
  components/InkPad.tsx   lined paper, stylus ink, line actions
  lib/                    dates, smart dates (when.ts), handwriting, notifications,
                          backups, themes, app updates
  screens/                Dashboard, Today, Week, Calendar, Notes, Team, Settings
android/                  the Android app (Capacitor), incl. HandwritingPlugin.java
scripts/build-apk.ps1     signed APK build
```
