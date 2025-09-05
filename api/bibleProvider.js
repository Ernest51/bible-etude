// /api/bibleProvider.js — Récupération passage API.Bible + passageText propre
export const config = { runtime: "nodejs" };

/* ENV */
const API_KEY  = process.env.API_BIBLE_KEY || "";
const BIBLE_ID = process.env.API_BIBLE_BIBLE_ID || ""; // ex: a93a92589195411f-01

/* Utils */
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n || 1));
const clean = (s = "") =>
  String(s)
    .replace(/<[^>]+>/g, " ")
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

function refString(book, chapter, verseSel) {
  const ch = clamp(parseInt(chapter, 10), 1, 150);
  return verseSel ? `${book} ${ch}:${verseSel}` : `${book} ${ch}`;
}

/* FR -> OSIS (identique à ton mapping, conservé) */
const FR2OSIS = { /* … (ton mapping complet inchangé) … */ };
function frToOsisBook(frBook = "") {
  const k = String(frBook).trim().toLowerCase().replace(/\s+/g, " ");
  return FR2OSIS[k] || null;
}

/* Verse selector */
function parseVerseSelector(sel = "") {
  const parts = String(sel || "").split(",").map(p => p.trim()).filter(Boolean);
  const out = [];
  for (const p of parts) {
    if (/[-–]/.test(p)) {
      const [a, b] = p.split(/[-–]/).map(x => parseInt(x, 10));
      const lo = Math.min(a || 1, b || a || 1);
      const hi = Math.max(a || 1, b || a || 1);
      out.push([lo, hi]);
    } else {
      const v = parseInt(p, 10);
      if (!isNaN(v)) out.push([v, v]);
    }
  }
  return out;
}

function makeOsisPassage(bookFR, chapter, verseSel) {
  const osisBook = frToOsisBook(bookFR);
  if (!osisBook) return null;
  const ch = clamp(parseInt(chapter, 10), 1, 150);
  if (!verseSel) return `${osisBook}.${ch}`;
  const ranges = parseVerseSelector(verseSel);
  if (!ranges.length) return `${osisBook}.${ch}`;
  const segs = ranges.map(([a, b]) =>
    a === b ? `${osisBook}.${ch}.${a}` : `${osisBook}.${ch}.${a}-${osisBook}.${ch}.${b}`
  );
  return segs.join(",");
}

/* API.Bible */
async function apiBible(path, params = {}) {
  const base = "https://api.scripture.api.bible/v1";
  const usp = new URLSearchParams(params);
  const url = `${base}${path}${usp.toString() ? "?" + usp.toString() : ""}`;
  const r = await fetch(url, { headers: { "api-key": API_KEY } });
  if (!r.ok) {
    const t = await r.text().catch(() => "");
    throw new Error(`API.Bible error ${r.status}: ${t || r.statusText}`);
  }
  return r.json();
}

async function listBibles(language = "") {
  const params = language ? { language } : {};
  const j = await apiBible("/bibles", params);
  return (j?.data || []).map(b => ({
    id: b.id,
    abbreviation: b.abbreviationLocal || b.abbreviation,
    name: b.nameLocal || b.name,
    language: b.language?.name || b.language,
    description: b.description || ""
  }));
}

async function fetchPassageByOsis({ bibleId, osis }) {
  // On désactive les numéros/notes pour un texte propre
  const j = await apiBible(`/bibles/${bibleId}/passages/${encodeURIComponent(osis)}`, {
    "content-type": "text",
    "include-notes": "false",
    "include-titles": "false",
    "include-chapter-numbers": "false",
    "include-verse-numbers": "false"
  });

  const data = j?.data;
  const content =
    (Array.isArray(data) ? data?.[0]?.content : data?.content) ||
    (Array.isArray(data?.passages) ? data?.passages?.[0]?.content : "");

  const passageText = clean(content || "");
  return { passageText };
}

/* Handler */
export default async function handler(req, res) {
  try {
    if (!API_KEY) {
      return res.status(400).json({
        ok: false,
        error: "API_BIBLE_KEY manquante (Vercel → Settings → Environment Variables)."
      });
    }

    const q = req.method === "GET" ? req.query : (req.body || {});
    const action = String(q.action || "").toLowerCase();

    if (action === "bibles") {
      const language = String(q.language || "");
      const bibles = await listBibles(language);
      return res.status(200).json({ ok: true, data: { bibles } });
    }

    const book    = String(q.book || "");
    const chapter = q.chapter ?? "";
    const verse   = String(q.verse || "");
    if (!book || !chapter) {
      return res.status(400).json({ ok: false, error: "Paramètres requis: book, chapter (verse optionnel)." });
    }

    const bibleId = String(q.bibleId || BIBLE_ID || "");
    if (!bibleId) {
      return res.status(400).json({
        ok: false,
        error: "Aucun bibleId défini. Passe ?bibleId=<ID> ou configure API_BIBLE_BIBLE_ID. Utilise ?action=bibles&language=fra pour lister."
      });
    }

    const osis = makeOsisPassage(book, chapter, verse);
    if (!osis) return res.status(400).json({ ok: false, error: `Livre inconnu: "${book}"` });

    const { passageText } = await fetchPassageByOsis({ bibleId, osis });

    return res.status(200).json({
      ok: true,
      data: {
        reference: refString(book, chapter, verse),
        bibleId,
        osis,
        passageText,       // ← prêt pour /api/chat
        source: "api.bible"
      }
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
}
