// Won projects → ready-to-paste Upwork job post (n8n Code node, "Run Once for All Items").
// Checks every 10 minutes for Freelancer bids that were awarded to you. For each new one it sends you on Telegram:
//   1. A deal summary: what you earn, the most you can pay on Upwork and still hit your profit target, what to ask the client.
//   2. An anonymized Upwork job post to copy and paste. No client name, brand, URL or Freelancer mention.

const CONFIG = $('Settings').first().json;
const state = $getWorkflowStaticData('node');

if (Date.now() - (state.lastCheck || 0) < 10 * 60 * 1000) return [{ json: { skipped: 'checked less than 10 minutes ago' } }];
state.lastCheck = Date.now();

const missing = ['FREELANCER_TOKEN', 'GEMINI_API_KEY', 'TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID'].filter((k) => !CONFIG[k]);
if (missing.length) throw new Error(`Fill in these values in the Settings node: ${missing.join(', ')}`);

state.seenBids ??= {};

const FL = 'https://www.freelancer.com/api';
const parse = (r) => (typeof r === 'string' ? JSON.parse(r) : r);
const flGet = async (path) =>
  parse(await this.helpers.httpRequest({ method: 'GET', url: FL + path, headers: { 'freelancer-oauth-v1': CONFIG.FREELANCER_TOKEN } })).result;
const tgSay = async (text) =>
  this.helpers.httpRequest({
    method: 'POST',
    url: `https://api.telegram.org/bot${CONFIG.TELEGRAM_BOT_TOKEN}/sendMessage`,
    body: { chat_id: CONFIG.TELEGRAM_CHAT_ID, text: text.slice(0, 4000) },
    json: true,
  });

const explain = (e) => {
  const code = String(e.httpCode ?? e.response?.status ?? e.statusCode);
  if (code === '401') return 'Freelancer token expired or invalid (401). Generate a new one at https://accounts.freelancer.com/settings/develop';
  if (code === '403') return 'Freelancer refused access to your bids (403): the token may not include project permission (fln:project_manage).';
  return e.message;
};

let bids;
try {
  state.myId ??= (await flGet('/users/0.1/self/')).id;
  const since = Math.floor(Date.now() / 1000) - 90 * 86400;
  bids = (await flGet(`/projects/0.1/bids/?bidders[]=${state.myId}&award_statuses[]=awarded&from_time=${since}&limit=50`)).bids || [];
} catch (e) {
  if (Date.now() - (state.lastErrorAt || 0) > 6 * 3600 * 1000) {
    state.lastErrorAt = Date.now();
    await tgSay(`⚠️ Won-projects check failed: ${explain(e)}`);
  }
  return [{ json: { error: explain(e) } }];
}

if (!state.initialized) {
  // First run: don't post about projects you already won before turning this on.
  for (const b of bids) state.seenBids[b.id] = true;
  state.initialized = true;
  await tgSay(`🏆 Won-project watcher is live. ${bids.length} earlier awarded project(s) skipped. New wins will arrive here with an Upwork post ready to paste.`);
  return [{ json: { status: 'initialized', skipped: bids.length } }];
}

const fresh = bids.filter((b) => !state.seenBids[b.id]);
const done = [];
for (const b of fresh.slice(0, 3)) {
  try {
    const p = await flGet(`/projects/0.1/projects/${b.project_id}/?full_description=true&job_details=true`);
    const cur = p.currency?.code || '';
    const sign = p.currency?.sign || '';
    const earn = Number(b.amount) || 0;
    const net = earn * (1 - CONFIG.FREELANCER_FEE_PERCENT / 100);
    const maxHire = net * (1 - CONFIG.TARGET_PROFIT_PERCENT / 100);
    const usd = cur === 'USD' ? maxHire : cur === 'INR' ? maxHire / CONFIG.INR_PER_USD : null;
    const money = (n) => `${sign}${Math.round(n).toLocaleString('en-IN')} ${cur}`;
    const skills = (p.jobs || []).map((j) => j.name).filter(Boolean);

    const ai = parse(await this.helpers.httpRequest({
      method: 'POST',
      url: `https://generativelanguage.googleapis.com/v1beta/models/${CONFIG.GEMINI_MODEL}:generateContent`,
      headers: { 'x-goog-api-key': CONFIG.GEMINI_API_KEY },
      json: true,
      body: {
        systemInstruction: { parts: [{ text: `You turn a client's project brief into an Upwork job post for hiring a freelancer.
Rules:
- Remove every client identifier: company/brand names, people's names, website URLs, emails, phone numbers, social handles. Describe the business generically (e.g. "a premium Indian home-décor brand").
- Never mention Freelancer.com, reselling, or subcontracting.
- Keep the real scope and deliverables. Make goals realistic (no guaranteed results).
- Ask applicants for relevant samples and a fixed price.
- Also list the materials/info you must collect from the client before work starts.
Return ONLY JSON: {"title": "...", "description": "...", "skills": ["..."], "duration": "...", "client_questions": ["..."]}` }] },
        contents: [{ role: 'user', parts: [{ text: `Project title: ${p.title}\nSkills: ${skills.join(', ')}\nBrief:\n${(p.description || '').slice(0, 5000)}` }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.4 },
      },
    }));
    const raw = ai.candidates?.[0]?.content?.parts?.map((x) => x.text).join('') ?? '';
    const post = JSON.parse(raw);

    const budgetLine = usd != null ? `$${Math.floor(usd)} (≈ ${money(maxHire)})` : money(maxHire);
    const tooLow = usd != null && usd < 25;

    await tgSay(
      `🏆 You won: ${p.title}\nhttps://www.freelancer.com/projects/${p.seo_url || p.id}\n\n` +
      `💰 You get: ${money(earn)} → after ${CONFIG.FREELANCER_FEE_PERCENT}% fee: ${money(net)}\n` +
      `👷 Pay at most on Upwork: ${budgetLine} to keep ${CONFIG.TARGET_PROFIT_PERCENT}% profit\n` +
      (tooLow ? '⚠️ This budget is very low for Upwork. Consider doing it yourself, renegotiating scope, or a cheaper freelancer.\n' : '') +
      `\n📋 Ask the client for:\n${(post.client_questions || []).map((q) => `• ${q}`).join('\n')}\n\nThe Upwork post is in the next message. Copy it into Upwork → Post a job.`,
    );
    await tgSay(
      `${post.title}\n\n${post.description}\n\nSkills: ${(post.skills || skills).join(', ')}\nDuration: ${post.duration || 'see description'}\nBudget: fixed price, up to ${usd != null ? '$' + Math.floor(usd) : money(maxHire)}`,
    );
    state.seenBids[b.id] = true;
    done.push(p.title);
  } catch (e) {
    await tgSay(`⚠️ Couldn't prepare the Upwork post for project ${b.project_id}: ${explain(e)}. I'll retry in 10 minutes.`);
  }
}

return [{ json: { newWins: done } }];
