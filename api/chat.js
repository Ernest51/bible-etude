// api/chat.js
// Route Serverless Vercel (Node.js) — GET/POST/OPTIONS
export default async function handler(req, res) {
  // En-têtes utiles
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Préflight CORS
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  // GET → simple ping (pratique pour tester dans le navigateur)
  if (req.method === 'GET') {
    return res.status(200).json({
      ok: true,
      route: 'chat',
      method: 'GET',
      hint: 'Utilise POST avec du JSON pour envoyer un message.'
    });
  }

  // POST → écho du corps (JSON ou texte)
  if (req.method === 'POST') {
    let raw = '';
    try {
      for await (const chunk of req) raw += chunk;
    } catch { /* ignore */ }

    const ctype = (req.headers['content-type'] || '').toLowerCase();
    let payload = null;

    if (ctype.includes('application/json')) {
      try { payload = raw ? JSON.parse(raw) : null; }
      catch { 
        return res.status(400).json({ ok: false, error: 'Invalid JSON' });
      }
    } else {
      // Pas JSON: renvoyer tel quel (texte ou binaire encodé base64)
      payload = raw || null;
    }

    return res.status(200).json({
      ok: true,
      route: 'chat',
      method: 'POST',
      received: payload,
      contentType: ctype || null,
      time: new Date().toISOString()
    });
  }

  // Autres méthodes → 405
  res.setHeader('Allow', 'POST, GET, OPTIONS');
  return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
}
