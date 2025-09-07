// api/study-28.js — Génération 28 rubriques sans OpenAI (api.bible inside)
export const config = { runtime: "nodejs" };

const API_ROOT = "https://api.scripture.api.bible/v1";
const API_KEY  = process.env.API_BIBLE_KEY || "";
const DEFAULT_BIBLE_ID = process.env.API_BIBLE_ID || ""; // ex: a93a92589195411f-01

function send(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload, null, 2));
}

// -------- FR → OSIS (tolérant) --------
const MAP = {
  "genese":"GEN","genèse":"GEN","gen":"GEN",
  "exode":"EXO","exo":"EXO",
  "levitique":"LEV","lévitique":"LEV","lev":"LEV",
  "nombres":"NUM","num":"NUM",
  "deuteronome":"DEU","deutéronome":"DEU","deu":"DEU",
  "josue":"JOS","josué":"JOS","jos":"JOS",
  "juges":"JDG","jdg":"JDG",
  "ruth":"RUT","rut":"RUT",
  "1samuel":"1SA","2samuel":"2SA",
  "1rois":"1KI","2rois":"2KI",
  "1chroniques":"1CH","2chroniques":"2CH",
  "esdras":"EZR","nehemie":"NEH","esther":"EST","job":"JOB",
  "psaumes":"PSA","proverbes":"PRO","ecclesiaste":"ECC","cantique descantiques":"SNG",
  "esaie":"ISA","jeremie":"JER","lamentations":"LAM","ezechiel":"EZK","daniel":"DAN",
  "osee":"HOS","joel":"JOL","amos":"AMO","abdias":"OBA","jonas":"JON","michee":"MIC",
  "nahoum":"NAM","habacuc":"HAB","sophonie":"ZEP","aggee":"HAG","zacharie":"ZEC","malachie":"MAL",
  "matthieu":"MAT","marc":"MRK","luc":"LUK","jean":"JHN","actes":"ACT","romains":"ROM",
  "1corinthiens":"1CO","2corinthiens":"2CO","galates":"GAL","ephesiens":"EPH","philippiens":"PHP",
  "colossiens":"COL","1thessaloniciens":"1TH","2thessaloniciens":"2TH","1timothee":"1TI","2timothee":"2TI",
  "tite":"TIT","philemon":"PHM","hebreux":"HEB","jacques":"JAS","1pierre":"1PE","2pierre":"2PE",
  "1jean":"1JN","2jean":"2JN","3jean":"3JN","jude":"JUD","apocalypse":"REV"
};
function norm(s){ return String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9 ]+/g,"").replace(/\s+/g,"").trim(); }
function osisBook(book){ const key = norm(book); if (MAP[key]) return MAP[key]; const hit = Object.keys(MAP).find(k => k.startsWith(key)); return hit ? MAP[hit] : null; }
function buildOsis({book, chapter, verse}) {
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

const CONTENT_QS = {
  "content-type":"html","include-notes":"false","include-titles":"true",
  "include-chapter-numbers":"true","include-verse-numbers":"true",
  "include-verse-spans":"false","use-org-id":"false"
};
function qs(obj){ const u=new URLSearchParams(); Object.entries(obj||{}).forEach(([k,v])=>u.set(k,String(v))); return u.toString(); }
function stripHtml(html){ return String(html||"").replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim(); }

async function call(url, trace){
  trace && trace.push({ step:"fetch", url });
  const r = await fetch(url, { headers:{ accept:"application/json", "api-key": API_KEY } });
  const txt = await r.text();
  let j; try { j = txt ? JSON.parse(txt) : {}; } catch { j = { raw: txt }; }
  if (!r.ok) {
    trace && trace.push({ step:"error", status:r.status, body: (j?.error || j?.raw || txt).toString().slice(0,200) });
    const e = new Error(`api.bible ${r.status}`); e.status = r.status; e.details = j; throw e;
  }
  trace && trace.push({ step:"ok", status:r.status });
  return j;
}
async function resolveBibleId(preferred){
  if (preferred) return preferred;
  if (DEFAULT_BIBLE_ID) return DEFAULT_BIBLE_ID;
  const j = await call(`${API_ROOT}/bibles?language=fra`);
  const arr = j?.data || [];
  if (!arr.length) throw new Error("Aucune Bible FR disponible (api.bible)");
  return arr[0].id;
}
async function getPassageAuto({ bibleId, osis, trace }) {
  const id = await resolveBibleId(bibleId);
  try {
    const url = `${API_ROOT}/bibles/${id}/passages/${encodeURIComponent(osis)}?${qs(CONTENT_QS)}`;
    const j = await call(url, trace);
    return { bibleId:id, ref:j?.data?.reference||osis, html:j?.data?.content||"" };
  } catch (e) {
    if (/^\w+\.\d+$/.test(osis)) {
      const [b,c] = osis.split(".");
      try {
        const range = `${b}.${c}.1-${b}.${c}.199`;
        const j = await call(`${API_ROOT}/bibles/${id}/passages/${encodeURIComponent(range)}?${qs(CONTENT_QS)}`, trace);
        return { bibleId:id, ref:j?.data?.reference||range, html:j?.data?.content||"" };
      } catch {}
    }
  }
  const url2 = `${API_ROOT}/bibles/${id}/chapters/${encodeURIComponent(osis)}?${qs(CONTENT_QS)}`;
  const j2 = await call(url2, trace);
  return { bibleId:id, ref:j2?.data?.reference||osis, html:j2?.data?.content||"" };
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

function firstSentence(plain){
  if (!plain) return "";
  const m = plain.match(/(.+?[.!?])(\s|$)/u);
  return (m ? m[1] : plain.slice(0,180)).trim();
}
function keywordsFR(text, k=10){
  const stop = new Set("le la les de des du un une et en est au aux sur dans que qui qu se ce cet cette il elle ils elles nous vous ne pas plus ses son sa par pour avec sans ou ni on leur leurs soit sont fut futs futent futes été etes a avons avez ont je tu il elle on nous vous ils elles cela ceci comme quand mais donc or car si".split(/\s+/));
  const freq = Object.create(null);
  String(text||"").toLowerCase().split(/[^a-zàâäéèêëïîôöùûüçœ]+/i).forEach(w=>{
    if (!w || stop.has(w) || w.length<3) return; freq[w]=(freq[w]||0)+1;
  });
  return Object.entries(freq).sort((a,b)=>b[1]-a[1]).slice(0,k).map(([w])=>w);
}
function sectionsFrom(passageRef, plain, fallbackMsg){
  const first = firstSentence(plain) || fallbackMsg || "";
  const keys = keywordsFR(plain,10);
  const row = [
    `Lecture de **${passageRef}**. Mots saillants: ${keys.slice(0,5).join(", ")}.`,
    `En bref : ${first || "Résumé factuel du passage."}`,
    "Contexte immédiat et progression interne visibles à la lecture.",
    "Attribution traditionnelle (présentée avec prudence) et place canonique.",
    "Type de texte (narratif/poétique/prophétique/discours) et ses indices formels.",
    "Structure : Découpage observé par répétitions et transitions (suggérer 3–6 mouvements).",
    "Plan : Découpage observé par répétitions et transitions (suggérer 3–6 mouvements).",
    "• " + (keys.join(" • ") || "mots significatifs relevés dans le passage"),
    keys.slice(0,5).map(w=>`• **${w}** — définition/usage dans le passage.`).join("\n") || "Termes clés définis.",
    "Acteurs et lieux repérables (noms propres, toponymes, fonctions).",
    "Question directrice posée par le texte lui-même.",
    "Développement : enchaînement des idées majeures relevées.",
    `Point pivot (climax) : ${first || passageRef}.`,
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
    `Prière guidée ancrée dans **${passageRef}**.`,
    "Méditation courte : relire la phrase clé, rendre grâce.",
    "2–3 versets à mémoriser.",
    "Difficultés possibles et pistes de réponse.",
    "Ressources complémentaires (intro, notes).",
  ];
  return TITLES.map((t,i)=>({ index:i+1, title:t, content: row[i] || fallbackMsg || "", verses:[] }));
}

export default async function handler(req, res){
  try{
    if (!API_KEY) return send(res, 500, { ok:false, error:"API_BIBLE_KEY manquante" });

    const url = new URL(req.url, "http://x");
    const sp = url.searchParams;

    const book = sp.get("book") || "Genèse";
    const chapter = sp.get("chapter") || "1";
    const verse = sp.get("verse") || "";
    const translation = sp.get("translation") || "LSG";
    const bibleId = sp.get("bibleId") || "";
    const dry = sp.get("dry")==="1";
    const wantTrace = sp.get("trace")==="1";
    const trace = wantTrace ? [] : null;

    const meta = { book, chapter:String(chapter), verse:String(verse||""), translation,
      reference:`${book} ${chapter}${verse?":"+verse:""}`, osis:"" };

    if (dry) {
      const secs = sectionsFrom(meta.reference, "Exemple de texte.");
      return send(res, 200, { ok:true, data:{ meta, sections:secs }, trace });
    }

    const osis = buildOsis({ book, chapter, verse });
    if (!osis) {
      const secs = sectionsFrom(meta.reference, "", "(Livre inconnu)");
      return send(res, 200, { ok:true, data:{ meta, sections:secs }, trace });
    }

    let passageRef = meta.reference, plain = "", lastErr = null;
    try {
      const p = await getPassageAuto({ bibleId, osis, trace });
      passageRef = p.ref || passageRef;
      plain = stripHtml(p.html || "");
    } catch (e) {
      lastErr = e?.status ? `api.bible ${e.status}` : String(e?.message || e);
    }

    let sections;
    if (plain) {
      sections = sectionsFrom(passageRef, plain);
    } else {
      sections = sectionsFrom(meta.reference, "", `(Passage non récupéré : ${lastErr || "inconnu"})`);
    }

    meta.reference = passageRef;
    meta.osis = osis;

    return send(res, 200, { ok:true, data:{ meta, sections }, trace });
  }catch(e){
    send(res, 500, { ok:false, error: String(e?.message||e) });
  }
}
