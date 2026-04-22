const FIXED_USER_ID = 'a1b2c3d4-e5f6-4789-8012-abcdef123456';

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !serviceKey) return res.status(500).json({ error: 'Supabase not configured' });

  const h = { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}`, 'Content-Type': 'application/json' };
  const url = `${supabaseUrl}/rest/v1/messages`;

  try {
    if (req.method === 'GET') {
      const r = await fetch(`${url}?user_id=eq.${FIXED_USER_ID}&order=created_at.asc&limit=100`, { headers: h });
      return res.status(200).json({ messages: await r.json() });
    }
    if (req.method === 'PUT') {
      const { id, content } = req.body;
      if (!id || !content) return res.status(400).json({ error: 'Missing id or content' });
      await fetch(`${url}?id=eq.${id}`, { method: 'PATCH', headers: { ...h, 'Prefer': 'return=minimal' }, body: JSON.stringify({ content }) });
      return res.status(200).json({ ok: true });
    }
    if (req.method === 'DELETE') {
      const id = req.query?.id;
      if (!id) return res.status(400).json({ error: 'Missing id' });
      await fetch(`${url}?id=eq.${id}`, { method: 'DELETE', headers: h });
      return res.status(200).json({ ok: true });
    }
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
