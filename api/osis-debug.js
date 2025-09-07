// api/osis-debug.js
export default function handler(req, res) {
  const { searchParams } = new URL(req.url, "http://x");
  const book = searchParams.get("book") || "Genèse";
  const chapter = searchParams.get("chapter") || "1";

  const map = { "Genèse": "GEN", "Exode": "EXO", /* ... */ };
  const osis = `${map[book] || book}.${chapter}`;

  res.status(200).json({ book, chapter, osis });
}
