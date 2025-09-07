// api/study-28.js
// Étude 28 points (sans LLM) — version “ultra-robuste” : ne renvoie jamais 500.
// Si quoi que ce soit casse, on répond quand même 200 avec 28 rubriques + trace.

export const config = { runtime: "nodejs" };

/* -------------------- util HTTP -------------------- */
function replyJSON(res, status, payload) {
  try {
    res.statusCode = status;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify(payload, null, 2));
  } catch {
    // Dernier filet : si on ne peut pas sérialiser, on tente un minimal
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end('{"ok":true,"data":{"meta":{},"sections":[]}}');
  }
}

/* -------------------- config api.bible -------------------- */
const API_ROOT = "https://api.scripture.api.bible/v1";
const API_KEY  = process.env.API_BIBLE_KEY || "";
const DEFAULT_BIBLE_ID = process.env.API_BIBLE_ID || "";

/* -------------------- FR → OSIS -------------------- */
const MAP = {
  "genese":"GEN","genèse":"GEN","gen":"GEN","exode":"EXO","levitique":"LEV","lévitique":"LEV","nombres":"NUM",
  "deuteronome":"DEU","deutéronome":"DEU","josue":"JOS","josué":"JOS","juges":"JDG","ruth":"RUT",
  "1samuel":"1SA","2samuel":"2SA","1rois":"1KI","2rois":"2KI","1chroniques":"1CH","2chroniques":"2CH",
  "esdras":"EZR","nehemie":"NEH","néhémie":"NEH","esther":"EST","job":"JOB","psaumes":"PSA",
  "proverbes":"PRO","ecclesiaste":"ECC","ecclésiaste":"ECC","cantique des cantiques":"SNG","cantiques":"SNG",
  "esaie":"ISA","isaïe":"ISA","isaie":"ISA","jeremie":"JER","jérémie":"JER","lamentations":"LAM",
  "ezechiel":"EZK","ézéchiel":"EZK","daniel":"DAN","osee":"HOS","osée":"HOS","joel":"JOL","joël":"JOL",
  "amos":"AMO","abdias":"OBA","jonas":"JON","michee":"MIC","michée":"MIC","nahoum":"NAM","habacuc":"HAB",
  "sophonie":"ZEP","aggee":"HAG","aggée":"HAG","zacharie":"ZEC","malachie":"MAL","matthieu":"MAT",
  "marc":"MRK","luc":"LUK","jean":"JHN","actes":"ACT","romains":"ROM","1corinthiens":"1CO","2corinthiens":"2CO",
  "galates":"GAL","ephesiens":"EPH","éphésiens":"EPH","philippiens":"PHP","colossiens":"COL",
  "1thessaloniciens":"1TH","2thessaloniciens":"2TH","1timothee":"1TI","2timothee":"2TI","tite":"TIT",
  "philemon":"PHM","philémon":"PHM","hebreux":"HEB","hébreux":"HEB","jacques":"JAS","1pierre":"1PE","2pierre":"2PE",
  "1jean":"1JN","2jean":"2JN","3jean":"3JN","jude":"JUD","apocalypse":"REV","apo":"REV","apoc":"REV","rev":"REV"
};
function norm(s){ return String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9 ]+/g,"").replace(/\s+/g,"").trim(); }
function osisBook(book){
  const key = norm(book);
  if (MAP[key]) return MAP[key];
  const hit = Object.keys(MAP).find(k => k.startsWith(key));
  return hit ? MAP[hit] : null;
}
function buildOsis({ book, chapter, verse }) {
  const b = osisBook(book); if (!b) return null;
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

/* -------------------- fetch util -------------------- */
function qs(obj){ const u=new URLSearchParams(); for(const [k,v] of Object.entries(obj||{})){ u.set(k,String(v)); } return u.toString(); }
const CONTENT_QS = {
  "content-type":"html","include-notes":"false","include-titles":"true",
  "include-chapter-numbers":"true","include-verse-numbers":"true","include-verse-spans":"false","use-org-id":"false"
};
async function fetchJson(url, trace) {
  trace && trace.push({ step:"fetch", url });
  const r = await fetch(url, { headers: { accept:"application/json", "api-key": API_KEY }});
  const raw = await r.text();
  let json; try { json = raw ? JSON.parse(raw) : {}; } catch { json = { raw }; }
  if (!r.ok) {
    trace && trace.push({ step:"error", status:r.status, body:(json?.error||json?.raw||raw||"").toString().slice(0,200) });
    const e = new Error(`api.bible ${r.status}`);
    e.status = r.status; e.details = json;
    throw e;
  }
  trace && trace.push({ step:"ok", status:r.status });
  return json;
}
async function getPassageAuto({ bibleId, osis, trace }) {
  const id = bibleId || DEFAULT_BIBLE_ID;
  if (!id) throw new Error("Missing bibleId (set API_BIBLE_ID or provide ?bibleId=)");
  // 1) /passages/OSIS
  try {
    const u = `${API_ROOT}/bibles/${id}/passages/${encodeURIComponent(osis)}?${qs(CONTENT_QS)}`;
    const j = await fetchJson(u, trace);
    return { ref: j?.data?.reference || osis, html: j?.data?.content || "" };
  } catch (e) {
    if (/^\w+\.\d+$/.test(osis)) {
      // 1b) plage large 1–199
      const [b,c] = osis.split(".");
      const range = `${b}.${c}.1-${b}.${c}.199`;
      try {
        const u = `${API_ROOT}/bibles/${id}/passages/${encodeURIComponent(range)}?${qs(CONTENT_QS)}`;
        const j = await fetchJson(u, trace);
        return { ref: j?.data?.reference || range, html: j?.data?.content || "" };
      } catch {/* continue */}
    }
  }
  // 2) /chapters/OSIS
  const u2 = `${API_ROOT}/bibles/${id}/chapters/${encodeURIComponent(osis)}?${qs(CONTENT_QS)}`;
  const j2 = await fetchJson(u2, trace);
  return { ref: j2?.data?.reference || osis, html: j2?.data?.content || "" };
}

/* -------------------- analyse rapide -------------------- */
function htmlToPlain(h){ return String(h||"").replace(/<sup[^>]*>.*?<\/sup>/g," ").replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim(); }
function firstSentence(t){
  const m = String(t||"").match(/^[\s\S]{1,220}?([\.!\?…]|$)/u);
  return (m && m[0] || "").trim();
}
function topTerms(text, n=8){
  const STOP = new Set(["et","ou","donc","or","ni","car","mais","de","du","des","la","le","les","un","une","au","aux","dans","par","pour","sur","sous","avec","sans","entre","qui","que","quoi","dont","où","ne","pas","plus","tout","tous","se","sa","son","ses","leur","leurs","je","tu","il","elle","nous","vous","ils","elles","ce","cet","cette","ces","d","l","a","à","y","en"]);
  const tokens = String(text||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9 ’'\-]+/g," ").split(/\s+/).filter(Boolean);
  const freq = new Map();
  for (const w0 of tokens){
    const w = w0.replace(/^['’\-]+|['’\-]+$/g,"");
    if (!w || w.length<3 || STOP.has(w)) continue;
    freq.set(w, (freq.get(w)||0)+1);
  }
  return [...freq.entries()].sort((a,b)=>b[1]-a[1]).slice(0,n).map(([term,count])=>({term,count}));
}

/* -------------------- 28 rubriques -------------------- */
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

function buildSections(meta, passageText, hint=""){
  const intro = firstSentence(passageText) || "(texte court)";
  const terms = topTerms(passageText, 10).map(t=>t.term);
  const theme = `Lecture de **${meta.reference}**${hint?` — ${hint}`:""}. Mots saillants: ${terms.slice(0,5).join(", ")||"—"}.`;
  const plan = "Découpage observé par répétitions et transitions (suggérer 3–6 mouvements).";

  const blocks = [
    theme,
    `En bref : ${intro}`,
    "Contexte immédiat et progression interne visibles à la lecture.",
    "Attribution traditionnelle (présentée avec prudence) et place canonique.",
    "Type de texte (narratif/poétique/prophétique/discours) et ses indices formels.",
    `Structure : ${plan}`,
    `Plan : ${plan}`,
    (terms.length? terms.map(w=>`• ${w}`).join(" ") : "• (peu de mots-clés significatifs)"),
    terms.slice(0,5).map(w=>`• **${w}** — usage notable dans la section.`).join("\n") || "• (à préciser depuis le texte)",
    "Acteurs et lieux repérables (noms propres, toponymes, fonctions).",
    "Question directrice posée par le texte lui-même.",
    "Développement : enchaînement des idées majeures relevées.",
    `Point pivot (climax) autour duquel s’articulent ouverture et conclusion : ${intro}`,
    "AT : passages parallèles/échos prudents.",
    "NT : reprises/éclairages christologiques.",
    "Parallèles bibliques (motifs, structures, promesses/accomplissements).",
    "Lecture christocentrique mesurée (fonction christologique du passage).",
    "3–5 vérités doctrinales mises en évidence.",
    "Promesses et avertissements implicites/explicites.",
    "Principes intemporels applicables aujourd’hui.",
    "Applications personnelles (3–5 pas concrets).",
    "Applications communautaires/écclésiales.",
    "6 questions pour la discussion en groupe.",
    `Prière ancrée dans **${meta.reference}**.`,
    "Méditation courte : relire la phrase clé, rendre grâce.",
    "2–3 versets à mémoriser (selon l’édition consultée).",
    "Difficultés possibles et pistes de réponse.",
    "Ressources complémentaires (intro, notes, cartes)."
  ];

  return TITLES.map((t,i)=>({ index:i+1, title:t, content:blocks[i]||"", verses:[] }));
}

/* -------------------- handler -------------------- */
export default async function handler(req, res) {
  const trace = [];
  const SAFE_OK = (meta, text, hint="") => replyJSON(res, 200, { ok:true, data:{ meta, sections: buildSections(meta, text, hint) }, trace });

  try {
    // URL parsing super défensif
    let book="Genèse", chapter="1", verse="", translation="JND", bibleId="", mode="full", dry=false, selftest=false, wantTrace=false, safe=false;
    try {
      const url = new URL(req.url || "", "http://x");
      const sp = url.searchParams;
      book = sp.get("book") || book;
      chapter = sp.get("chapter") || chapter;
      verse = sp.get("verse") || verse;
      translation = sp.get("translation") || translation;
      bibleId = sp.get("bibleId") || bibleId;
      mode = (sp.get("mode")||mode).toLowerCase();
      dry = sp.get("dry")==="1";
      selftest = sp.get("selftest")==="1";
      wantTrace = sp.get("trace")==="1";
      safe = sp.get("safe")==="1";
    } catch (e) {
      trace.push({ step:"url-parse-error", message:String(e?.message||e) });
    }

    if (selftest) {
      return replyJSON(res, 200, { ok:true, engine:"LLM-FREE", modes:["mini","full"], usesApiBible: !!API_KEY, source:"study-28", trace });
    }

    const meta = {
      book, chapter:String(chapter), verse:String(verse||""),
      translation, reference: `${book} ${chapter}${verse?":"+verse:""}`, osis: ""
    };

    if (dry) return SAFE_OK(meta, "Exemple de texte (dry-run).");

    // Pas de clé → on sert quand même 28 rubriques (message clair)
    if (!API_KEY) return SAFE_OK(meta, "", "API_BIBLE_KEY absente — génération hors-ligne.");

    // OSIS
    const osis = buildOsis({ book, chapter, verse });
    meta.osis = osis || "";

    if (!osis) return SAFE_OK(meta, "", "Livre inconnu — génération hors-ligne.");

    if (safe) {
      // mode parachute : on n’appelle pas l’API du tout
      return SAFE_OK(meta, "", "Mode safe=1 — pas d’appel API, rubriques génériques.");
    }

    // tentative API
    let passageRef = meta.reference;
    let passageText = "";
    try {
      const p = await getPassageAuto({ bibleId, osis, trace });
      passageRef = p.ref || passageRef;
      passageText = htmlToPlain(p.html);
    } catch (apiErr) {
      trace.push({ step:"api-bible-failed", message:String(apiErr?.message||apiErr), status: apiErr?.status });
      // On retombe en douceur
      meta.reference = passageRef;
      return SAFE_OK(meta, "", `Passage non récupéré (${apiErr?.status||"?"}) — rubriques génériques.`);
    }

    meta.reference = passageRef;

    // Analyse + sections
    return SAFE_OK(meta, passageText);

  } catch (fatal) {
    // Et même si le top-level casse, on renvoie 200 avec fallback.
    const meta = { book:"?", chapter:"?", verse:"", translation:"?", reference:"(fallback)", osis:"" };
    trace.push({ step:"fatal", message:String(fatal?.message||fatal) });
    return replyJSON(res, 200, { ok:true, data:{ meta, sections: buildSections(meta, "", "ERREUR interne — fallback") }, trace });
  }
}
