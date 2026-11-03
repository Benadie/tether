# Freelancer Agents — free setup

Two helpers in one n8n workflow. Both are **read-only**: they never send anything on Freelancer.

| Helper | What it does |
|---|---|
| **Customer Service Assistant** | Every 2 min, reads new client messages, drafts a reply with Gemini, and sends it to you on Telegram to copy and send yourself. |
| **Won Projects → Upwork Post** | Every 10 min, spots projects you've been awarded and sends you the profit math plus an anonymized Upwork job post ready to paste. |

Everything is free. n8n runs on your PC in Docker. The PC and Docker Desktop must be on for it to work.

## 1. Open n8n
1. Make sure **Docker Desktop** is running.
2. Open http://localhost:5678 and create your owner account. It's local to your PC.
3. Delete the workflow **zz-capability-test**. It was only a test.
4. The workflow **Freelancer Agents (customer service + won projects)** is already imported.

## 2. Freelancer API token (Personal Access Token, free)
Don't create an "app". Freelancer denies apps that are only for your own account.
1. Log in to Freelancer, then open **https://accounts.freelancer.com/settings/develop**
   (in your account settings, this is **Develop with Freelancer.com** in the left menu).
2. Generate a **Personal Access Token** and copy it.
3. **The token expires after 30 days.** The assistant reminds you on Telegram from day 26 if you fill in `FREELANCER_TOKEN_DATE`.
   - **401** error: the token has expired. Generate a new one.
   - **403** error: the token lacks permission to read messages or bids, or your account needs identity verification.

## 3. Free Gemini AI key
1. Go to https://aistudio.google.com → **Get API key** → **Create API key**.
2. Copy the key. The free tier has daily limits. You can see them in AI Studio.
   Free-tier data may be used by Google to improve its models.

## 4. Telegram bot (where drafts arrive)
1. In Telegram, message **@BotFather** → `/newbot` → pick a name. Copy the **bot token**.
2. Send any message (for example "hi") to your new bot.
3. Open `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates` in your browser
   and copy the number at `"chat":{"id": ...}`. That's your **chat ID**.

## 5. Fill in Settings and turn it on
1. Open the workflow → double-click the **Settings** node.
2. Fill in `FREELANCER_TOKEN`, `FREELANCER_TOKEN_DATE`, `GEMINI_API_KEY`, `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID`.
3. Edit `BUSINESS_PROFILE` (your services, revision policy, hours) and the deal numbers
   (`FREELANCER_FEE_PERCENT`, `TARGET_PROFIT_PERCENT`, `INR_PER_USD`).
4. Click **Publish** (or toggle **Active**) and save.
5. Within about 2 minutes Telegram says both helpers are **live**. Old conversations and earlier wins are skipped.

Don't share the workflow after you paste your keys into it.

## How you use it
- **New client message** → 2 Telegram messages: the client's message with a link to the chat, then the suggested reply on its own.
  Long-press the reply → Copy → paste it in Freelancer and send.
  - 🟢 **Routine**: usually safe to send as is.
  - ⚠️ **Check before sending**: it touches money, deadlines, scope, a complaint or an off-platform request. Edit it yourself.
- **You won a project** → 2 Telegram messages: what you earn, the most to pay on Upwork for your profit target and what to ask the client,
  then the Upwork job post. Copy the post into Upwork → Post a job.

## Changing the code
Edit the files in `src/`, run `node bpo-automation/build.cjs`, then import `workflows/freelancer-agents.json` in n8n.
