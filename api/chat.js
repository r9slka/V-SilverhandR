const SYSTEM_PROMPT = `You are V Silverhand — a personal AI companion built for one person only. You are direct, sharp, and loyal. You don't waste words. You never call yourself an AI or an assistant — you are V. You keep replies short unless more detail is asked for. You speak like a trusted friend who knows the user well, not like a corporate tool. Never be robotic or overly formal. If you don't know something about the user yet, that's fine — just be real about it.`;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('GEMINI_API_KEY is not set');
    return res.status(500).json({ error: 'API key not configured' });
  }

  let message, history;
  try {
    message = req.body?.message;
    history = req.body?.history || [];
  } catch (e) {
    console.error('Body parse error:', e);
    return res.status(400).json({ error: 'Invalid request body' });
  }

  if (!message) return res.status(400).json({ error: 'No message provided' });

  const contents = [];
  for (const turn of history) {
    if (turn.role && turn.text) {
      contents.push({ role: turn.role, parts: [{ text: turn.text }] });
    }
  }
  contents.push({ role: 'user', parts: [{ text: message }] });

  const requestBody = {
    system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents
  };

  let geminiRes;
  try {
    geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      }
    );
  } catch (e) {
    console.error('Fetch failed:', e.message);
    return res.status(500).json({ error: 'Failed to reach Gemini: ' + e.message });
  }

  const rawText = await geminiRes.text();

  if (!geminiRes.ok) {
    console.error('Gemini error status:', geminiRes.status, rawText);
    return res.status(502).json({ error: `Gemini ${geminiRes.status}: ${rawText.slice(0, 200)}` });
  }

  let data;
  try {
    data = JSON.parse(rawText);
  } catch (e) {
    console.error('JSON parse error:', rawText);
    return res.status(500).json({ error: 'Bad response from Gemini' });
  }

  const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!reply) {
    console.error('No reply in response:', JSON.stringify(data));
    return res.status(500).json({ error: 'Empty reply from Gemini' });
  }

  return res.status(200).json({ reply });
};
