// /api/generate-study — Echo minimal (ESM) pour valider le routing
// Option A (package.json contient "type":"module")

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
    res.status(200).json({ ok: false, error: String(e?.message || e) });
  }
}
