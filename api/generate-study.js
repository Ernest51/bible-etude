// ESM echo minimal (Option A)
// Route: /api/generate-study
export default function handler(req, res) {
  const q = req?.query ?? {};
  const book = (q.book && String(q.book)) || "Genèse";
  const chapter = Number.parseInt(q.chapter, 10) || 1;

  res.status(200).json({
    ok: true,
    route: "/api/generate-study",
    echo: { book, chapter },
    now: new Date().toISOString()
  });
}
