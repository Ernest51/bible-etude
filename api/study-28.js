// /api/study-28.js
export const config = { runtime: "edge" };

/* ====================== ENV ====================== */
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL   = process.env.OPENAI_MODEL || "gpt-4o-mini";
const BIBLE_API_KEY  = process.env.BIBLE_API_KEY;
const BIBLE_ID_ENV   = process.env.BIBLE_ID; // ID par défaut (ex: JND a93a92589195411f-01)

/* ====================== Utils ====================== */
function jsonResponse(obj, status = 200) {
  return new Response(JSON.stringify(obj, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}

function cleanHtmlToText(html = "") {
  return String(html)
    .replace(/<sup[^>]*>.*?<\/sup>/g, " ")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/?p[^>]*>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, Number.isFinite(n) ? n : lo));
const norm = (s) => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();

/** FR → OSIS (principaux; tu peux étendre si besoin) */
const FR2OSIS = {
  "genese":"GEN","genèse":"GEN","gen":"GEN",
  "exode":"EXO","levitique":"LEV","lévitique":"LEV","nombres":"NUM","deuteronome":"DEU","deutéronome":"DEU",
  "josue":"JOS","josué":"JOS","juges":"JDG","ruth":"RUT",
  "1 samuel":"1SA","2 samuel":"2SA","1 rois":"1KI","2 rois":"2KI",
  "1 chroniques":"1CH","2 chroniques":"2CH","esdras":"EZR","nehémie":"NEH","nehemie":"NEH","esther":"EST","job":"JOB",
  "psaumes":"PSA","psaume":"PSA","proverbes":"PRO","ecclesiaste":"ECC","ecclésiaste":"ECC","cantique des cantiques":"SNG","cantique":"SNG",
  "esaie":"ISA","esaïe":"ISA","isaie":"ISA","isaïe":"ISA","jeremie":"JER","jérémie":"JER","lamentations":"LAM",
  "ezechiel":"EZK","ézéchiel":"EZK","daniel":"DAN","osee":"HOS","osée":"HOS","joel":"JOL","joël":"JOL","amos":"AMO","abdias":"OBA",
  "jonas":"JON","michee":"MIC","michée":"MIC","nahum":"NAM","nahoum":"NAM","habacuc":"HAB","sophonie":"ZEP","aggee":"HAG","aggée":"HAG","zacharie":"ZEC","malachie":"MAL",
  "matthieu":"MAT","marc":"MRK","luc":"LUK","jean":"JHN","actes":"ACT","romains":"ROM",
  "1 corinthiens":"1CO","2 corinthiens":"2CO","galates":"GAL","ephesiens":"EPH","éphésiens":"EPH","philippiens":"PHP","colossiens":"COL",
  "1 thessaloniciens":"1TH","2 thessaloniciens":"2TH","1 timothee":"1TI","1 timothée":"1TI","2 timothee":"2TI","2 timothée":"2TI",
  "tite":"TIT","philemon":"PHM","philémon":"PHM","hebreux":"HEB","hébreux":"HEB","jacques":"JAS",
  "1 pierre":"1PE","2 pierre":"2PE","1 jean":"1JN","2 jean":"2JN","3 jean":"3JN","jude":"JUD","apocalypse":"REV","revelation":"REV","révélation":"REV"
};
function frToOsisBook(fr) {
  const k = norm(fr).replace(/\s+/g, " ");
  return FR2OSIS[k] || null;
}

/** "1-3,7" -> [[1,3],[7,7]] */
function parseVerseSelector(sel = "") {
  const parts = String(sel).split(",").map(s => s.trim()).filter(Boolean);
  const out = [];
  for (const p of parts) {
    if (/[-–]/.test(p)) {
      const [a, b] = p.split(/[-–]/).map(x => parseInt(x, 10));
      const lo = clamp(a || 1, 1, 200);
      const hi = clamp(b || lo, 1, 200);
      out.push([Math.min(lo, hi), Math.max(lo, hi)]);
    } else {
      const v = parseInt(p, 10);
      if (!Number.isNaN(v)) out.push([v, v]);
    }
  }
  return out;
}

/** OSIS builder: chapitre ou sélection de versets */
function makeOsisPassage(bookFR, chapter, verseSel) {
  const osisBook = frToOsisBook(bookFR);
  if (!osisBook) return null;
  const ch = clamp(parseInt(chapter, 10), 1, 150);
  if (!verseSel) return `${osisBook}.${ch}`;
  const ranges = parseVerseSelector(verseSel);
  if (!ranges.length) return `${osisBook}.${ch}`;
  const segs = ranges.map(([a,b]) => a === b ? `${osisBook}.${ch}.${a}` : `${osisBook}.${ch}.${a}-${osisBook}.${ch}.${b}`);
  return segs.join(",");
}

/* =================== API.Bible fetch =================== */
async function fetchPassageText(osis, bibleIdOverride = "") {
  if (!BIBLE_API_KEY) throw new Error("BIBLE_API_KEY manquant dans les variables d’environnement.");
  const BID = bibleIdOverride || BIBLE_ID_ENV;
  if (!BID) throw new Error("BIBLE_ID manquant dans les variables d’environnement (ou passer `bibleId` dans la requête).");

  const url = `https://api.scripture.api.bible/v1/bibles/${encodeURIComponent(BID)}/passages/${encodeURIComponent(osis)}?contentType=text&includeVerseNumbers=false&includeChapterNumbers=false&includeTitles=false&paragraphs=false`;
  const r = await fetch(url, { headers: { "api-key": BIBLE_API_KEY } });
  if (!r.ok) {
    const msg = await r.text().catch(() => "");
    throw new Error(`BibleProvider ${r.status}: ${msg || r.statusText}`);
  }
  const data = await r.json();
  const ref  = data?.data?.reference || osis;
  const text = cleanHtmlToText(data?.data?.content || "");
  return { passageRef: ref, passageText: text };
}

/* =================== OpenAI call =================== */
function buildMessages({ passageText, passageRef, translation }) {
  const titles = [
    "Thème central","Résumé en une phrase","Contexte historique","Auteur et date","Genre littéraire",
    "Structure du passage","Plan détaillé","Mots-clés","Termes clés (définis)","Personnages et lieux",
    "Problème / Question de départ","Idées majeures (développement)","Verset pivot (climax)",
    "Références croisées (AT)","Références croisées (NT)","Parallèles bibliques",
    "Lien avec l’Évangile (Christocentrique)","Vérités doctrinales (3–5)","Promesses et avertissements",
    "Principes intemporels","Applications personnelles (3–5)","Applications communautaires",
    "Questions pour petits groupes (6)","Prière guidée","Méditation courte","Versets à mémoriser (2–3)",
    "Difficultés/objections & réponses","Ressources complémentaires"
  ];
  const titlesNumbered = titles.map((t,i)=>`${i+1}. ${t}`).join("\n");

  return [
    {
      role: "system",
      content: [
        "Tu es un bibliste pédagogue.",
        "Produis une étude structurée et concise en **28 sections** fixes.",
        "Langue: français. Ton pastoral et rigoureux.",
        "N’invente aucun verset: tu ne peux utiliser que le texte fourni.",
        "La **sortie DOIT être un JSON** strict selon le schéma indiqué."
      ].join(" ")
    },
    {
      role: "user",
      content: [
        `Passage: ${passageRef} (${translation}).`,
        "Texte (source unique) :",
        "```",
        passageText,
        "```",
        "",
        "Sortie attendue (28 sections, ordre strict) :",
        titlesNumbered,
        "",
        "Schéma JSON strict :",
        '{ "reference": string, "translation": string, "sections": Section[] }',
        'Section = { "index": number (1..28), "title": string, "content": string, "verses": string[] }',
        "- `content`: 4–10 phrases max par section, praticables.",
        '- `verses`: références locales (ex: ["v.1-3","v.26"]).',
        "Aucune autre clé. Aucun texte hors JSON."
      ].join("\n")
    }
  ];
}

async function callOpenAI(messages) {
  if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY manquant.");
  const body = {
    model: OPENAI_MODEL,
    temperature: 0.2,
    response_format: { type: "json_object" }, // IMPORTANT: 'json_object' (et non 'json')
    messages
  };

  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "authorization": `Bearer ${OPENAI_API_KEY}`,
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!r.ok) {
    const t = await r.text().catch(()=> "");
    throw new Error(`OpenAI ${r.status}: ${t || r.statusText}`);
  }

  const j = await r.json();
  const raw = j?.choices?.[0]?.message?.content || "";
  // Doit être du JSON valide (grâce à response_format)
  const parsed = JSON.parse(raw);
  return parsed;
}

/* =================== Handler =================== */
export default async function handler(req) {
  try {
    if (req.method !== "POST") {
      return jsonResponse({ ok: false, error: "Use POST" }, 405);
    }
    const body = await req.json().catch(()=> ({}));

    const book        = (body.book || "").toString().trim();
    const chapter     = (body.chapter || "").toString().trim();
    const verse       = (body.verses || "").toString().trim(); // optionnel
    const translation = (body.translation || "LSG").toString().trim();
    const bibleId     = (body.bibleId || "").toString().trim(); // override possible

    if (!book || !chapter) {
      return jsonResponse({ ok: false, error: "Paramètres requis: book, chapter" }, 400);
    }

    const osis = makeOsisPassage(book, chapter, verse);
    if (!osis) {
      return jsonResponse({ ok: false, error: `Livre inconnu (FR): "${book}"` }, 400);
    }

    const { passageRef, passageText } = await fetchPassageText(osis, bibleId);
    if (!passageText) {
      return jsonResponse({ ok: false, error: "Passage vide depuis API.Bible." }, 500);
    }

    const messages = buildMessages({ passageText, passageRef, translation });
    const study = await callOpenAI(messages);

    return jsonResponse({ ok: true, data: study });
  } catch (e) {
    return jsonResponse({ ok: false, error: String(e?.message || e) }, 500);
  }
}
