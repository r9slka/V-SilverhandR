const SYSTEM_PROMPT = `You are V Silverhand — a personal AI companion built for one person only. You are direct, sharp, and loyal. You don't waste words. You never call yourself an AI or an assistant — you are V. You keep replies short unless more detail is asked for. You speak like a trusted friend who knows the user well, not like a corporate tool. Never be robotic or overly formal. If you don't know something about the user yet, that's fine — just be real about it.`;

function sbHeaders(supabaseKey, userToken) {
  return {
    'apikey': supabaseKey,
    'Authorization': `Bearer ${userToken || supabaseKey}`,
    'Content-Type': 'application/json'
  };
}

async function sbGet(url, supabaseKey, userToken) {
  const r = await fetch(url, { headers: sbHeaders(supabaseKey, userToken) });
  if (!r.ok) throw new Error(`Supabase GET failed: ${await r.text()}`);
  return r.json();
}

async function sbPost(url, supabaseKey, userToken, body) {
  const r = await fetch(url, {
    method: 'POST',
    headers: { ...sbHeaders(supabaseKey, userToken), 'Prefer': 'return=minimal' },
    body: JSON.stringify(body)
  });
  if (!r.ok) throw new Error(`Supabase POST failed: ${await r.text()}`);
}

async function loadContext(supabaseUrl, supabaseKey, userToken) {
  const [messagesRaw, notesRaw, summaryRaw] = await Promise.all([
    sbGet(`${supabaseUrl}/rest/v1/messages?order=created_at.desc&limit=10`, supabaseKey, userToken),
    sbGet(`${supabaseUrl}/rest/v1/user_notes?order=created_at.asc`, supabaseKey, userToken),
    sbGet(`${supabaseUrl}/rest/v1/summaries?limit=1`, supabaseKey, userToken)
  ]);
  return {
    recentMessages: (messagesRaw || []).reverse(),
    notes: notesRaw || [],
    summary: summaryRaw?.[0]?.content || null
  };
}

async function callGroq(apiKey, messages, model = 'llama-3.1-8b-instant') {
  const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({ model, messages, temperature: 0.85, max_tokens: 512 })
  });
  const raw = await r.text();
  if (!r.ok) throw new Error(`Groq ${r.status}: ${raw.slice(0, 300)}`);
  return JSON.parse(raw)?.choices?.[0]?.message?.content ?? null;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey      = process.env.GEMINI_API_KEY;
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;
  if (!apiKey)      return res.status(500).json({ error: 'API key not configured' });
  if (!supabaseUrl) return res.status(500).json({ error: 'Supabase not configured' });

  const userToken = req.headers.authorization?.replace('Bearer ', '') || '';
  const { message, fileType, fileData, fileName } = req.body ?? {};
  if (!message && !fileData) return res.status(400).json({ error: 'No message provided' });

  try {
    const { recentMessages, notes, summary } = await loadContext(supabaseUrl, supabaseKey, userToken);

    // Build system prompt with notes injected
    let systemPrompt = SYSTEM_PROMPT;
    if (notes.length > 0) {
      systemPrompt += `\n\nWhat you know about me:\n${notes.map(n => `- ${n.content}`).join('\n')}`;
    }
    if (summary) {
      systemPrompt += `\n\nSummary of our earlier conversations:\n${summary}`;
    }

    // Save user message
    const userContent = fileName ? `[File: ${fileName}]\n${message || ''}` : message;
    await sbPost(`${supabaseUrl}/rest/v1/messages`, supabaseKey, userToken, { role: 'user', content: userContent });

    let reply;

    if (fileType === 'image' && fileData) {
      const messages = [
        { role: 'system', content: systemPrompt },
        ...recentMessages.map(r => ({ role: r.role, content: r.content })),
        { role: 'user', content: [
          { type: 'image_url', image_url: { url: fileData } },
          { type: 'text', text: message || 'What do you see in this image?' }
        ]}
      ];
      reply = await callGroq(apiKey, messages, 'llama-3.2-11b-vision-preview');
    } else {
      const userMessage = (fileType === 'pdf' && fileData)
        ? `${message || 'I uploaded a PDF. Here are its contents:'}\n\n[PDF: ${fileName}]\n${fileData.slice(0, 4000)}`
        : message;
      const messages = [
        { role: 'system', content: systemPrompt },
        ...recentMessages.map(r => ({ role: r.role, content: r.content })),
        { role: 'user', content: userMessage }
      ];
      reply = await callGroq(apiKey, messages);
    }

    if (!reply) return res.status(500).json({ error: 'Empty reply from Groq' });

    await sbPost(`${supabaseUrl}/rest/v1/messages`, supabaseKey, userToken, { role: 'assistant', content: reply });
    return res.status(200).json({ reply });

  } catch (err) {
    console.error('Chat error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};
