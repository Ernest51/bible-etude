export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'POST') {
    let raw = '';
    for await (const chunk of req) raw += chunk;
    let payload = null;
    try { payload = raw ? JSON.parse(raw) : null; } catch { payload = raw || null; }

    return res.status(200).json({ ok: true, route: 'chat', received: payload, time: new Date().toISOString() });
  }

  if (req.method === 'OPTIONS') {
    res.setHeader('Allow', 'POST, OPTIONS');
    return res.status(204).end();
  }

  res.setHeader('Allow', 'POST, OPTIONS');
  return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
}
