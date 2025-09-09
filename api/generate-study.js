// /api/generate-study — Echo minimal (ESM) pour valider le routing
// Projet Vercel "statique" avec fonctions serverless dans /api
// package.json doit contenir: { "type": "module" }

export default function handler(req, res) {
  try {
    const q = req?.query ?? {};
    const book = (q.book && String(q.book)) || "Genèse";
    const chapter = Number.parseInt(q.chapter, 10) || 1;

    res.status(200).json({
      ok: true,
      route: "/api/generate-study",
      echo: { book, chapter },
      now: new Date().toISOString()
    });
  } catch (e) {
    // Toujours répondre 200 pour éviter les 500 pendant le diag
    res.status(200).json({ ok: false, error: String(e?.message || e) });
  }
}
