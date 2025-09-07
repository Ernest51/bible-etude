// /api/study-28.js
// Étude 28 points (sans OpenAI) avec récupération robuste du passage via api.bible
// - FR → OSIS tolérant (accents / espaces / variantes)
// - Fallback intelligents: /passages/GEN.1  → si 400, essaye  GEN.1.1–199  → si 4xx, /chapters/GEN.1
// - Trace de debug activable (?trace=1) et mode hors-ligne (?dry=1)
// - Parachute “toujours servir 28 rubriques” si le passage est vide ou en erreur

export const config = { runtime: "nodejs" };

const API_ROOT = "https://api.scripture.api.bible/v1";
const API_KEY  = process.env.API_BIBLE_KEY || "";
const DEFAULT_BIBLE_ID = process.env.API_BIBLE_ID || ""; // ex: a93a92589195411f-01

function send(res, status, payload) {
  try {
    res.statusCode = status;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify(payload, null, 2));
  } catch {
    try { res.end('{"ok":false,"warn":"send_failed"}'); } catch {}
  }
}

/* ---------------- FR → OSIS ---------------- */
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
  "nehemie":"NEH","néhémie":"NEH","neh":"NEH",
  "esther":"EST","est":"EST",
  "job":"JOB",
  "psaumes":"PSA","psaume":"PSA","ps":"PSA",
  "proverbes":"PRO","prov":"PRO","pro":"PRO",
  "ecclesiaste":"ECC","ecclésiaste":"ECC","ecc":"ECC",
  "cantique descantiques":"SNG","cantique des cantiques":"SNG","cantiques":"SNG","cantique":"SNG","sng":"SNG",
  "esaie":"ISA","esaïe":"ISA","ésaïe":"ISA","isaïe":"ISA","esa":"ISA","isa":"ISA",
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
  return `${b}.${c}`;
}

/* ---------------- api.bible helpers ---------------- */
const CONTENT_QS = {
  "content-type":"html",
  "include-notes":"false",
  "include-titles":"true",
  "include-chapter-numbers":"true",
  "include-verse-numbers":"true",
  "include-verse-spans":"false",
  "use-org-id":"false"
};
function qs(obj){
  const u = new URLSearchParams(); Object.entries(obj||{}).forEach(([k,v])=>u.set(k,String(v)));
  return u.toString();
}
async function fetchJson(url, trace) {
  trace && trace.push({ step:"fetch", url });
  const r = await fetch(url, { headers:{ accept:"application/json", "api-key": API_KEY } });
  const txt = await r.text();
  let j; try { j = txt ? JSON.parse(txt) : {}; } catch { j = { raw: txt }; }
  if (!r.ok) {
    trace && trace.push({ step:"error", status:r.status, body: (j?.error || j?.raw || txt).toString().slice(0,200) });
    const e = new Error(`api.bible ${r.status}`);
    e.status = r.status; e.details = j; throw e;
  }
  trace && trace.push({ step:"ok", status:r.status });
  return j;
}
async function getPassageAuto({ bibleId, osis, trace }) {
  const id = bibleId || DEFAULT_BIBLE_ID;
  if (!id) throw new Error("Missing bibleId (set API_BIBLE_ID or provide ?bibleId=)");

  // 1) passages (chapitre entier)
  try {
    const url = `${API_ROOT}/bibles/${id}/passages/${encodeURIComponent(osis)}?${qs(CONTENT_QS)}`;
    const j = await fetchJson(url, trace);
    return { ref: j?.data?.reference||osis, html: j?.data?.content||"" };
  } catch (e) {
    // 1b) plage large 1–199 si on a un simple GEN.1
    if (/^\w+\.\d+$/.test(osis)) {
      const [b,c] = osis.split(".");
      const range = `${b}.${c}.1-${b}.${c}.199`;
      try {
        const url = `${API_ROOT}/bibles/${id}/passages/${encodeURIComponent(range)}?${qs(CONTENT_QS)}`;
        const j = await fetchJson(url, trace);
        return { ref: j?.data?.reference||range, html: j?.data?.content||"" };
      } catch {}
    }
  }

  // 2) chapters (fallback ultime)
  const url2 = `${API_ROOT}/bibles/${id}/chapters/${encodeURIComponent(osis)}?${qs(CONTENT_QS)}`;
  const j2 = await fetchJson(url2, trace);
  return { ref: j2?.data?.reference||osis, html: j2?.data?.content||"" };
}

/* ---------------- extraction & mise en forme ---------------- */
function stripHtml(html){
  return String(html||"").replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim();
}
function toSentences(t) {
  const raw = String(t||"").replace(/\s+/g, " ").trim();
  if (!raw) return [];
  const parts = raw.split(/(?<=[\.!\?…])\s+(?=[A-ZÀ-ÖØ-Ý0-9“"«(])/u);
  return parts.filter(s => s && s.length >= 6);
}
function topTerms(t, n=10) {
  const stop = new Set("le,la,les,un,une,des,du,de,d’,d',au,aux,et,ou,mais,car,que,qui,quoi,quand,où,avec,sans,pour,vers,par,sur,dans,comme,ce,cet,cette,ces,son,sa,ses,leur,leurs,il,elle,ils,elles,nous,vous,ne,pas,plus,tout,tous,toute,toutes,ainsi,or,donc,si,est,étaient,était,fut,sera,seront,soit,ont,a,avons,avez,ont,avait,avaient,sera,seraient,selon".split(","));
  const freq = new Map();
  String(t||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"")
    .replace(/[^a-z0-9\s-]/g," ")
    .split(/\s+/)
    .filter(w => w && w.length>=3 && !stop.has(w))
    .forEach(w => freq.set(w, (freq.get(w)||0)+1));
  return [...freq.entries()].sort((a,b)=>b[1]-a[1]).slice(0,n).map(([term,count])=>({term,count}));
}

const TITLES = [
  "Thème central","Résumé en une phrase","Contexte historique","Auteur et date","Genre littéraire",
  "Structure du passage","Plan détaillé","Mots-clés","Termes clés (définis)","Personnages et lieux",
  "Problème / Question de départ","Idées majeures (développement)","Verset pivot (climax)",
  "Références croisées (AT)","Références croisées (NT)","Parallèles bibliques",
  "Lien avec l’Évangile (Christocentrique)","Vérités doctrinales (3–5)","Promesses et avertissements",
  "Principes intemporels","Applications personnelles (3–5)","Applications communautaires",
  "Questions pour petits groupes (6)","Prière guidée","Méditation courte","Versets à mémoriser (2–3)",
  "Difficultés/objections & réponses","Ressources complémentaires"
];

function buildSections(meta, passageText, fallbackMsg="") {
  const s = toSentences(passageText);
  const s1 = s[0] || "";
  const s2 = s[1] || s1;
  const s3 = s[2] || s2;
  const s4 = s[3] || s3;
  const s5 = s[4] || s4;

  const terms = topTerms(passageText, 10).map(t=>t.term);
  const theme = `Lecture de **${meta.reference}**${fallbackMsg?` — ${fallbackMsg}`:""}. ` +
                (terms.length ? `Mots saillants: ${terms.slice(0,5).join(", ")}.` : "");

  const plan  = "Découpage observé par répétitions et transitions (suggérer 3–6 mouvements).";

  const blocks = [
    theme,                                               // 1 Thème
    s1 ? `En bref : ${s1}` : "Résumé bref du passage.",  // 2 Résumé
    s2 ? `Contexte immédiat : ${s2}` : "Contexte et progression interne visibles à la lecture.", // 3
    "Attribution traditionnelle (présentée avec prudence) et place canonique.",                // 4
    "Type de texte (narratif/poétique/prophétique/discours) et indices formels.",              // 5
    `Structure : ${plan}`,                                                                     // 6
    `Plan : ${plan}`,                                                                          // 7
    (terms.length? "• " + terms.join(" • ") : "• —"),                                          // 8
    terms.slice(0,5).map(w=>`• **${w}** — usage notable dans la section.`).join("\n") || "• —",// 9
    s3 ? `Acteurs / lieux : ${s3}` : "Acteurs et lieux repérables (noms propres, toponymes).", // 10
    s2 ? `Question de départ : ${s2}` : "Question directrice posée par le texte lui-même.",    // 11
    s3 ? `Développement : ${s3}` : "Enchaînement des idées majeures relevées.",                // 12
    s4 ? `Point pivot (climax) : ${s4}` : "Point pivot autour duquel s’articulent ouverture et conclusion.", // 13
    "AT : passages parallèles/échos prudents.",                                                // 14
    "NT : reprises/éclairages christologiques.",                                               // 15
    s5 ? `Parallèles : ${s5}` : "Parallèles bibliques (motifs, structures, promesses/accomplissements).", // 16
    "Lecture christocentrique mesurée (fonction christologique du passage).",                  // 17
    "3–5 vérités doctrinales mises en évidence.",                                              // 18
    "Promesses et avertissements implicites/explicites.",                                      // 19
    "Principes intemporels applicables aujourd’hui.",                                          // 20
    "Applications personnelles (3–5 pas concrets).",                                           // 21
    "Applications communautaires/écclésiales.",                                                // 22
    "6 questions pour la discussion en groupe.",                                               // 23
    `Prière ancrée dans **${meta.reference}**.`,                                               // 24
    s1 ? `Méditation : ${s1}` : "Méditation courte : relire la phrase clé, rendre grâce.",     // 25
    "2–3 versets à mémoriser (selon l’édition consultée).",                                    // 26
    "Difficultés possibles et pistes de réponse.",                                             // 27
    "Ressources complémentaires (intro, notes, cartes)."                                       // 28
  ];

  return TITLES.map((t,i)=>({ index:i+1, title:t, content:blocks[i]||"", verses:[] }));
}

/* ---------------- handler ---------------- */
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
      const secs = buildSections(meta, "Exemple de texte.", "");
      return send(res, 200, { ok:true, data:{ meta, sections:secs }, trace });
    }

    if (!API_KEY) return send(res, 500, { ok:false, error:"API_BIBLE_KEY manquante" });

    const osis = buildOsis({ book, chapter, verse });
    if (!osis) {
      const secs = buildSections(meta, "", "(Livre inconnu)");
      return send(res, 200, { ok:true, data:{ meta, sections:secs }, trace });
    }

    let passageRef = meta.reference;
    let passageText = "";
    let lastErr = "";

    try {
      const p = await getPassageAuto({ bibleId, osis, trace });
      passageRef = p.ref || passageRef;
      passageText = stripHtml(p.html);
    } catch (e) {
      lastErr = e?.status ? `api.bible ${e.status}` : String(e?.message||e);
    }

    meta.reference = passageRef;
    meta.osis = osis;

    const fallbackMsg = passageText ? "" : (lastErr || "passage indisponible");
    const sectionsAll = buildSections(meta, passageText, fallbackMsg);

    // mini → ne garde qu’un sous-ensemble
    const sections = mode === "mini"
      ? sectionsAll.filter(s => [1,12,21].includes(s.index)).map((s,i)=>({...s, index:i+1}))
      : sectionsAll;

    send(res, 200, { ok:true, data:{ meta, sections }, trace });
  } catch (e) {
    send(res, 500, { ok:false, error:String(e?.message||e) });
  }
}
