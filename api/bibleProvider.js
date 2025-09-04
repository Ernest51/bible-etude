// /api/bibleProvider.js
// Wrapper API.Bible avec fallback temporaire ?key=... pour tester sans ENV
// Endpoints:
//   GET /api/bibleProvider?action=bibles&language=fra[&key=...]
//   GET /api/bibleProvider?book=Josué&chapter=1&verse=1-3[&bibleId=...][&key=...]

export const config = { runtime: "nodejs" };

const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "");
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n || 1));
const clean = (s="") => String(s).replace(/<[^>]+>/g, " ").replace(/\s{2,}/g, " ").trim();

function refString(book, chapter, verseSel) {
  const ch = clamp(parseInt(chapter, 10), 1, 150);
  return verseSel ? `${cap(book)} ${ch}:${verseSel}` : `${cap(book)} ${ch}`;
}

async function apiBible(path, params = {}, apiKey) {
  const base = "https://api.scripture.api.bible/v1";
  const usp = new URLSearchParams(params);
  const url = `${base}${path}${usp.toString() ? "?" + usp.toString() : ""}`;
  const r = await fetch(url, { headers: { "api-key": apiKey } });
  if (!r.ok) {
    const t = await r.text().catch(()=> "");
    throw new Error(`API.Bible error ${r.status}: ${t || r.statusText}`);
  }
  return r.json();
}

async function listBibles(language = "", apiKey) {
  const params = language ? { language } : {};
  const j = await apiBible("/bibles", params, apiKey);
  return (j?.data || []).map(b => ({
    id: b.id,
    abbreviation: b.abbreviationLocal || b.abbreviation,
    name: b.nameLocal || b.name,
    language: b.language?.name || b.language,
    description: b.description || ""
  }));
}

async function fetchPassage({ bibleId, reference, apiKey }) {
  const params = {
    search: reference,
    "content-type": "text",
    "include-notes": "false",
    "include-titles": "false",
    "include-chapter-numbers": "true",
    "include-verse-numbers": "true"
  };
  const j = await apiBible(`/bibles/${bibleId}/passages`, params, apiKey);

  const data = j?.data;
  const content =
    (Array.isArray(data) ? data?.[0]?.content : data?.content) ||
    (Array.isArray(data?.passages) ? data?.passages?.[0]?.content : "");

  const text = clean(content || "");
  const items = text ? [{ v: 0, text }] : [];
  return { items };
}

export default async function handler(req, res) {
  try {
    const q = req.method === "GET" ? req.query : (req.body || {});
    const action   = String(q.action || "").toLowerCase();
    const language = String(q.language || "");
    const book     = String(q.book || "");
    const chapter  = q.chapter ?? "";
    const verse    = String(q.verse || "");
    const bibleIdQ = String(q.bibleId || "");

    // ❶ Clé API: ENV d’abord, sinon fallback ?key=
    const envKey = process.env.API_BIBLE_KEY || "";
    const keyParam = String(q.key || "");
    const API_KEY = envKey || keyParam;

    if (!API_KEY) {
      return res.status(400).json({
        ok: false,
        error:
          "API_BIBLE_KEY manquante. Ajoute la variable sur Vercel OU passe ?key=TA_CLE temporairement pour tester."
      });
    }

    // ❷ Lister les bibles
    if (action === "bibles") {
      const list = await listBibles(language, API_KEY);
      return res.status(200).json({
        ok: true,
        data: { bibles: list },
        debug: { hasEnvKey: !!envKey, used: envKey ? "env" : "query" }
      });
    }

    // ❸ Passage
    if (!book || !chapter) {
      return res.status(400).json({ ok: false, error: "Paramètres requis: book, chapter (et éventuellement verse)." });
    }

    const FIXED_ID = process.env.API_BIBLE_BIBLE_ID || "";
    const bibleId = bibleIdQ || FIXED_ID;
    if (!bibleId) {
      return res.status(400).json({
        ok: false,
        error:
          "Aucun bibleId défini. Passe ?bibleId=<ID> ou configure API_BIBLE_BIBLE_ID. " +
          "Utilise action=bibles&language=fra pour obtenir un ID."
      });
    }

    const reference = refString(book, chapter, verse);
    const { items } = await fetchPassage({ bibleId, reference, apiKey: API_KEY });

    return res.status(200).json({
      ok: true,
      data: { reference, bibleId, items, source: envKey ? "api.bible(env)" : "api.bible(query)" }
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
}
