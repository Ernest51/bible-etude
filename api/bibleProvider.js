// /api/bibleProvider.js — Provider API.Bible (propre, sans fallback query key)
// ENV requises (Vercel → Settings → Environment Variables) :
//   - API_BIBLE_KEY           (clé API.Bible)
//   - API_BIBLE_BIBLE_ID      (ID de la Bible par défaut, ex: a93a92589195411f-01 pour JND FR)
//
// Endpoints :
//   GET /api/bibleProvider?action=bibles&language=fra
//   GET /api/bibleProvider?book=Josué&chapter=1&verse=1-3
//   (optionnel) ?bibleId=... pour surcharger l'ID par défaut
//
// Réponse passage :
// { ok:true, data:{ reference:"Josué 1:1-3", bibleId:"...", osis:"JOS.1.1-3", items:[{ v:0, text:"..." }], source:"api.bible(osis)" } }

export const config = { runtime: "nodejs" };

/* ───────────────────────── ENV ───────────────────────── */

const API_KEY  = process.env.API_BIBLE_KEY || "";
const BIBLE_ID = process.env.API_BIBLE_BIBLE_ID || "";

/* ───────────────────────── Utils ───────────────────────── */

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n || 1));
const clean = (s = "") => String(s).replace(/<[^>]+>/g, " ").replace(/\s{2,}/g, " ").trim();

function refString(book, chapter, verseSel) {
  const ch = clamp(parseInt(chapter, 10), 1, 150);
  return verseSel ? `${book} ${ch}:${verseSel}` : `${book} ${ch}`;
}

/* ─────────────── Mapping livres FR → codes OSIS ─────────────── */

const FR2OSIS = {
  "genèse":"GEN","genese":"GEN","gen":"GEN",
  "exode":"EXO","exo":"EXO",
  "lévitique":"LEV","levitique":"LEV","lev":"LEV",
  "nombres":"NUM","nom":"NUM","nbr":"NUM",
  "deutéronome":"DEU","deuteronome":"DEU","deut":"DEU","dt":"DEU",

  "josué":"JOS","josue":"JOS","jos":"JOS",
  "juges":"JDG","jgs":"JDG",
  "ruth":"RUT","rut":"RUT",
  "1 samuel":"1SA","1samuel":"1SA","1 sam":"1SA","1sa":"1SA",
  "2 samuel":"2SA","2samuel":"2SA","2 sam":"2SA","2sa":"2SA",
  "1 rois":"1KI","1rois":"1KI","1 r":"1KI","1r":"1KI",
  "2 rois":"2KI","2rois":"2KI","2 r":"2KI","2r":"2KI",
  "1 chroniques":"1CH","1chroniques":"1CH","1 ch":"1CH","1ch":"1CH",
  "2 chroniques":"2CH","2chroniques":"2CH","2 ch":"2CH","2ch":"2CH",
  "esdras":"EZR","ezr":"EZR",
  "néhémie":"NEH","nehemie":"NEH","neh":"NEH",
  "esther":"EST","est":"EST",
  "job":"JOB",
  "psaumes":"PSA","psaume":"PSA","ps":"PSA",
  "proverbes":"PRO","prov":"PRO",
  "ecclésiaste":"ECC","ecclesiaste":"ECC","eccl":"ECC","qohelet":"ECC",
  "cantique des cantiques":"SNG","cantique":"SNG","cantiques":"SNG","ct":"SNG",

  "esaïe":"ISA","esaie":"ISA","isaïe":"ISA","isaie":"ISA","isa":"ISA",
  "jérémie":"JER","jeremie":"JER","jer":"JER",
  "lamentations":"LAM","lam":"LAM",
  "ézéchiel":"EZK","ezechiel":"EZK","ezekiel":"EZK","ezk":"EZK",
  "daniel":"DAN","dan":"DAN",
  "osée":"HOS","osee":"HOS","hos":"HOS",
  "joël":"JOL","joel":"JOL","jol":"JOL",
  "amos":"AMO","amo":"AMO",
  "abdias":"OBA","oba":"OBA",
  "jonas":"JON","jon":"JON",
  "michée":"MIC","michee":"MIC","mic":"MIC",
  "nahoum":"NAM","nahum":"NAM","nam":"NAM",
  "habacuc":"HAB","hab":"HAB",
  "sophonie":"ZEP","zeph":"ZEP","soph":"ZEP",
  "aggée":"HAG","aggee":"HAG","hag":"HAG",
  "zacharie":"ZEC","zech":"ZEC","zac":"ZEC",
  "malachie":"MAL","mal":"MAL",

  "matthieu":"MAT","mathieu":"MAT","mt":"MAT",
  "marc":"MRK","mc":"MRK","mk":"MRK",
  "luc":"LUK","lc":"LUK","lk":"LUK",
  "jean":"JHN","jn":"JHN",
  "actes":"ACT","ac":"ACT",
  "romains":"ROM","rom":"ROM","rm":"ROM",
  "1 corinthiens":"1CO","1corinthiens":"1CO","1 co":"1CO","1co":"1CO",
  "2 corinthiens":"2CO","2corinthiens":"2CO","2 co":"2CO","2co":"2CO",
  "galates":"GAL","ga":"GAL",
  "éphésiens":"EPH","ephesiens":"EPH","ep":"EPH",
  "philippiens":"PHP","php":"PHP",
  "colossiens":"COL","col":"COL",
  "1 thessaloniciens":"1TH","1thessaloniciens":"1TH","1 th":"1TH","1th":"1TH",
  "2 thessaloniciens":"2TH","2thessaloniciens":"2TH","2 th":"2TH","2th":"2TH",
  "1 timothée":"1TI","1 tim":"1TI","1ti":"1TI",
  "2 timothée":"2TI","2 tim":"2TI","2ti":"2TI",
  "tite":"TIT",
  "philémon":"PHM","philemon":"PHM","phm":"PHM",
  "hébreux":"HEB","hebreux":"HEB","heb":"HEB",
  "jacques":"JAS","jas":"JAS",
  "1 pierre":"1PE","1pe":"1PE",
  "2 pierre":"2PE","2pe":"2PE",
  "1 jean":"1JN","1jn":"1JN",
  "2 jean":"2JN","2jn":"2JN",
  "3 jean":"3JN","3jn":"3JN",
  "jude":"JUD","jud":"JUD",
  "apocalypse":"REV","révélation":"REV","rev":"REV","apoc":"REV"
};

function frToOsisBook(frBook = "") {
  const k = String(frBook).trim().toLowerCase().replace(/\s+/g, " ");
  return FR2OSIS[k] || null;
}

/* ─────────────── Construction d’un passage OSIS ─────────────── */

function parseVerseSelector(sel = "") {
  // "5" | "1-5" | "3,7,10" | "1-3,7"
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

  if (!verseSel) return `${osisBook}.${ch}`; // chapitre entier

  const ranges = parseVerseSelector(verseSel);
  if (!ranges.length) return `${osisBook}.${ch}`;

  // OSIS supporte des listes/ranges : "JOS.1.1-3,JOS.1.7"
  const segs = ranges.map(([a, b]) =>
    a === b ? `${osisBook}.${ch}.${a}` : `${osisBook}.${ch}.${a}-${osisBook}.${ch}.${b}`
  );
  return segs.join(",");
}

/* ─────────────── Appels API.Bible ─────────────── */

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
  const j = await apiBible(`/bibles/${bibleId}/passages/${encodeURIComponent(osis)}`, {
    "content-type": "text",
    "include-notes": "false",
    "include-titles": "false",
    "include-chapter-numbers": "true",
    "include-verse-numbers": "true"
  });

  const data = j?.data;
  const content =
    (Array.isArray(data) ? data?.[0]?.content : data?.content) ||
    (Array.isArray(data?.passages) ? data?.passages?.[0]?.content : "");
  const text = clean(content || "");
  const items = text ? [{ v: 0, text }] : [];
  return { items };
}

/* ───────────────────────── Handler ───────────────────────── */

export default async function handler(req, res) {
  try {
    if (!API_KEY) {
      return res.status(400).json({
        ok: false,
        error: "API_BIBLE_KEY manquante (Vercel → Settings → Environment Variables)."
      });
    }

    const q = req.method === "GET" ? req.query : (req.body || {});
    const action   = String(q.action || "").toLowerCase();

    // 1) Lister les bibles disponibles (ex: language=fra)
    if (action === "bibles") {
      const language = String(q.language || "");
      const bibles = await listBibles(language);
      return res.status(200).json({ ok: true, data: { bibles } });
    }

    // 2) Passage OSIS (book + chapter requis)
    const book    = String(q.book || "");
    const chapter = q.chapter ?? "";
    const verse   = String(q.verse || ""); // "1-3" | "1,5" | "" (chapitre complet)

    if (!book || !chapter) {
      return res.status(400).json({ ok: false, error: "Paramètres requis: book, chapter (verse optionnel)." });
    }

    const bibleId = String(q.bibleId || BIBLE_ID || "");
    if (!bibleId) {
      return res.status(400).json({
        ok: false,
        error:
          "Aucun bibleId défini. Passe ?bibleId=<ID> ou configure API_BIBLE_BIBLE_ID. " +
          "Utilise ?action=bibles&language=fra pour lister les IDs."
      });
    }

    const osis = makeOsisPassage(book, chapter, verse);
    if (!osis) {
      return res.status(400).json({ ok: false, error: `Livre inconnu (FR) : "${book}".` });
    }

    const { items } = await fetchPassageByOsis({ bibleId, osis });

    return res.status(200).json({
      ok: true,
      data: {
        reference: refString(book, chapter, verse),
        bibleId,
        osis,
        items,
        source: "api.bible(osis)"
      }
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
}
