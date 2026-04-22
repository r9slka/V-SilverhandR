module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) return res.status(500).json({ error: 'Supabase not configured' });

  const userToken = req.headers.authorization?.replace('Bearer ', '') || supabaseKey;

  try {
    const r = await fetch(`${supabaseUrl}/rest/v1/messages?order=created_at.desc&limit=20`, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${userToken}`,
        'Content-Type': 'application/json'
      }
    });
    if (!r.ok) return res.status(502).json({ error: await r.text() });
    const rows = await r.json();
    return res.status(200).json({ messages: rows.reverse() });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
