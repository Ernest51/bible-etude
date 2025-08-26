// api/chat.js
export default async function handler(req, res) {
  // En-têtes utiles
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method === 'POST') {
    // Lecture du corps (JSON ou texte)
    let raw = '';
    try { for await (const chunk of req) raw += chunk; } catch {}
    let payload = null;
    try { payload = raw ? JSON.parse(raw) : null; } catch { payload = raw || null; }

    return res.status(200).json({
      ok: true,
      route: 'chat',
      method: 'POST',
      received: payload,
      time: new Date().toISOString()
    });
  }

  // Répond aussi en GET (pratique pour tester dans le navigateur)
  if (req.method === 'GET') {
    return res.status(200).json({
      ok: true,
      route: 'chat',
      method: 'GET',
      hint: 'Utilise POST pour envoyer un message JSON.'
    });
  }

  res.setHeader('Allow', 'POST, GET, OPTIONS');
  return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
}
