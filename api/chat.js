const SYSTEM_PROMPT = `You are V Silverhand — a personal AI companion built for one person only. You are direct, sharp, and loyal. You don't waste words. You never call yourself an AI or an assistant — you are V. You keep replies short unless more detail is asked for. You speak like a trusted friend who knows the user well, not like a corporate tool. Never be robotic or overly formal. If you don't know something about the user yet, that's fine — just be real about it.`;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('API key is not set');
    return res.status(500).json({ error: 'API key not configured' });
  }

  const message = req.body?.message;
  const history = req.body?.history || [];

  if (!message) return res.status(400).json({ error: 'No message provided' });

  const messages = [{ role: 'system', content: SYSTEM_PROMPT }];

  for (const turn of history) {
    if (turn.role && turn.text) {
      const role = turn.role === 'model' ? 'assistant' : turn.role;
      messages.push({ role, content: turn.text });
    }
  }
  messages.push({ role: 'user', content: message });

  let groqRes;
  try {
    groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'llama3-8b-8192',
        messages,
        temperature: 0.85,
        max_tokens: 512
      })
    });
  } catch (e) {
    console.error('Fetch failed:', e.message);
    return res.status(500).json({ error: 'Failed to reach Groq: ' + e.message });
  }

  const rawText = await groqRes.text();

  if (!groqRes.ok) {
    console.error('Groq error:', groqRes.status, rawText);
    return res.status(502).json({ error: `Groq ${groqRes.status}: ${rawText.slice(0, 200)}` });
  }

  let data;
  try {
    data = JSON.parse(rawText);
  } catch (e) {
    console.error('JSON parse error:', rawText);
    return res.status(500).json({ error: 'Bad response from Groq' });
  }

  const reply = data?.choices?.[0]?.message?.content;
  if (!reply) {
    console.error('No reply in response:', JSON.stringify(data));
    return res.status(500).json({ error: 'Empty reply from Groq' });
  }

  return res.status(200).json({ reply });
};
