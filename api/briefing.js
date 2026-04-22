// Daily briefing cron — runs at 6:00 AM UTC (8:00 AM Paris summer time)
// Vercel calls this with Authorization: Bearer {CRON_SECRET}

const BRIEFING_PROMPT = (date, summary, recentMessages) => {
  const msgText = recentMessages.length > 0
    ? recentMessages.map(m => `${m.role === 'user' ? 'Me' : 'V'}: ${m.content}`).join('\n')
    : 'No recent messages.';
  return `Today is ${date}. Generate a sharp, personal morning briefing for the user. Keep it concise and direct — this is V Silverhand speaking.

Include:
1. A short greeting with today's date
2. A sharp, honest thought or insight for the day (not generic motivation)
3. A brief note on what we talked about recently (based on context below)
4. One direct question to start the day

Recent conversation context:
${summary ? `Summary: ${summary}\n` : ''}
Last messages:
${msgText}

Write the briefing as V would speak — direct, loyal, no fluff. Under 150 words.`;
};

const SUMMARY_PROMPT = (messages) => {
  const text = messages.map(m => `${m.role === 'user' ? 'Me' : 'V'}: ${m.content}`).join('\n');
  return `Summarize the following conversation between me and my AI companion V Silverhand into a compact paragraph (max 200 words). Focus on key facts, topics discussed, decisions made, and anything personal shared. This summary will be used to give V long-term memory context.\n\nConversation:\n${text}`;
};

module.exports = async function handler(req, res) {
  // Validate cron secret
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const apiKey      = process.env.GEMINI_API_KEY;
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!apiKey || !supabaseUrl || !serviceKey) {
    return res.status(500).json({ error: 'Missing environment variables' });
  }

  const sbHeaders = {
    'apikey': serviceKey,
    'Authorization': `Bearer ${serviceKey}`,
    'Content-Type': 'application/json'
  };

  async function groq(messages) {
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({ model: 'llama-3.1-8b-instant', messages, temperature: 0.85, max_tokens: 400 })
    });
    const data = await r.json();
    return data?.choices?.[0]?.message?.content ?? null;
  }

  try {
    // Get distinct active users from messages
    const usersRes = await fetch(
      `${supabaseUrl}/rest/v1/messages?select=user_id&order=created_at.desc&limit=100`,
      { headers: sbHeaders }
    );
    const userRows = await usersRes.json();
    const userIds = [...new Set(userRows.map(r => r.user_id).filter(Boolean))];

    if (userIds.length === 0) {
      return res.status(200).json({ message: 'No active users found' });
    }

    const results = [];

    for (const userId of userIds) {
      // Load last 20 messages for this user
      const msgsRes = await fetch(
        `${supabaseUrl}/rest/v1/messages?user_id=eq.${userId}&order=created_at.desc&limit=20`,
        { headers: sbHeaders }
      );
      const msgs = (await msgsRes.json()).reverse();

      // Load existing summary
      const summaryRes = await fetch(
        `${supabaseUrl}/rest/v1/summaries?user_id=eq.${userId}&limit=1`,
        { headers: sbHeaders }
      );
      const [summaryRow] = await summaryRes.json();
      const existingSummary = summaryRow?.content || null;

      // Load all messages for a fresh summary
      const allMsgsRes = await fetch(
        `${supabaseUrl}/rest/v1/messages?user_id=eq.${userId}&order=created_at.asc`,
        { headers: sbHeaders }
      );
      const allMsgs = await allMsgsRes.json();

      // Generate updated summary from all messages
      let newSummary = existingSummary;
      if (allMsgs.length > 5) {
        newSummary = await groq([{ role: 'user', content: SUMMARY_PROMPT(allMsgs) }]);
      }

      // Upsert summary in Supabase
      if (newSummary) {
        await fetch(`${supabaseUrl}/rest/v1/summaries?user_id=eq.${userId}`, {
          method: 'PATCH',
          headers: { ...sbHeaders, 'Prefer': 'return=minimal' },
          body: JSON.stringify({ content: newSummary, updated_at: new Date().toISOString() })
        });
        // Insert if no existing summary
        if (!summaryRow) {
          await fetch(`${supabaseUrl}/rest/v1/summaries`, {
            method: 'POST',
            headers: { ...sbHeaders, 'Prefer': 'return=minimal' },
            body: JSON.stringify({ user_id: userId, content: newSummary })
          });
        }
      }

      // Generate the briefing message
      const date = new Date().toLocaleDateString('en-GB', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
      });
      const briefingText = await groq([{
        role: 'user',
        content: BRIEFING_PROMPT(date, newSummary, msgs.slice(-10))
      }]);

      if (briefingText) {
        // Save briefing as a message
        await fetch(`${supabaseUrl}/rest/v1/messages`, {
          method: 'POST',
          headers: { ...sbHeaders, 'Prefer': 'return=minimal' },
          body: JSON.stringify({ role: 'assistant', content: briefingText, user_id: userId })
        });
        results.push({ userId, status: 'briefing sent' });
      }
    }

    return res.status(200).json({ results });
  } catch (err) {
    console.error('Briefing error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};
