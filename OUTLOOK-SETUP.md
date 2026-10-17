# Linking Tether to Outlook

Tether works on its own: every note, task and event is saved on the tablet.
Linking Outlook is optional. Once linked, Tether pulls your Outlook data in and
pushes what you create back out. It talks to Microsoft directly through
**Microsoft Graph**; there's no server of ours in between.

## What syncs

| In Outlook | In Tether | Direction |
|---|---|---|
| Calendar meetings | Schedule, Week, Calendar | Outlook → Tether, and new events you add go back |
| **Flagged emails** (with a due date) | Tasks on that day | Outlook → Tether; ticking one off marks the flag complete |
| Sent emails with the **Waiting** category | "Waiting on a reply" | Outlook → Tether; *Nudge* drafts a follow-up reply |
| Microsoft To Do | Tasks and reminders you make from notes | Tether → To Do (so reminders reach your phone too) |
| Drafts | "Attach to email" on a note line | Tether → a new Outlook draft |

Sync runs when the app opens and every 10 minutes, or from **Settings → Sync now**.

### Habits that make it work
- **Flag** any email that's a job for you, and set a due date (right-click the flag → *Custom*). It lands on that day in Tether.
- When you send a request (bank confirmation, rep letter, PBC items), put the **Waiting** category on the sent email. Tether lists it with a day count, and you can nudge from there.

---

## Step 1: Work account or personal?

- **Work / firm Microsoft 365 account** (you@yourfirm.com): your firm's IT may have to approve the app.
  Audit and accounting firms usually lock this down, so ask IT early. Show them the
  permission list in Step 3: all *delegated* permissions, only your own mailbox, and data
  stays between the tablet and Microsoft.
- **Personal outlook.com / hotmail account**: you can do every step yourself.

## Step 2: Register the app with Microsoft (about 10 minutes)

1. Go to <https://entra.microsoft.com> → **Applications → App registrations → New registration**.
   (For a personal account, sign in to the same page with that account.)
2. **Name:** `Tether`
3. **Supported account types:**
   - Firm account only: *Accounts in this organizational directory only*
   - Personal account: *Personal Microsoft accounts only*
   - Both: *Any Entra ID tenant + personal Microsoft accounts*
4. **Redirect URI:** platform **Single-page application (SPA)**, value `http://localhost:5173`
5. Click **Register**, then copy the **Application (client) ID**.
6. Under **Authentication → Single-page application**, add the address the tablet will use, e.g.
   `https://192.168.1.50:5173` while testing, and your hosted address later (see README).

## Step 3: Permissions

**API permissions → Add a permission → Microsoft Graph → Delegated permissions**:

| Permission | Why |
|---|---|
| `User.Read` | Your name and email |
| `Calendars.ReadWrite` | Read meetings, add events from notes |
| `Mail.ReadWrite` | Read flagged and *Waiting* emails, create drafts and nudges, mark flags complete |
| `Tasks.ReadWrite` | Add tasks and reminders to Microsoft To Do |

On a firm account, IT clicks **Grant admin consent** (or you'll be asked to request approval on first sign-in).

## Step 4: Tell Tether the ID

Create a file called `.env.local` in the project folder (copy `.env.example`):

```
VITE_MS_CLIENT_ID=paste-the-application-client-id-here
# Firm-only registration: use your tenant ID instead of "common"
# VITE_MS_AUTHORITY=https://login.microsoftonline.com/<tenant-id>
# Personal-only registration:
# VITE_MS_AUTHORITY=https://login.microsoftonline.com/consumers
```

Restart `npm run dev`, then open **Settings (sliders icon) → Connect Outlook** and sign in.

## If IT says no

- Keep using Tether standalone. It's built to work that way.
- Read-only calendar: Outlook can **publish your calendar** as an ICS link (Outlook on the web → Settings → Calendar → Shared calendars → Publish). An ICS import could be added to Tether later if needed.
- Or ask whether your firm allows **Power Automate**, which can copy flagged emails into Microsoft To Do. Tether can then read To Do once Graph is approved.

## Client confidentiality

Client data stays on the tablet (browser storage for this app) and in your Microsoft 365 tenant.
Turn on a screen lock and device encryption on the tablet (Android does this by default once
a PIN is set), and check your firm's device policy before using it with client files.
