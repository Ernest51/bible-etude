// /api/models.js
export const config = { runtime: 'nodejs18.x' };

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }
  if (!OPENAI_API_KEY) {
    return res.status(500).json({ error: 'OPENAI_API_KEY manquant' });
  }

  try {
    const r = await fetch('https://api.openai.com/v1/models', {
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}` }
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data?.error?.message || 'Erreur API');
    res.status(200).json(data);
  } catch (e) {
    console.error('[api/models] error', e);
    res.status(500).json({ error: e.message });
  }
}
