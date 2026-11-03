// Freelancer.com customer service assistant for n8n (Code node, "Run Once for All Items").
// READ-ONLY: it reads your Freelancer messages, drafts a reply with Gemini, and sends the draft to you on Telegram.
// It never sends anything on Freelancer; you copy the reply and send it yourself.
// Runs every 2 minutes. Settings come from the Settings node.
//
// NOTE: state (which messages were already drafted) is only saved when the workflow is Published/Active,
// not on manual "Execute" test runs.

const CONFIG = $('Settings').first().json;
const BUSINESS_PROFILE = CONFIG.BUSINESS_PROFILE;

const RULES = `
Hard rules:
- Never agree to or propose prices, discounts, refunds, extra payments, deadline changes, or new scope. Mark these needs_owner.
- Never mention subcontracting, other freelancers, other platforms, or Upwork.
- Never ask the client to move off Freelancer.com (no email, phone, WhatsApp, external payment). If the client asks for that, needs_owner.
- If the client is upset, complaining, or threatening a dispute/review, mark needs_owner.
- Never invent project status, files, dates, or results. If you don't know, say you'll check and update them shortly, and mark needs_owner.
- Routine = greetings, thanks, clarifying questions about requirements, asking for materials (logos, logins, references), explaining the general process.

Return ONLY JSON: {"reply": "<message to send>", "category": "routine" | "needs_owner", "reason": "<why, one short line>"}
`;

const FL = 'https://www.freelancer.com/api';

const missing = ['FREELANCER_TOKEN', 'GEMINI_API_KEY', 'TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID'].filter((k) => !CONFIG[k]);
if (missing.length) throw new Error(`Fill in these values in the Settings node: ${missing.join(', ')}`);

const state = $getWorkflowStaticData('node');
state.seen ??= {};       // threadId -> marker of last message handled

const parse = (r) => (typeof r === 'string' ? JSON.parse(r) : r);

const TOKEN_HELP = 'Generate a new Personal Access Token at https://accounts.freelancer.com/settings/develop and paste it into the Settings node.';
const explain = (e) => {
  const code = String(e.httpCode ?? e.response?.status ?? e.statusCode);
  if (code === '401') return `Freelancer token expired or invalid (401). ${TOKEN_HELP}`;
  if (code === '403') return 'Freelancer refused access (403): the token may not include messaging permission (fln:messaging), or your account needs identity verification.';
  return e.message;
};

const flGet = async (path) =>
  parse(await this.helpers.httpRequest({ method: 'GET', url: FL + path, headers: { 'freelancer-oauth-v1': CONFIG.FREELANCER_TOKEN } })).result;

const tgSay = async (text) =>
  this.helpers.httpRequest({
    method: 'POST',
    url: `https://api.telegram.org/bot${CONFIG.TELEGRAM_BOT_TOKEN}/sendMessage`,
    body: { chat_id: CONFIG.TELEGRAM_CHAT_ID, text: text.slice(0, 4000), disable_web_page_preview: true },
    json: true,
  });

const log = { drafted: 0, errors: [] };

// Remind you before the 30-day token runs out (once a day from day 26).
if (CONFIG.FREELANCER_TOKEN_DATE) {
  const age = Math.floor((Date.now() - new Date(CONFIG.FREELANCER_TOKEN_DATE).getTime()) / 86400000);
  const today = new Date().toISOString().slice(0, 10);
  if (age >= 26 && state.tokenWarnedOn !== today) {
    state.tokenWarnedOn = today;
    await tgSay(`🔑 Your Freelancer token is ${age} days old and stops working at 30 days. ${TOKEN_HELP} Also update FREELANCER_TOKEN_DATE.`);
  }
}

// ---------- Read Freelancer conversations ----------
let threads;
try {
  state.myId ??= (await flGet('/users/0.1/self/')).id;
  threads = (await flGet('/messages/0.1/threads/?last_message=true&limit=20')).threads || [];
} catch (e) {
  log.errors.push(explain(e));
  threads = [];
}

const markerOf = (t) => String(t.message?.id ?? t.thread?.message?.id ?? t.time_updated ?? '');

if (!state.initialized && !log.errors.length) {
  // First run: don't draft replies for old conversations, just remember where we are.
  for (const t of threads) state.seen[t.id] = markerOf(t);
  state.initialized = true;
  await tgSay(`🤖 Customer service assistant is live (read-only). Watching ${threads.length} Freelancer conversations. New client messages will arrive here with a suggested reply.`);
  return [{ json: { status: 'initialized', threads: threads.length } }];
}

const changed = threads.filter((t) => markerOf(t) && state.seen[t.id] !== markerOf(t));
for (const t of changed.slice(0, CONFIG.MAX_THREADS_PER_RUN)) {
  try {
    const marker = markerOf(t);
    const msgs = ((await flGet(`/messages/0.1/messages/?threads[]=${t.id}&limit=10`)).messages || [])
      .sort((a, b) => (a.time_created ?? 0) - (b.time_created ?? 0));
    const last = msgs[msgs.length - 1];
    state.seen[t.id] = marker;
    if (!last || String(last.from_user) === String(state.myId)) continue; // you already replied

    let project = '';
    const ctx = t.thread?.context ?? t.context;
    if (ctx?.type === 'project' && ctx.id) {
      try {
        const p = await flGet(`/projects/0.1/projects/${ctx.id}/`);
        project = `Project: ${p.title}\nBudget: ${p.budget?.minimum ?? '?'}-${p.budget?.maximum ?? '?'} ${p.currency?.code ?? ''}\nDescription: ${(p.description || '').slice(0, 1500)}`;
      } catch (e) { /* project details are optional */ }
    }

    const transcript = msgs.map((m) => `${String(m.from_user) === String(state.myId) ? 'You' : 'Client'}: ${m.message}`).join('\n');

    const ai = parse(await this.helpers.httpRequest({
      method: 'POST',
      url: `https://generativelanguage.googleapis.com/v1beta/models/${CONFIG.GEMINI_MODEL}:generateContent`,
      headers: { 'x-goog-api-key': CONFIG.GEMINI_API_KEY },
      json: true,
      body: {
        systemInstruction: { parts: [{ text: BUSINESS_PROFILE + RULES }] },
        contents: [{ role: 'user', parts: [{ text: `${project}\n\nConversation (latest last):\n${transcript}\n\nWrite the next reply.` }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.4 },
      },
    }));
    const raw = ai.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') ?? '';
    let out;
    try { out = JSON.parse(raw); } catch { out = { reply: raw, category: 'needs_owner', reason: 'AI answer was not in the expected format' }; }
    const reply = String(out.reply || '').trim();
    if (!reply) throw new Error('AI returned an empty reply');

    const flag = out.category === 'routine' ? '🟢 Routine' : `⚠️ Check before sending: ${out.reason || ''}`;
    await tgSay(
      `💬 New client message on Freelancer\n${project ? project.split('\n')[0] + '\n' : ''}` +
      `Open chat: https://www.freelancer.com/messages/thread/${t.id}\n\nClient: ${last.message.slice(0, 1200)}\n\n${flag}\n🤖 Suggested reply is in the next message.`,
    );
    await tgSay(reply); // separate message so it's one tap to copy
    log.drafted++;
  } catch (e) {
    log.errors.push(`Thread ${t.id}: ${explain(e)}`);
  }
}

// Tell you about errors, at most every 30 minutes.
if (log.errors.length && Date.now() - (state.lastErrorAt || 0) > 30 * 60 * 1000) {
  state.lastErrorAt = Date.now();
  await tgSay(`⚠️ Assistant problem:\n${log.errors.slice(0, 5).join('\n')}`);
}

return [{ json: { ...log, newConversations: changed.length } }];
