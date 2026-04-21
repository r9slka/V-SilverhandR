const SYSTEM_PROMPT = `You are V Silverhand — a personal AI companion built for one person only. You are direct, sharp, and loyal. You don't waste words. You never call yourself an AI or an assistant — you are V. You keep replies short unless more detail is asked for. You speak like a trusted friend who knows the user well, not like a corporate tool. Never be robotic or overly formal. If you don't know something about the user yet, that's fine — just be real about it.`;

const SUPABASE_HEADERS = (key) => ({
  'apikey': key,
  'Authorization': `Bearer ${key}`,
  'Content-Type': 'application/json'
});

async function loadHistory(supabaseUrl, supabaseKey) {
  const res = await fetch(
    `${supabaseUrl}/rest/v1/messages?order=created_at.desc&limit=20`,
    { headers: SUPABASE_HEADERS(supabaseKey) }
  );
  if (!res.ok) throw new Error('Failed to load history');
  const rows = await res.json();
  return rows.reverse(); // oldest first
}

async function saveMessage(supabaseUrl, supabaseKey, role, content) {
  const res = await fetch(
    `${supabaseUrl}/rest/v1/messages`,
    {
      method: 'POST',
      headers: { ...SUPABASE_HEADERS(supabaseKey), 'Prefer': 'return=minimal' },
      body: JSON.stringify({ role, content })
    }
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error('Failed to save message: ' + err);
  }
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.GEMINI_API_KEY;
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;

  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });
  if (!supabaseUrl || !supabaseKey) return res.status(500).json({ error: 'Supabase not configured' });

  const message = req.body?.message;
  if (!message) return res.status(400).json({ error: 'No message provided' });

  try {
    // 1. Load conversation history from Supabase
    const history = await loadHistory(supabaseUrl, supabaseKey);

    // 2. Save the user's message
    await saveMessage(supabaseUrl, supabaseKey, 'user', message);

    // 3. Build messages for Groq
    const messages = [{ role: 'system', content: SYSTEM_PROMPT }];
    for (const row of history) {
      messages.push({ role: row.role, content: row.content });
    }
    messages.push({ role: 'user', content: message });

    // 4. Call Groq
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages,
        temperature: 0.85,
        max_tokens: 512
      })
    });

    const rawText = await groqRes.text();

    if (!groqRes.ok) {
      console.error('Groq error:', groqRes.status, rawText);
      return res.status(502).json({ error: `Groq ${groqRes.status}: ${rawText.slice(0, 200)}` });
    }

    const data = JSON.parse(rawText);
    const reply = data?.choices?.[0]?.message?.content;
    if (!reply) return res.status(500).json({ error: 'Empty reply from Groq' });

    // 5. Save V's reply
    await saveMessage(supabaseUrl, supabaseKey, 'assistant', reply);

    return res.status(200).json({ reply });

  } catch (err) {
    console.error('Handler error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};
