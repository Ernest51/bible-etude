// /api/bibleProvider.js
// Wrapper simple pour API.Bible (ABS)
// - Variables d'env requises: API_BIBLE_KEY
// - Optionnel: API_BIBLE_BIBLE_ID (id d'une Bible choisie)
// Endpoints utiles:
//   GET  /api/bibleProvider?action=bibles&language=fra   -> liste des Bibles FR pour trouver un ID
//   GET  /api/bibleProvider?book=Josué&chapter=1&verse=1-3  -> texte normalisé
//
// Réponse normalisée pour passage:
// { ok:true, data:{ reference: "Josué 1:1-3", bibleId:"...", items:[{v,text}], source:"api.bible" } }

export const config = { runtime: "nodejs" };

const API_KEY  = process.env.API_BIBLE_KEY || "";
const FIXED_ID = process.env.API_BIBLE_BIBLE_ID || ""; // facultatif, tu peux aussi passer ?bibleId=...

const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "");
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n || 1));
const clean = (s="") => String(s).replace(/<[^>]+>/g, " ").replace(/\s{2,}/g, " ").trim();

function refString(book, chapter, verseSel) {
  const ch = clamp(parseInt(chapter, 10), 1, 150);
  return verseSel ? `${cap(book)} ${ch}:${verseSel}` : `${cap(book)} ${ch}`;
}

// --- API.Bible helpers -------------------------------------------------------

async function apiBible(path, params = {}) {
  const base = "https://api.scripture.api.bible/v1";
  const usp = new URLSearchParams(params);
  const url = `${base}${path}${usp.toString() ? "?" + usp.toString() : ""}`;
  const r = await fetch(url, { headers: { "api-key": API_KEY } });
  if (!r.ok) {
    const t = await r.text().catch(()=> "");
    throw new Error(`API.Bible error ${r.status}: ${t || r.statusText}`);
  }
  return r.json();
}

// Liste des Bibles (filtrable par langue: 'fra')
async function listBibles(language = "") {
  const params = language ? { language } : {};
  const j = await apiBible("/bibles", params);
  // On renvoie un petit subset propre
  const items = (j?.data || []).map(b => ({
    id: b.id,
    abbreviation: b.abbreviationLocal || b.abbreviation,
    name: b.nameLocal || b.name,
    language: b.language?.name || b.language,
    description: b.description || ""
  }));
  return items;
}

// Récupère un passage avec l'ID Bible donné.
// NOTE: On utilise l'endpoint /bibles/{id}/passages?search=<ref>&content-type=text ...
// Cela accepte des références libres ("Josué 1:1-3"). Le retour peut être un bloc texte.
async function fetchPassage({ bibleId, reference }) {
  const params = {
    search: reference,
    "content-type": "text",
    "include-notes": "false",
    "include-titles": "false",
    "include-chapter-numbers": "true",
    "include-verse-numbers": "true"
  };
  const j = await apiBible(`/bibles/${bibleId}/passages`, params);

  // La forme exacte varie selon la Bible; on normalise prudemment.
  // On tente d'extraire soit data.content, soit data[0].content.
  const data = j?.data;
  const content =
    (Array.isArray(data) ? data?.[0]?.content : data?.content) ||
    (Array.isArray(data?.passages) ? data?.passages?.[0]?.content : "");

  const text = clean(content || "");
  // Quand on n'a pas la segmentation par verset, on renvoie un bloc unique (v:0).
  const items = text ? [{ v: 0, text }] : [];
  return { items, raw: j };
}

// --- Normalisation -----------------------------------------------------------

function normalizeVerses(rawItems, chapter, verseSel) {
  // Ici on a un seul bloc (v:0). Si un jour tu veux parser les n° de versets, c'est ici.
  // Pour l’instant on retourne tel quel.
  return rawItems.length ? rawItems : [];
}

// --- Handler ----------------------------------------------------------------

export default async function handler(req, res) {
  try {
    if (!API_KEY) {
      return res.status(400).json({
        ok: false,
        error: "API_BIBLE_KEY manquante. Définis la variable d'environnement sur Vercel (Settings > Environment Variables)."
      });
    }

    const q = req.method === "GET" ? req.query : (req.body || {});
    const action   = String(q.action || "").toLowerCase();
    const language = String(q.language || "");
    const bibleIdQ = String(q.bibleId || "");
    const book     = String(q.book || "");
    const chapter  = q.chapter ?? "";
    const verse    = String(q.verse || ""); // ex: "1-3" ou "5,7"

    // 1) /api/bibleProvider?action=bibles&language=fra -> liste des Bibles
    if (action === "bibles") {
      const list = await listBibles(language);
      return res.status(200).json({ ok: true, data: { bibles: list } });
    }

    // 2) Passage normalisé
    if (!book || !chapter) {
      return res.status(400).json({ ok: false, error: "Paramètres requis: book, chapter (et éventuellement verse)." });
    }

    const bibleId = bibleIdQ || FIXED_ID;
    if (!bibleId) {
      return res.status(400).json({
        ok: false,
        error:
          "Aucun bibleId défini. Ajoute ?bibleId=<ID> à ta requête, ou configure API_BIBLE_BIBLE_ID en variable d'environnement. " +
          "Utilise /api/bibleProvider?action=bibles&language=fra pour trouver un ID."
      });
    }

    const reference = refString(book, chapter, verse);
    const { items } = await fetchPassage({ bibleId, reference });
    const norm = normalizeVerses(items, chapter, verse);

    return res.status(200).json({
      ok: true,
      data: { reference, bibleId, items: norm, source: "api.bible" }
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
}
