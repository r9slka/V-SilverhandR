const SUPABASE_HEADERS = (key) => ({
  'apikey': key,
  'Authorization': `Bearer ${key}`,
  'Content-Type': 'application/json'
});

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Supabase not configured' });
  }

  try {
    const sbRes = await fetch(
      `${supabaseUrl}/rest/v1/messages?order=created_at.desc&limit=20`,
      { headers: SUPABASE_HEADERS(supabaseKey) }
    );

    if (!sbRes.ok) {
      const err = await sbRes.text();
      return res.status(502).json({ error: 'Supabase error: ' + err });
    }

    const rows = await sbRes.json();
    return res.status(200).json({ messages: rows.reverse() });

  } catch (err) {
    console.error('History error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};
