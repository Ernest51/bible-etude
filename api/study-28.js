// api/study-28.js
export const config = { runtime: "nodejs" };

/**
 * Étude 28 points (sans OpenAI) avec récupération robuste via api.bible
 * - Normalisation livre FR → OSIS (tolère accents / espaces / casse)
 * - Cascade tolérante:
 *   1) /passages (params riches) → 2) /passages (params min)
 *   3) /passages (plage large min) → 4) /chapters (min) → 5) /chapters (sans params)
 * - Paramètres:
 *    ?book=Genèse&chapter=1[&verse=1-5][&bibleId=...][&translation=JND][&mode=mini|full][&dry=1][&trace=1]
 */

const API_ROOT = "https://api.scripture.api.bible/v1";
const API_KEY  = process.env.API_BIBLE_KEY || "";
const DEFAULT_BIBLE_ID = process.env.API_BIBLE_ID || ""; // ex: a93a92589195411f-01 (JND)

// ---------- utils de réponse ----------
function send(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload, null, 2));
}

// ---------- FR → OSIS ----------
const MAP = {
  "genese":"GEN","genèse":"GEN","gen":"GEN",
  "exode":"EXO","exo":"EXO",
  "levitique":"LEV","lévitique":"LEV","lev":"LEV",
  "nombres":"NUM","num":"NUM",
  "deuteronome":"DEU","deutéronome":"DEU","deu":"DEU",
  "josue":"JOS","josué":"JOS","jos":"JOS",
  "juges":"JDG","jdg":"JDG",
  "ruth":"RUT","rut":"RUT",
  "1samuel":"1SA","1 samuel":"1SA","1 sa":"1SA",
  "2samuel":"2SA","2 samuel":"2SA","2 sa":"2SA",
  "1rois":"1KI","1 rois":"1KI","1r":"1KI","1 roi":"1KI",
  "2rois":"2KI","2 rois":"2KI","2r":"2KI","2 roi":"2KI",
  "1chroniques":"1CH","1 chroniques":"1CH","1ch":"1CH",
  "2chroniques":"2CH","2 chroniques":"2CH","2ch":"2CH",
  "esdras":"EZR","ezr":"EZR",
  "nehemie":"NEH","néhémie":"NEH","nehemie":"NEH","neh":"NEH",
  "esther":"EST","est":"EST",
  "job":"JOB",
  "psaumes":"PSA","psaume":"PSA","ps":"PSA",
  "proverbes":"PRO","prov":"PRO","pro":"PRO",
  "ecclesiaste":"ECC","ecclésiaste":"ECC","ecc":"ECC",
  "cantique descantiques":"SNG","cantique des cantiques":"SNG","cantiques":"SNG","cantique":"SNG","sng":"SNG",
  "esaie":"ISA","esaïe":"ISA","ésaïe":"ISA","isaie":"ISA","isaïe":"ISA","esa":"ISA","isa":"ISA",
  "jeremie":"JER","jérémie":"JER","jer":"JER",
  "lamentations":"LAM","lam":"LAM",
  "ezechiel":"EZK","ezéchiel":"EZK","ézéchiel":"EZK","eze":"EZK","ezk":"EZK",
  "daniel":"DAN","dan":"DAN",
  "osee":"HOS","osée":"HOS","hos":"HOS",
  "joel":"JOL","joël":"JOL","jol":"JOL",
  "amos":"AMO","amo":"AMO",
  "abdias":"OBA","oba":"OBA",
  "jonas":"JON","jon":"JON",
  "michee":"MIC","michée":"MIC","mic":"MIC",
  "nahoum":"NAM","nahum":"NAM","nam":"NAM",
  "habacuc":"HAB","hab":"HAB",
  "sophonie":"ZEP","zéphonie":"ZEP","zep":"ZEP",
  "aggee":"HAG","aggée":"HAG","hag":"HAG",
  "zacharie":"ZEC","zec":"ZEC",
  "malachie":"MAL","mal":"MAL",
  "matthieu":"MAT","mat":"MAT","mt":"MAT",
  "marc":"MRK","mc":"MRK","mrk":"MRK",
  "luc":"LUK","lc":"LUK","luk":"LUK",
  "jean":"JHN","jn":"JHN","jhn":"JHN",
  "actes":"ACT","ac":"ACT",
  "romains":"ROM","rom":"ROM",
  "1corinthiens":"1CO","1 corinthiens":"1CO","1co":"1CO","1 cor":"1CO",
  "2corinthiens":"2CO","2 corinthiens":"2CO","2co":"2CO","2 cor":"2CO",
  "galates":"GAL","gal":"GAL",
  "ephesiens":"EPH","éphésiens":"EPH","eph":"EPH",
  "philippiens":"PHP","php":"PHP",
  "colossiens":"COL","col":"COL",
  "1thessaloniciens":"1TH","1 thessaloniciens":"1TH","1th":"1TH","1 th":"1TH",
  "2thessaloniciens":"2TH","2 thessaloniciens":"2TH","2th":"2TH","2 th":"2TH",
  "1timothee":"1TI","1 timothée":"1TI","1ti":"1TI","1 ti":"1TI",
  "2timothee":"2TI","2 timothée":"2TI","2ti":"2TI","2 ti":"2TI",
  "tite":"TIT",
  "philemon":"PHM","philémon":"PHM","phm":"PHM",
  "hebreux":"HEB","hébreux":"HEB","heb":"HEB",
  "jacques":"JAS","jas":"JAS",
  "1pierre":"1PE","1 pierre":"1PE","1pi":"1PE","1 pi":"1PE",
  "2pierre":"2PE","2 pierre":"2PE","2pi":"2PE","2 pi":"2PE",
  "1jean":"1JN","1 jean":"1JN","1jn":"1JN","1 jn":"1JN",
  "2jean":"2JN","2 jean":"2JN","2jn":"2JN","2 jn":"2JN",
  "3jean":"3JN","3 jean":"3JN","3jn":"3JN","3 jn":"3JN",
  "jude":"JUD","jud":"JUD",
  "apocalypse":"REV","apo":"REV","apoc":"REV","rev":"REV"
};

function norm(s) {
  return String(s||"")
    .normalize("NFD").replace(/[\u0300-\u036f]/g,"")
    .toLowerCase().replace(/[^a-z0-9 ]+/g,"")
    .replace(/\s+/g,"").trim();
}
function osisBook(book) {
  const key = norm(book);
  if (MAP[key]) return MAP[key];
  const hit = Object.keys(MAP).find(k => k.startsWith(key));
  return hit ? MAP[hit] : null;
}
function buildOsis({book, chapter, verse}) {
  const b = osisBook(book);
  if (!b) return null;
  const c = String(chapter||"1").trim();
  const v = String(verse||"").trim();
  if (!v) return `${b}.${c}`;
  if (/^\d+([\-–]\d+)?$/.test(v)) {
    if (v.includes("-") || v.includes("–")) {
      const [a,bv] = v.split(/[\-–]/).map(s=>s.trim());
      return `${b}.${c}.${a}-${b}.${c}.${bv}`;
    }
    return `${b}.${c}.${v}`;
  }
  return `${b}.${c}`; // liste non supportée → chapitre
}

// ---------- api.bible fetch ----------
const QS_RICH = {
  "content-type":"html",
  "include-notes":"false",
  "include-titles":"true",
  "include-chapter-numbers":"true",
  "include-verse-numbers":"true",
  "include-verse-spans":"false",
  "use-org-id":"false"
};
const QS_MIN = { "content-type":"html" };

function qs(obj){
  const u = new URLSearchParams();
  Object.entries(obj||{}).forEach(([k,v])=>u.set(k,String(v)));
  return u.toString();
}

async function fetchJson(url, trace) {
  trace && trace.push({ step:"fetch", url });
  const r = await fetch(url, { headers:{ accept:"application/json", "api-key": API_KEY } });
  const txt = await r.text();
  let j; try { j = txt ? JSON.parse(txt) : {}; } catch { j = { raw: txt }; }
  if (!r.ok) {
    const msg = j?.error?.message || j?.message || (typeof j === "string" ? j : j?.raw) || txt || `HTTP ${r.status}`;
    trace && trace.push({ step:"error", status:r.status, message: String(msg).slice(0,400) });
    const e = new Error(String(msg));
    e.status = r.status; e.details = j;
    throw e;
  }
  trace && trace.push({ step:"ok", status:r.status });
  return j;
}

/**
 * Cascade très tolérante:
 * 1) /passages (rich)
 * 2) /passages (min)
 * 3) /passages (plage large min, ex: GEN.1.1-GEN.1.199)
 * 4) /chapters (min)
 * 5) /chapters (sans params)
 */
async function getPassageAuto({ bibleId, osis, trace }) {
  const id = bibleId || DEFAULT_BIBLE_ID;
  if (!id) throw new Error("Missing bibleId (set API_BIBLE_ID or provide ?bibleId=)");

  const doPassages = async (ref, params) => {
    const url = `${API_ROOT}/bibles/${id}/passages/${encodeURIComponent(ref)}${params ? ("?"+qs(params)) : ""}`;
    const j = await fetchJson(url, trace);
    return { ref: j?.data?.reference || ref, html: j?.data?.content || "" };
    };
  const doChapters = async (ref, params) => {
    const url = `${API_ROOT}/bibles/${id}/chapters/${encodeURIComponent(ref)}${params ? ("?"+qs(params)) : ""}`;
    const j = await fetchJson(url, trace);
    return { ref: j?.data?.reference || ref, html: j?.data?.content || "" };
  };

  // 1) passages (rich)
  try { return await doPassages(osis, QS_RICH); }
  catch (e1) { trace && trace.push({ step:"fallback", hint:"passages→min", err: e1.status || e1.message }); }

  // 2) passages (min)
  try { return await doPassages(osis, QS_MIN); }
  catch (e2) { trace && trace.push({ step:"fallback", hint:"passagesWide→min", err: e2.status || e2.message }); }

  // 3) passages (plage large)
  if (/^\w+\.\d+$/.test(osis)) {
    const [b,c] = osis.split(".");
    const wide = `${b}.${c}.1-${b}.${c}.199`;
    try { return await doPassages(wide, QS_MIN); }
    catch (eWide) { trace && trace.push({ step:"fallback", hint:"chapters→min", err: eWide.status || eWide.message }); }
  }

  // 4) chapters (min)
  try { return await doChapters(osis, QS_MIN); }
  catch (e3) { trace && trace.push({ step:"fallback", hint:"chapters→noParams", err: e3.status || e3.message }); }

  // 5) chapters (sans params)
  return await doChapters(osis, null);
}

// ---------- format ----------
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

function sectionsFrom(passageRef, passageText, mode, fallbackMsg){
  const titles = mode==="mini" ? TITLES_MINI : TITLES_FULL;
  const intro = passageText
    ? (passageText.match(/(.+?[.!?])(\s|$)/u)?.[1] || passageText.slice(0,180))
    : fallbackMsg;
  return titles.map((t,i)=>({
    index:i+1, title:t, content:`${t} (${passageRef}). ${intro}…`, verses:[]
  }));
}

// ---------- handler ----------
export default async function handler(req, res){
  try {
    const url = new URL(req.url, "http://x");
    const sp = url.searchParams;

    const book = sp.get("book") || "Genèse";
    const chapter = sp.get("chapter") || "1";
    const verse = sp.get("verse") || "";
    const translation = sp.get("translation") || "JND";
    const bibleId = sp.get("bibleId") || "";
    const mode = (sp.get("mode")||"full").toLowerCase();
    const dry = sp.get("dry")==="1";
    const selftest = sp.get("selftest")==="1";
    const wantTrace = sp.get("trace")==="1";
    const trace = wantTrace ? [] : null;

    if (selftest) {
      return send(res, 200, {
        ok:true, engine:"LLM-FREE", modes:["mini","full"], usesApiBible: !!API_KEY, source:"study-28"
      });
    }

    const meta = {
      book, chapter:String(chapter), verse:String(verse||""),
      translation, reference: `${book} ${chapter}${verse?":"+verse:""}`, osis: ""
    };

    if (dry) {
      const secs = sectionsFrom(meta.reference, "Exemple de texte.", mode, "");
      return send(res, 200, { ok:true, data:{ meta, sections:secs }, trace });
    }

    if (!API_KEY) return send(res, 500, { ok:false, error:"API_BIBLE_KEY manquante" });

    const osis = buildOsis({ book, chapter, verse });
    if (!osis) {
      const secs = sectionsFrom(meta.reference, "", mode, "(Livre inconnu)");
      return send(res, 200, { ok:true, data:{ meta, sections:secs }, trace });
    }

    let passageRef = meta.reference;
    let passageText = "";
    let lastErr = "inconnu";

    try {
      const p = await getPassageAuto({ bibleId, osis, trace });
      passageRef = p.ref || passageRef;
      passageText = stripHtml(p.html);
    } catch (e) {
      const detail =
        e?.details?.error?.message ||
        e?.message ||
        (typeof e?.details === "string" ? e.details : JSON.stringify(e?.details || {}, null, 2));
      lastErr = e?.status ? `api.bible ${e.status} — ${String(detail).slice(0,200)}` : String(detail);
    }

    const sections = sectionsFrom(
      passageRef,
      passageText,
      mode,
      `(Passage non récupéré : ${lastErr})`
    );

    meta.reference = passageRef;
    meta.osis = osis;

    send(res, 200, { ok:true, data:{ meta, sections }, trace });
  } catch (e) {
    send(res, 500, { ok:false, error:String(e?.message||e) });
  }
}
