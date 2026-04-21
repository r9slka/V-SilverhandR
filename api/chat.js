const SYSTEM_PROMPT = `You are V Silverhand — a personal AI companion built for one person only. You are direct, sharp, and loyal. You don't waste words. You never call yourself an AI or an assistant — you are V. You keep replies short unless more detail is asked for. You speak like a trusted friend who knows the user well, not like a corporate tool. Never be robotic or overly formal. If you don't know something about the user yet, that's fine — just be real about it.`;

const SB_HEADERS = (key) => ({
  'apikey': key,
  'Authorization': `Bearer ${key}`,
  'Content-Type': 'application/json'
});

async function loadHistory(supabaseUrl, key) {
  const r = await fetch(`${supabaseUrl}/rest/v1/messages?order=created_at.desc&limit=20`, { headers: SB_HEADERS(key) });
  if (!r.ok) throw new Error('Failed to load history');
  const rows = await r.json();
  return rows.reverse();
}

async function loadNotes(supabaseUrl, key) {
  const r = await fetch(`${supabaseUrl}/rest/v1/user_notes?order=created_at.asc`, { headers: SB_HEADERS(key) });
  if (!r.ok) return [];
  return await r.json();
}

async function saveMessage(supabaseUrl, key, role, content) {
  const r = await fetch(`${supabaseUrl}/rest/v1/messages`, {
    method: 'POST',
    headers: { ...SB_HEADERS(key), 'Prefer': 'return=minimal' },
    body: JSON.stringify({ role, content })
  });
  if (!r.ok) throw new Error('Failed to save message: ' + await r.text());
}

async function callGroq(apiKey, messages, model = 'llama-3.1-8b-instant') {
  const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({ model, messages, temperature: 0.85, max_tokens: 512 })
  });
  const raw = await r.text();
  if (!r.ok) throw new Error(`Groq ${r.status}: ${raw.slice(0, 200)}`);
  const data = JSON.parse(raw);
  return data?.choices?.[0]?.message?.content ?? null;
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

  const { message, fileType, fileData, fileName } = req.body ?? {};
  if (!message && !fileData) return res.status(400).json({ error: 'No message provided' });

  try {
    const [history, notes] = await Promise.all([
      loadHistory(supabaseUrl, supabaseKey),
      loadNotes(supabaseUrl, supabaseKey)
    ]);

    // Build system prompt — inject About Me notes
    let systemPrompt = SYSTEM_PROMPT;
    if (notes.length > 0) {
      const notesText = notes.map(n => `- ${n.content}`).join('\n');
      systemPrompt += `\n\nHere is what you know about me (always keep this in mind):\n${notesText}`;
    }

    // Save user message to Supabase
    const userContent = fileName ? `[File: ${fileName}]\n${message || ''}` : message;
    await saveMessage(supabaseUrl, supabaseKey, 'user', userContent);

    let reply;

    if (fileType === 'image' && fileData) {
      // Vision request — use llama-3.2-11b-vision-preview
      const messages = [
        { role: 'system', content: systemPrompt },
        ...history.map(r => ({ role: r.role, content: r.content })),
        {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: fileData } },
            { type: 'text', text: message || 'What do you see in this image?' }
          ]
        }
      ];
      reply = await callGroq(apiKey, messages, 'llama-3.2-11b-vision-preview');
    } else {
      // Text request (includes PDF text injected into message)
      const userMessage = fileType === 'pdf' && fileData
        ? `${message || 'I uploaded a PDF. Here are its contents:'}\n\n[PDF: ${fileName}]\n${fileData.slice(0, 4000)}`
        : message;

      const messages = [
        { role: 'system', content: systemPrompt },
        ...history.map(r => ({ role: r.role, content: r.content })),
        { role: 'user', content: userMessage }
      ];
      reply = await callGroq(apiKey, messages);
    }

    if (!reply) return res.status(500).json({ error: 'Empty reply from Groq' });

    await saveMessage(supabaseUrl, supabaseKey, 'assistant', reply);
    return res.status(200).json({ reply });

  } catch (err) {
    console.error('Handler error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};
