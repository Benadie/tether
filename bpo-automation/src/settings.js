// ======================= SETTINGS — fill these in once =======================
// Both agents in this workflow read these values. Don't share this workflow after adding your keys.
return [{
  json: {
    FREELANCER_TOKEN: '',        // accounts.freelancer.com/settings/develop → Personal Access Token
    FREELANCER_TOKEN_DATE: '',   // day you generated it, e.g. '2026-11-04' (tokens last 30 days)
    GEMINI_API_KEY: '',          // aistudio.google.com → Get API key (free)
    GEMINI_MODEL: 'gemini-flash-latest',
    TELEGRAM_BOT_TOKEN: '',      // from @BotFather in Telegram
    TELEGRAM_CHAT_ID: '',        // your own chat id (see SETUP.md)

    // Customer service assistant (read-only: drafts replies, never sends)
    MAX_THREADS_PER_RUN: 5,      // keeps you inside the free AI limits

    // Won projects → Upwork post
    FREELANCER_FEE_PERCENT: 10,  // what Freelancer.com takes from your earnings
    TARGET_PROFIT_PERCENT: 40,   // share of your net earnings you want to keep as profit
    INR_PER_USD: 88,             // used to show the Upwork budget in USD; update now and then

    // Describe your business. The agent only says things that are true according to this.
    BUSINESS_PROFILE: `
You reply to clients on Freelancer.com on behalf of the account owner, writing in first person as them.
Services offered: digital marketing (Meta Ads, SEO, Instagram), website design & development, graphic design, content writing.
Typical process: requirements call/chat -> plan within 24h -> work in milestones -> weekly updates -> revisions -> delivery.
Revisions: up to 2 rounds included unless the project says otherwise.
Working hours: Mon-Sat, 10am-7pm IST. Replies within a few hours.
Tone: friendly, confident, short (2-5 sentences), professional English, no emojis overload, no long greetings.
`,
  },
}];
