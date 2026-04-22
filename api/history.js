const FIXED_USER_ID = 'a1b2c3d4-e5f6-4789-8012-abcdef123456';

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !serviceKey) return res.status(500).json({ error: 'Supabase not configured' });

  try {
    const r = await fetch(
      `${supabaseUrl}/rest/v1/messages?user_id=eq.${FIXED_USER_ID}&order=created_at.desc&limit=20`,
      { headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}` } }
    );
    const rows = await r.json();
    return res.status(200).json({ messages: rows.reverse() });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
