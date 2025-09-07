// api/study-28.js
export const config = { runtime: "nodejs" };

/**
 * Étude 28 points (LLM-free) avec récupération robuste du passage via api.bible
 * Ordre des tentatives pour un chapitre :
 *   1) /bibles/{id}/passages/GEN.1
 *   2) /bibles/{id}/passages/GEN.1.1-GEN.1.199
 *   3) /bibles/{id}/chapters/GEN.1
 *
 * NB: Pas d'OpenAI.
 */

const API_ROOT = "https://api.scripture.api.bible/v1";
const API_KEY  = process.env.API_BIBLE_KEY || "";
const DEFAULT_BIBLE_ID = process.env.API_BIBLE_ID || ""; // ex: "a93a92589195411f-01" (JND)

function send(res, status, payload) {
  res.status(status).setHeader("content-type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload, null, 2));
}

// --- mapping FR -> OSIS (accents & variantes normalisées) ---
const FR_TO_OSIS = {
  "genese":"GEN","genèse":"GEN","exode":"EXO","levitique":"LEV","lévitique":"LEV","nombres":"NUM",
  "deuteronome":"DEU","deutéronome":"DEU","josue":"JOS","josué":"JOS","juges":"JDG","ruth":"RUT",
  "1 samuel":"1SA","2 samuel":"2SA","1 rois":"1KI","2 rois":"2KI","1 chroniques":"1CH","2 chroniques":"2CH",
  "esdras":"EZR","nehemie":"NEH","néhémie":"NEH","esther":"EST","job":"JOB","psaumes":"PSA","psaume":"PSA",
  "proverbes":"PRO","ecclesiaste":"ECC","ecclésiaste":"ECC",
  "cantique des cantiques":"SNG","cantiques":"SNG","cantique":"SNG",
  "esaie":"ISA","esaïe":"ISA","ésaïe":"ISA","isaie":"ISA","isaïe":"ISA",
  "jeremie":"JER","jérémie":"JER","lamentations":"LAM",
  "ezechiel":"EZK","ezéchiel":"EZK","ézéchiel":"EZK",
  "daniel":"DAN","osee":"HOS","osée":"HOS","joel":"JOL","joël":"JOL","amos":"AMO","abdias":"OBA","jonas":"JON",
  "michee":"MIC","michée":"MIC","nahoum":"NAM","habacuc":"HAB","sophonie":"ZEP","aggee":"HAG","aggée":"HAG",
  "zacharie":"ZEC","malachie":"MAL","matthieu":"MAT","marc":"MRK","luc":"LUK","jean":"JHN","actes":"ACT",
  "romains":"ROM","1 corinthiens":"1CO","2 corinthiens":"2CO","galates":"GAL","ephesiens":"EPH","éphésiens":"EPH",
  "philippiens":"PHP","colossiens":"COL","1 thessaloniciens":"1TH","2 thessaloniciens":"2TH",
  "1 timothee":"1TI","1 timothée":"1TI","2 timothee":"2TI","2 timothée":"2TI",
  "tite":"TIT","philemon":"PHM","philémon":"PHM","hebreux":"HEB","hébreux":"HEB","jacques":"JAS",
  "1 pierre":"1PE","2 pierre":"2PE","1 jean":"1JN","2 jean":"2JN","3 jean":"3JN","jude":"JUD","apocalypse":"REV",
  // abréviations usuelles
  "1 cor":"1CO","2 cor":"2CO","1 th":"1TH","2 th":"2TH","1 ti":"1TI","2 ti":"2TI","1 pi":"1PE","2 pi":"2PE"
};
const norm = (s)=>String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/\s+/g," ").trim();
function toOsis(book){
  const k = norm(book);
  if (FR_TO_OSIS[k]) return FR_TO_OSIS[k];
  const hit = Object.keys(FR_TO_OSIS).find(x=>x.startsWith(k));
  return hit ? FR_TO_OSIS[hit] : null;
}

function buildOsisChapter(book, chapter) {
  const osis = toOsis(book);
  if (!osis) return null;
  return `${osis}.${String(chapter||"1").trim()}`;
}
function buildOsisPassage(book, chapter, verse){
  const osis = toOsis(book);
  if (!osis) return null;
  const chap = String(chapter||"1").trim();
  const v = String(verse||"").trim();
  if (!v) return `${osis}.${chap}`; // chapitre entier (tentative 1)
  const main = v.split(",")[0].trim();
  if (/^\d+\s*[-–]\s*\d+$/.test(main)) {
    const [a,b] = main.split(/[-–]/).map(s=>s.trim());
    return `${osis}.${chap}.${a}-${osis}.${chap}.${b}`;
  }
  return `${osis}.${chap}.${main}`;
}

async function callApi(path, params = {}) {
  if (!API_KEY) {
    const err = new Error("API_BIBLE_KEY manquante");
    err.status = 500; throw err;
  }
  const url = new URL(API_ROOT + path);
  Object.entries(params).forEach(([k,v])=>{
    if (v!==undefined && v!==null && v!=="") url.searchParams.set(k, String(v));
  });
  const r = await fetch(url.toString(), { headers: { accept:"application/json", "api-key": API_KEY } });
  const txt = await r.text();
  let j; try{ j = txt ? JSON.parse(txt) : {}; }catch{ j = { raw: txt }; }
  if (!r.ok) {
    const e = new Error(j?.error?.message || `api.bible ${r.status}`);
    e.status = r.status; e.details = j; throw e;
  }
  return j;
}

const CONTENT_PARAMS = {
  "content-type": "html",
  "include-notes": false,
  "include-titles": true,
  "include-chapter-numbers": true,
  "include-verse-numbers": true,
  "include-verse-spans": false,
  "use-org-id": false
};

async function fetchPassageById(bibleId, passageId){
  const id = bibleId || DEFAULT_BIBLE_ID;
  const j = await callApi(`/bibles/${id}/passages/${encodeURIComponent(passageId)}`, CONTENT_PARAMS);
  return { reference: j?.data?.reference || "", html: j?.data?.content || "" };
}
async function fetchChapterById(bibleId, chapterId){
  const id = bibleId || DEFAULT_BIBLE_ID;
  const j = await callApi(`/bibles/${id}/chapters/${encodeURIComponent(chapterId)}`, CONTENT_PARAMS);
  return { reference: j?.data?.reference || "", html: j?.data?.content || "" };
}

function stripHtml(html){
  return String(html||"").replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim();
}

const TITLES_FULL = [
  "Thème central","Résumé en une phrase","Contexte historique","Auteur et date","Genre littéraire",
  "Structure du passage","Plan détaillé","Mots-clés","Termes clés (définis)","Personnages et lieux",
  "Problème / Question de départ","Idées majeures (développement)","Verset pivot (climax)",
  "Références croisées (AT)","Références croisées (NT)","Parallèles bibliques",
  "Lien avec l’Évangile (Christocentrique)","Vérités doctrinales (3–5)","Promesses et avertissements",
  "Principes intemporels","Applications personnelles (3–5)","Applications communautaires",
  "Questions pour petits groupes (6)","Prière guidée","Méditation courte","Versets à mémoriser (2–3)",
  "Difficultés/objections & réponses","Ressources complémentaires"
];
const TITLES_MINI = ["Thème central","Idées majeures (développement)","Applications personnelles (3–5)"];

function firstSentence(text) {
  const c = String(text||"").replace(/\s+/g," ").trim();
  const m = c.match(/(.+?[.!?])(\s|$)/u);
  return m ? m[1].trim() : c.slice(0,180);
}

export default async function handler(req, res){
  try{
    const url = new URL(req.url, `http://${req.headers.host}`);
    const sp = url.searchParams;
    const selftest = sp.get("selftest")==="1";
    const dry = sp.get("dry")==="1";
    const mode = (sp.get("mode")||"").toLowerCase() || "full";

    if (selftest) return send(res, 200, { ok:true, engine:"LLM-FREE", modes:["mini","full"], usesApiBible:true, source:"study-28" });

    let input = {};
    if (req.method === "POST") {
      const chunks=[]; for await (const c of req) chunks.push(c);
      try{ input = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"); }catch{ input = {}; }
    } else {
      input = {
        book: sp.get("book")||"",
        chapter: sp.get("chapter")||"",
        verse: sp.get("verse")||"",
        translation: sp.get("translation")||"LSG",
        bibleId: sp.get("bibleId")||""
      };
    }

    const book = input.book || "";
    const chapter = input.chapter || "";
    const verse = input.verse || "";
    const translation = input.translation || "LSG";
    const bibleId = input.bibleId || "";

    if (!book || !chapter) return send(res, 400, { ok:false, error:"book et chapter requis" });

    const meta = {
      book, chapter:String(chapter), verse:String(verse||""),
      translation,
      reference: `${book} ${chapter}${verse?":"+verse:""}`,
      osis: ""
    };

    if (dry) {
      const titles = mode==="mini" ? TITLES_MINI : TITLES_FULL;
      const sections = titles.map((t,i)=>({ index:i+1, title:t, content:`${t} (${meta.reference}).`, verses:[] }));
      return send(res, 200, { ok:true, data:{ meta, sections } });
    }

    if (!API_KEY) return send(res, 500, { ok:false, error:"API_BIBLE_KEY manquante" });

    const osisChapter = buildOsisChapter(book, chapter);
    if (!osisChapter) {
      const titles = mode==="mini" ? TITLES_MINI : TITLES_FULL;
      const sections = titles.map((t,i)=>({ index:i+1, title:t, content:`${t} (${meta.reference}). (Passage non récupéré : livre inconnu)`, verses:[] }));
      return send(res, 200, { ok:true, data:{ meta, sections } });
    }

    const passageIdPrimary = buildOsisPassage(book, chapter, "");          // ex: GEN.1
    const passageIdFallback = buildOsisPassage(book, chapter, "1-199");     // ex: GEN.1.1-GEN.1.199
    const passageIdFromQuery = verse ? buildOsisPassage(book, chapter, verse) : null;

    let displayRef = meta.reference;
    let osis = osisChapter;
    let passageText = "";
    let lastErr = "";

    // 0) Si l’utilisateur a mis un verset/range → on tente d’abord la forme précise
    if (passageIdFromQuery) {
      try {
        const got = await fetchPassageById(bibleId, passageIdFromQuery);
        const clean = stripHtml(got.html);
        if (clean) {
          passageText = clean; displayRef = got.reference || displayRef; osis = passageIdFromQuery;
        }
      } catch(e){ lastErr = e?.status ? `api.bible ${e.status}` : String(e?.message||e); }
    }

    // 1) /passages/GEN.1 (si pas encore trouvé)
    if (!passageText) {
      try {
        const got = await fetchPassageById(bibleId, passageIdPrimary);
        const clean = stripHtml(got.html);
        if (clean) {
          passageText = clean; displayRef = got.reference || displayRef; osis = passageIdPrimary;
        }
      } catch(e){ lastErr = e?.status ? `api.bible ${e.status}` : String(e?.message||e); }
    }

    // 2) /passages/GEN.1.1-GEN.1.199
    if (!passageText) {
      try {
        const got = await fetchPassageById(bibleId, passageIdFallback);
        const clean = stripHtml(got.html);
        if (clean) {
          passageText = clean; displayRef = got.reference || displayRef; osis = passageIdFallback;
        }
      } catch(e){ lastErr = e?.status ? `api.bible ${e.status}` : String(e?.message||e); }
    }

    // 3) /chapters/GEN.1
    if (!passageText) {
      try {
        const got = await fetchChapterById(bibleId, osisChapter);
        const clean = stripHtml(got.html);
        if (clean) {
          passageText = clean; displayRef = got.reference || displayRef; osis = osisChapter;
        }
      } catch(e){ lastErr = e?.status ? `api.bible ${e.status}` : String(e?.message||e); }
    }

    const titles = mode==="mini" ? TITLES_MINI : TITLES_FULL;
    const intro = passageText ? firstSentence(passageText) : `(Passage non récupéré : ${lastErr || "inconnu"})`;

    const sections = titles.map((t, i) => ({
      index: i + 1,
      title: t,
      content: `${t} (${displayRef}). ${intro}…`,
      verses: []
    }));

    meta.reference = displayRef;
    meta.osis = osis;

    return send(res, 200, { ok:true, data:{ meta, sections } });
  } catch (e) {
    return send(res, 500, { ok:false, error:String(e?.message||e) });
  }
}
