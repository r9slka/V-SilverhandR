module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) return res.status(500).json({ error: 'Supabase not configured' });

  const userToken = req.headers.authorization?.replace('Bearer ', '') || supabaseKey;
  const sbHeaders = {
    'apikey': supabaseKey,
    'Authorization': `Bearer ${userToken}`,
    'Content-Type': 'application/json'
  };
  const url = `${supabaseUrl}/rest/v1/user_notes`;

  try {
    if (req.method === 'GET') {
      const r = await fetch(`${url}?order=created_at.asc`, { headers: sbHeaders });
      return res.status(200).json({ notes: await r.json() });
    }
    if (req.method === 'POST') {
      const { content } = req.body;
      if (!content) return res.status(400).json({ error: 'No content' });
      const r = await fetch(url, {
        method: 'POST',
        headers: { ...sbHeaders, 'Prefer': 'return=representation' },
        body: JSON.stringify({ content })
      });
      const data = await r.json();
      return res.status(201).json({ note: data[0] });
    }
    if (req.method === 'PUT') {
      const { id, content } = req.body;
      if (!id || !content) return res.status(400).json({ error: 'Missing id or content' });
      await fetch(`${url}?id=eq.${id}`, {
        method: 'PATCH',
        headers: { ...sbHeaders, 'Prefer': 'return=minimal' },
        body: JSON.stringify({ content })
      });
      return res.status(200).json({ ok: true });
    }
    if (req.method === 'DELETE') {
      const id = req.query?.id;
      if (!id) return res.status(400).json({ error: 'Missing id' });
      await fetch(`${url}?id=eq.${id}`, { method: 'DELETE', headers: sbHeaders });
      return res.status(200).json({ ok: true });
    }
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
