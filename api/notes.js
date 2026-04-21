const sb = (supabaseUrl, supabaseKey) => ({
  headers: {
    'apikey': supabaseKey,
    'Authorization': `Bearer ${supabaseKey}`,
    'Content-Type': 'application/json'
  },
  url: `${supabaseUrl}/rest/v1/user_notes`
});

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) return res.status(500).json({ error: 'Supabase not configured' });

  const { headers, url } = sb(supabaseUrl, supabaseKey);

  try {
    if (req.method === 'GET') {
      const r = await fetch(`${url}?order=created_at.asc`, { headers });
      const data = await r.json();
      return res.status(200).json({ notes: data });
    }

    if (req.method === 'POST') {
      const { content } = req.body;
      if (!content) return res.status(400).json({ error: 'No content' });
      const r = await fetch(url, {
        method: 'POST',
        headers: { ...headers, 'Prefer': 'return=representation' },
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
        headers: { ...headers, 'Prefer': 'return=minimal' },
        body: JSON.stringify({ content })
      });
      return res.status(200).json({ ok: true });
    }

    if (req.method === 'DELETE') {
      const id = req.query?.id;
      if (!id) return res.status(400).json({ error: 'Missing id' });
      await fetch(`${url}?id=eq.${id}`, { method: 'DELETE', headers });
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Notes error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};
