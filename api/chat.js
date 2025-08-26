// api/chat.js
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Origin', '*'); // ⚠ à restreindre plus tard
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
  }

  let body = {};
  try {
    const raw = await new Promise((resolve, reject) => {
      let data = '';
      req.on('data', chunk => data += chunk);
      req.on('end', () => resolve(data));
      req.on('error', reject);
    });
    body = raw ? JSON.parse(raw) : {};
  } catch {
    return res.status(400).json({ ok: false, error: 'Invalid JSON' });
  }

  const msg = (body.msg || '').toLowerCase();

  // Petite logique de démo
  let reply = "Je n'ai pas compris.";
  if (msg.includes('bonjour')) reply = "Bonjour 🙏 Que la paix soit avec toi.";
  else if (msg.includes('verset')) reply = "Jean 3:16 — Car Dieu a tant aimé le monde...";
  else if (msg.includes('aide')) reply = "Bien sûr, dis-moi sur quel passage biblique tu veux de l'aide.";

  return res.status(200).json({
    ok: true,
    received: body.msg || null,
    reply,
    time: new Date().toISOString()
  });
}
