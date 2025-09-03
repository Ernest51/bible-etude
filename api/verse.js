// pages/api/verse.js
// POST JSON attendu: { book: "Genèse", chapter: 1, verse: 2, version: "LSG" }
// Réponse: { ok: true, reference, version, text }
// - Par défaut: sert un mini corpus LSG (Genèse 1:1–10) => suffisant pour tes tests.
// - Optionnel: si API_BIBLE_KEY & BIBLE_ID fournis (API.Bible), route l'appel externe.
//   -> Sinon, reste en local (aucun risque de 404). Compatible avec ton /public/app.js et debug.

export const config = { runtime: "nodejs" };

const API_BIBLE_KEY = process.env.API_BIBLE_KEY || process.env.API_BIBLE_TOKEN || "";
// ⚠️ A RENSEIGNER si tu veux activer API.Bible : l'identifiant de la version (ex: LSG).
// Tu peux mettre un placeholder, l'API locale restera prioritaire si non fourni.
const API_BIBLE_ID = process.env.BIBLE_ID || ""; // ex: "ls-some-guid" (à récupérer sur api.bible)

const isNum = (x) => Number.isFinite(+x) && +x > 0;
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n || 1));
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "");

function stripAccents(str) {
  return String(str || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function normalizeBook(input) {
  const s = stripAccents(input);
  const map = {
    "genese": "Genèse",
    "genese.": "Genèse",
    "gen": "Genèse",
    "gn": "Genèse",
  };
  return map[s] || map[s.replace(/\s+/g, "")] || cap(input);
}

function refString(book, chapter, verse) {
  const ch = clamp(parseInt(chapter, 10), 1, 150);
  return verse ? `${cap(book)} ${ch}:${verse}` : `${cap(book)} ${ch}`;
}

/* ------------------------------------------------------------------ */
/* Mini corpus LSG 1910 — Genèse 1:1–10 (pour tests hors-ligne)       */
/* Source : LSG 1910 — domaine public.                                 */
/* ------------------------------------------------------------------ */

const LSG_LOCAL = {
  "Genèse": {
    1: {
      1: "Au commencement, Dieu créa les cieux et la terre.",
      2: "La terre était informe et vide; il y avait des ténèbres à la surface de l’abîme, et l’Esprit de Dieu se mouvait au-dessus des eaux.",
      3: "Dieu dit: Que la lumière soit! Et la lumière fut.",
      4: "Dieu vit que la lumière était bonne; et Dieu sépara la lumière d’avec les ténèbres.",
      5: "Dieu appela la lumière jour, et il appela les ténèbres nuit. Ainsi, il y eut un soir, et il y eut un matin: ce fut le premier jour.",
      6: "Dieu dit: Qu’il y ait une étendue entre les eaux, et qu’elle sépare les eaux d’avec les eaux.",
      7: "Et Dieu fit l’étendue, et il sépara les eaux qui sont au-dessous de l’étendue d’avec les eaux qui sont au-dessus de l’étendue. Et cela fut ainsi.",
      8: "Dieu appela l’étendue ciel. Ainsi, il y eut un soir, et il y eut un matin: ce fut le second jour.",
      9: "Dieu dit: Que les eaux qui sont au-dessous du ciel se rassemblent en un seul lieu, et que le sec paraisse. Et cela fut ainsi.",
      10:"Dieu appela le sec terre, et il appela l’amas des eaux mers. Dieu vit que cela était bon."
    }
  }
};

/* ------------------------------------------------------------------ */
/* API.Bible (optionnel)                                              */
/* ------------------------------------------------------------------ */

async function fetchFromApiBible({ book, chapter, verse }) {
  if (!API_BIBLE_KEY || !API_BIBLE_ID) {
    return null; // pas activé
  }

  // API.Bible nécessite des IDs de livres différents du nom FR.
  // Pour un POC rapide, on tente la recherche par référence "Genèse 1:2" via passages.
  // NB: Pour de la prod, mappe le book FR -> bookId API.Bible (catalogue).
  const reference = refString(book, chapter, verse);

  const url = `https://api.scripture.api.bible/v1/bibles/${encodeURIComponent(API_BIBLE_ID)}/passages?content-type=text&reference=${encodeURIComponent(reference)}&include-verse-numbers=false&include-titles=false&include-footnotes=false`;
  const r = await fetch(url, {
    headers: { "api-key": API_BIBLE_KEY }
  });

  if (!r.ok) {
    const msg = await r.text().catch(()=>"");
    throw new Error(`API.Bible HTTP ${r.status} — ${msg}`);
  }

  const j = await r.json().catch(()=>null);
  // Le format peut varier selon la traduction; on tente une extraction simple
  const content = j?.data?.[0]?.content || j?.data?.content || "";
  const text = String(content || "").replace(/\s+/g, " ").trim();
  return text || null;
}

/* ------------------------------------------------------------------ */
/* Handler                                                            */
/* ------------------------------------------------------------------ */

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "Method Not Allowed" });
    return;
  }

  try {
    const { book, chapter, verse, version = "LSG" } = req.body || {};

    // Validation minimale
    if (!book || !isNum(chapter) || !isNum(verse)) {
      res.status(400).json({ ok: false, error: "Requête invalide. Il faut { book, chapter, verse }." });
      return;
    }

    const B = normalizeBook(book);
    const C = clamp(+chapter, 1, 150);
    const V = clamp(+verse, 1, 300);
    const ref = refString(B, C, V);

    // 1) Priorité: base locale LSG (tests offline sûrs)
    if ((version || "LSG").toUpperCase() === "LSG") {
      const local = LSG_LOCAL[B]?.[C]?.[V];
      if (local) {
        res.status(200).json({ ok: true, reference: ref, version: "LSG", text: local });
        return;
      }
    }

    // 2) Optionnel: API.Bible si configurée (clé + bible_id)
    try {
      const text = await fetchFromApiBible({ book: B, chapter: C, verse: V });
      if (text) {
        res.status(200).json({ ok: true, reference: ref, version: version || "LSG", text });
        return;
      }
    } catch (e) {
      // On trace, mais on ne casse pas: on continuera vers 404 propre.
      console.warn("[/api/verse] API.Bible error:", e?.message || e);
    }

    // 3) Rien trouvé
    res.status(404).json({ ok: false, reference: ref, version, error: "Verset non disponible (local ou externe)." });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
}
