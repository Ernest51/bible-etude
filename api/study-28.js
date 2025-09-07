// api/study-28.js
// Étude 28 points (sans LLM) avec analyse heuristique du passage pour générer des contenus variés

export const config = { runtime: "nodejs" };

/**
 * Paramètres:
 *   ?book=Genèse&chapter=1[&verse=1-5][&bibleId=...][&translation=JND|LSG…][&mode=mini|full][&dry=1][&trace=1]
 */

const API_ROOT = "https://api.scripture.api.bible/v1";
const API_KEY  = process.env.API_BIBLE_KEY || "";
const DEFAULT_BIBLE_ID = process.env.API_BIBLE_ID || "";

// ---------- util HTTP ----------
function send(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload, null, 2));
}

async function fetchJson(url, trace) {
  trace && trace.push({ step: "fetch", url });
  const r = await fetch(url, { headers: { accept: "application/json", "api-key": API_KEY } });
  const txt = await r.text();
  let j; try { j = txt ? JSON.parse(txt) : {}; } catch { j = { raw: txt }; }
  if (!r.ok) {
    trace && trace.push({ step: "error", status: r.status, body: (j?.error || j?.raw || txt).toString().slice(0, 200) });
    const e = new Error(`api.bible ${r.status}`);
    e.status = r.status; e.details = j; throw e;
  }
  trace && trace.push({ step: "ok", status: r.status });
  return j;
}

// ---------- FR → OSIS ----------
const MAP = {
  "genese":"GEN","genèse":"GEN","gen":"GEN","exode":"EXO","exo":"EXO","levitique":"LEV","lévitique":"LEV","lev":"LEV",
  "nombres":"NUM","num":"NUM","deuteronome":"DEU","deutéronome":"DEU","deu":"DEU","josue":"JOS","josué":"JOS","jos":"JOS",
  "juges":"JDG","jdg":"JDG","ruth":"RUT","rut":"RUT","1samuel":"1SA","1 samuel":"1SA","2samuel":"2SA","2 samuel":"2SA",
  "1rois":"1KI","1 rois":"1KI","2rois":"2KI","2 rois":"2KI","1chroniques":"1CH","2chroniques":"2CH","esdras":"EZR","néhémie":"NEH","nehemie":"NEH",
  "esther":"EST","job":"JOB","psaumes":"PSA","psaume":"PSA","proverbes":"PRO","ecclesiaste":"ECC","ecclésiaste":"ECC",
  "cantique descantiques":"SNG","cantique des cantiques":"SNG","cantiques":"SNG","cantique":"SNG",
  "esaie":"ISA","esaïe":"ISA","isaie":"ISA","isaïe":"ISA","isa":"ISA",
  "jeremie":"JER","jérémie":"JER","lamentations":"LAM","ezechiel":"EZK","ézéchiel":"EZK","daniel":"DAN","osee":"HOS","osée":"HOS",
  "joel":"JOL","joël":"JOL","amos":"AMO","abdias":"OBA","jonas":"JON","michee":"MIC","michée":"MIC","nahoum":"NAM","habacuc":"HAB",
  "sophonie":"ZEP","aggee":"HAG","aggée":"HAG","zacharie":"ZEC","malachie":"MAL","matthieu":"MAT","marc":"MRK","luc":"LUK","jean":"JHN",
  "actes":"ACT","romains":"ROM","1corinthiens":"1CO","2corinthiens":"2CO","galates":"GAL","ephesiens":"EPH","éphésiens":"EPH","philippiens":"PHP",
  "colossiens":"COL","1thessaloniciens":"1TH","2thessaloniciens":"2TH","1timothee":"1TI","1 timothée":"1TI","2timothee":"2TI","tite":"TIT",
  "philemon":"PHM","philémon":"PHM","hebreux":"HEB","hébreux":"HEB","jacques":"JAS","1pierre":"1PE","2pierre":"2PE",
  "1jean":"1JN","2jean":"2JN","3jean":"3JN","jude":"JUD","apocalypse":"REV","apo":"REV","apoc":"REV","rev":"REV"
};
function norm(s){
  return String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9 ]+/g,"").replace(/\s+/g,"").trim();
}
function osisBook(book){
  const key = norm(book);
  if (MAP[key]) return MAP[key];
  const hit = Object.keys(MAP).find(k => k.startsWith(key));
  return hit ? MAP[hit] : null;
}
function buildOsis({ book, chapter, verse }){
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

// ---------- api.bible wrappers ----------
const CONTENT_QS = {
  "content-type":"html",
  "include-notes":"false",
  "include-titles":"true",
  "include-chapter-numbers":"true",
  "include-verse-numbers":"true",
  "include-verse-spans":"false",
  "use-org-id":"false"
};
function qs(obj){ const u=new URLSearchParams(); for(const [k,v] of Object.entries(obj||{})){u.set(k,String(v))} return u.toString(); }

async function getPassageAuto({ bibleId, osis, trace }){
  const id = bibleId || DEFAULT_BIBLE_ID;
  if (!id) throw new Error("Missing bibleId (set API_BIBLE_ID or provide ?bibleId=)");
  // 1) passages (chapitre / plage fournie)
  try {
    const url = `${API_ROOT}/bibles/${id}/passages/${encodeURIComponent(osis)}?${qs(CONTENT_QS)}`;
    const j = await fetchJson(url, trace);
    return { ref: j?.data?.reference||osis, html: j?.data?.content||"" };
  } catch (e) {
    // 1b) plage large pour “chapitre entier”
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
  // 2) chapters (fallback)
  const url2 = `${API_ROOT}/bibles/${id}/chapters/${encodeURIComponent(osis)}?${qs(CONTENT_QS)}`;
  const j2 = await fetchJson(url2, trace);
  return { ref: j2?.data?.reference||osis, html: j2?.data?.content||"" };
}

// ---------- analyse texte ----------
function htmlToPlain(html){
  return String(html||"")
    .replace(/<sup[^>]*>.*?<\/sup>/g," ") // numéros
    .replace(/<[^>]+>/g," ")
    .replace(/\s+/g," ")
    .trim();
}
function splitSentences(frText){
  const s = String(frText||"")
    .replace(/(\.)\s+(\d+\s+)/g,"$1 $2"); // évite couper sur numéro de verset isolé
  const parts = s.split(/(?<=[\.\!\?…])\s+(?=[A-ZÉÈÊÀÂÎÔÛÇa-z0-9])/u).filter(Boolean);
  return parts;
}
function tokenize(frText){
  const t = frText.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g,"")
    .replace(/[^a-z0-9\-’'\s]/g," ")
    .replace(/\s+/g," ")
    .trim();
  return t.split(" ").filter(Boolean);
}
const STOP = new Set([
  "et","ou","donc","or","ni","car","mais","de","du","des","la","le","les","un","une","au","aux","dans","par","pour","sur","sous","avec","sans","entre",
  "qui","que","quoi","dont","où","ne","pas","plus","tout","tous","se","sa","son","ses","leur","leurs","je","tu","il","elle","nous","vous","ils","elles",
  "ce","cet","cette","ces","d","l","a","à","y","en","aupres","afin","ainsi","comme","qu","lequel","laquelle","lesquels","lesquelles"
]);
function topTerms(frText, n=8){
  const freq = new Map();
  for (const w of tokenize(frText)) {
    const ww = w.replace(/^['’-]+|['’-]+$/g,"");
    if (!ww || STOP.has(ww) || ww.length < 3) continue;
    freq.set(ww, 1 + (freq.get(ww)||0));
  }
  return Array.from(freq.entries())
    .sort((a,b)=>b[1]-a[1])
    .slice(0,n)
    .map(([w,c])=>({term:w, count:c}));
}
function detectCharactersAndPlaces(frText){
  // heuristique simple : mots en capitale initiale non en début de phrase + termes connus
  const chars = new Set();
  const places = new Set();
  const knownPlaces = ["Jérusalem","Sion","Nazareth","Bethléhem","Galilée","Judée","Samarie","Égypte","Babel","Babylone","Rome","Corinthe","Éphèse","Philippes","Antioche"];
  const tokens = frText.split(/\s+/);
  for (let i=0; i<tokens.length; i++){
    const w = tokens[i].replace(/[^\p{L}\-’']/gu,"");
    if (!w) continue;
    const isCapital = /^[A-ZÉÈÊÀÂÎÔÛÇ]/.test(w);
    if (isCapital && w.length>2) chars.add(w);
  }
  for (const p of knownPlaces) if (frText.includes(p)) places.add(p);
  // nettoie faux positifs très fréquents
  for (const common of ["Dieu","Seigneur","Esprit","Christ"]) chars.delete(common);
  return { characters: Array.from(chars).slice(0,8), places: Array.from(places) };
}
function detectStructure(frText){
  const lines = frText.split(/(?= \d+ )/); // naïf: coupe sur numéros de verset précédés d'un espace
  const hasDieuDit = (frText.match(/Dieu dit/gi)||[]).length;
  const hasSoirMatin = /soir.*matin|matin.*soir/gi.test(frText);
  const segments = [];

  // Heuristique spéciale Genèse 1 : "Dieu dit" + "il y eut un soir et il y eut un matin"
  if (hasDieuDit >= 4 && hasSoirMatin) {
    // essaie de repérer 6 séquences
    const guess = Math.min(6, hasDieuDit);
    for (let i=1;i<=guess;i++){
      segments.push(`Jour ${i} — acte créateur (répétition “Dieu dit…”, conclusion “il y eut un soir et il y eut un matin”).`);
    }
    if (/sept|7|repos/gi.test(frText)) segments.push("Jour 7 — repos divin / achèvement.");
  } else if (lines.length >= 3) {
    // sinon, propose un plan en 3–5 mouvements par découpage grossier
    const k = Math.min(5, Math.max(3, Math.floor(lines.length/5)));
    for (let i=0;i<k;i++){
      segments.push(`Mouvement ${i+1} — progression narrative/argumentative.`);
    }
  } else {
    segments.push("Ouverture — situation ou affirmation majeure.");
    segments.push("Développement — actions/arguments.");
    segments.push("Clôture — conclusion ou retombées.");
  }
  return segments;
}
function short(s, n=220){
  s = String(s||"").trim();
  if (s.length<=n) return s;
  return s.slice(0,n-1).trim()+"…";
}

// ---------- génération de 28 rubriques variées ----------
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

function buildSections(meta, passageText, mode){
  const titles = mode==="mini" ? TITLES_MINI : TITLES_FULL;

  const sentences = splitSentences(passageText);
  const first = sentences[0] || passageText.slice(0,180);
  const last  = sentences[sentences.length-1] || "";
  const terms = topTerms(passageText, 10);
  const keyWords = terms.map(t=>t.term);
  const {characters, places} = detectCharactersAndPlaces(passageText);
  const structure = detectStructure(passageText);

  // briques
  const theme = `Lecture de **${meta.reference}**. Le passage met en avant ${keyWords.length? `les thèmes récurrents : ${keyWords.slice(0,4).join(", ")}` : "des motifs clés du récit"} ; il s’ouvre sur « ${short(first,110)} ».`;
  const resume = `En bref : ${short(first,160)} ${last ? `… La section se conclut par « ${short(last,110)} ».` : ""}`;
  const contexte = `Contexte immédiat observé dans le texte : progression interne, marqueurs de répétition${structure.length?` (${structure.length} segments décelés)`:""}, termes fréquents (${keyWords.slice(0,6).join(", ")}), et enchaînement logique des affirmations.`;
  const genre = /dit/gi.test(passageText) || /ainsi/gi.test(passageText) ? "Récit structuré par unités orales (« …dit »), au rythme régulier." : "Récit / discours à dominante narrative, avec transitions internes repérables.";
  const plan = structure.map((s,i)=>`${i+1}) ${s}`).join(" ");
  const motscles = keyWords.length ? keyWords.map(w=>`• ${w}`).join(" ") : "• (mots récurrents non significatifs)";
  const termesDef = keyWords.slice(0,5).map(w=>`• **${w}** — emploi notoire dans la section.`).join("\n");
  const persLieux = `${characters.length?`Personnages: ${characters.join(", ")}. `:""}${places.length?`Lieux: ${places.join(", ")}.`:""}`.trim() || "Acteurs/lieux peu saillants dans la section.";
  const question = `Quel est l’effet principal visé par ${meta.reference} sur le lecteur ? Quels enjeux ressortent des répétitions (${keyWords.slice(0,3).join(", ")}) ?`;
  const idees = `Idées clés qui émergent : ${keyWords.slice(0,5).map(x=>x).join(", ")} ; ${structure.length?`${structure.length} mouvements structurants`:"enchaînement simple"} ; ouverture: « ${short(first,90)} ».`;
  const pivot = sentences[Math.max(1, Math.floor(sentences.length/2))-1] || first;
  const refAT = "Comparer les motifs/fonctions avec d’autres passages de l’AT partageant vocabulaires et motifs.";
  const refNT = "Repérer échos/thèmes repris dans le NT (création, alliance, foi, gloire, sagesse, salut…).";
  const paralleles = "Mettre en dialogue des passages où le même motif revient (création/nouvelle création ; sortie/retour ; promesse/accomplissement).";
  const christo = "Lecture christocentrique mesurée : voir comment le passage prépare/éclaire l’œuvre du Christ (création, image de Dieu, repos, lumière, vie…).";
  const verites = ["Dieu agit avec intention et ordre.","La Parole de Dieu produit des effets réels.","La création/rédemption révèle son caractère."].map((v,i)=>`${i+1}) ${v}`).join(" ");
  const promAvert = "Promesses implicites (vie, ordre, bonté) et avertissements (chaos, ténèbres, désordre) selon la réponse humaine à la Parole.";
  const principes = "Dieu parle, crée, ordonne ; l’humain est invité à accueillir, discerner, répondre et cultiver.";
  const applPerso = ["Fixer un temps de lecture et d’écoute.","Nommer une zone de “désordre” à remettre à Dieu.","Choisir un verset à mémoriser cette semaine."].map((a,i)=>`${i+1}) ${a}`).join(" ");
  const applComm = "En Église : créer des espaces d’écoute de la Parole ; discerner des priorités communes ; cultiver la gratitude et le repos.";
  const qpg = ["Qu’est-ce qui se répète le plus et pourquoi ?","Quel est le mouvement principal du texte ?","Que dit ce passage sur Dieu ?","Quel appel concret pour nous ?","Quel lien avec l’Évangile ?","Quel verset retenir ?"]
    .map((q,i)=>`${i+1}) ${q}`).join(" ");
  const priere = `Dieu de grâce, nous recevrons ta Parole en **${meta.reference}** : éclaire nos cœurs, ordonne notre vie, et conduis-nous dans ta paix. Amen.`;
  const med = `Relire lentement : « ${short(first,140)} » ; puis rendre grâce pour l’œuvre de Dieu et son ordre bienveillant.`;
  const memo = last ? `• ${short(first,100)}\n• ${short(last,100)}` : `• ${short(first,100)}\n• Un verset marquant du passage`;
  const diffic = "Difficultés possibles : lecture littérale/poétique, anachronismes, détails techniques ; réponses : revenir au propos théologique central et à la fonction du texte.";
  const ressources = "Utiliser une bonne introduction biblique, une Bible d’étude, et des cartes/notes pour situer le passage.";

  const contents = [
    theme, resume, contexte, "Attribution prudente selon la tradition et fonction canonique.", genre,
    `Structure : ${plan}`, `Plan : ${plan}`, motscles, termesDef, persLieux,
    question, idees, `Pivot : ${short(pivot,180)}`,
    refAT, refNT, paralleles, christo, verites, promAvert,
    principes, applPerso, applComm, qpg, priere, med, memo,
    diffic, ressources
  ];

  return titles.map((t,i)=>({
    index: i+1,
    title: t,
    content: contents[i] || "",
    verses: []
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
      const secs = buildSections(meta, "Exemple de texte démonstratif pour la structure.", mode);
      return send(res, 200, { ok:true, data:{ meta, sections:secs }, trace });
    }

    if (!API_KEY) return send(res, 500, { ok:false, error:"API_BIBLE_KEY manquante" });

    const osis = buildOsis({ book, chapter, verse });
    if (!osis) {
      const secs = buildSections(meta, "", mode);
      return send(res, 200, { ok:true, data:{ meta, sections:secs }, trace });
    }

    let passageRef = meta.reference;
    let passageText = "";
    let lastErr = "inconnu";

    try {
      const p = await getPassageAuto({ bibleId, osis, trace });
      passageRef = p.ref || passageRef;
      passageText = htmlToPlain(p.html);
    } catch (e) {
      lastErr = e?.status ? `api.bible ${e.status}` : String(e?.message||e);
    }

    meta.reference = passageRef;
    meta.osis = osis;

    // S’il y a eu une erreur API → on génère quand même des sections informatives
    const textForGen = passageText || `(Passage non récupéré : ${lastErr}).`;

    const sections = buildSections(meta, textForGen, mode);
    send(res, 200, { ok:true, data:{ meta, sections }, trace });
  } catch (e) {
    send(res, 500, { ok:false, error:String(e?.message||e) });
  }
}
