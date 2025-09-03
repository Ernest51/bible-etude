// pages/api/verse.js
// POST { book, chapter, verse, version } -> { ok:true, reference, version, text }
// Minimal LSG (Genèse 1:1–10) pour valider le flux. Étends ensuite.

export const config = { runtime: "nodejs" };

const LSG = {
  "Genèse": {
    1: {
      1: "Au commencement, Dieu créa les cieux et la terre.",
      2: "La terre était informe et vide; il y avait des ténèbres à la surface de l’abîme, et l’Esprit de Dieu se mouvait au-dessus des eaux.",
      3: "Dieu dit: Que la lumière soit! Et la lumière fut.",
      4: "Dieu vit que la lumière était bonne; et Dieu sépara la lumière d'avec les ténèbres.",
      5: "Dieu appela la lumière jour, et il appela les ténèbres nuit. Ainsi, il y eut un soir, et il y eut un matin: ce fut le premier jour.",
      6: "Dieu dit: Qu’il y ait une étendue entre les eaux, et qu’elle sépare les eaux d’avec les eaux.",
      7: "Et Dieu fit l’étendue, et il sépara les eaux qui sont au-dessous de l’étendue d’avec les eaux qui sont au-dessus de l’étendue. Et cela fut ainsi.",
      8: "Dieu appela l’étendue ciel. Ainsi, il y eut un soir, et il y eut un matin: ce fut le second jour.",
      9: "Dieu dit: Que les eaux qui sont au-dessous du ciel se rassemblent en un seul lieu, et que le sec paraisse. Et cela fut ainsi.",
      10:"Dieu appela le sec terre, et il appela l’amas des eaux mers. Dieu vit que cela était bon."
    }
  }
};

const BOOK_ALIASES = new Map([["genese","Genèse"],["genèse","Genèse"]]);
const normalizeBook = (s)=> BOOK_ALIASES.get(String(s||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"")) || s;

export default function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end("Method Not Allowed");
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const book = normalizeBook(body.book || "Genèse");
    const chapter = Number(body.chapter || 1);
    const verse = Number(body.verse || 1);
    const version = String(body.version || "LSG");

    const text = LSG?.[book]?.[chapter]?.[verse];
    if (!text) return res.status(404).end("Not Found");

    res.status(200).json({ ok:true, reference:`${book} ${chapter}:${verse}`, version, text });
  } catch {
    res.status(400).end("Bad Request");
  }
}
