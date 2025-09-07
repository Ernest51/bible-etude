// api/generate-study.js
//
// Génère 28 rubriques pour un livre+chapitre.
// ✅ Source texte : api.bible (DARBY) — jamais LSG
// ✅ Réponses réelles pour la rubrique 3 (questions du chapitre précédent)
//    - Si chapter > 1 : on lit le chapitre précédent et on répond.
//    - Si chapter = 1 : on répond depuis le contexte global du livre.
// ✅ "DARBY" mentionné proprement (pas de répétition inutile).
//
// ENV (Vercel):
//  - API_BIBLE_KEY
//  - BIBLE_ID_DARBY
//  - API_BIBLE_BASE (optionnel, défaut: https://api.scripture.api.bible/v1)

const API_KEY  = process.env.API_BIBLE_KEY || process.env.APIBIBLE_KEY || "";
const BIBLE_ID = process.env.BIBLE_ID_DARBY || "YOUR_DARBY_BIBLE_ID";
const API_BASE = process.env.API_BIBLE_BASE || "https://api.scripture.api.bible/v1";

const fetchFn = globalThis.fetch || (await import("node-fetch")).default;

// --- Mapping FR → OSIS -------------------------------------------------------
const FR_TO_OSIS = {
  "Genèse":"Gen","Exode":"Exod","Lévitique":"Lev","Nombres":"Num","Deutéronome":"Deut",
  "Josué":"Josh","Juges":"Judg","Ruth":"Ruth",
  "1 Samuel":"1Sam","2 Samuel":"2Sam","1 Rois":"1Kgs","2 Rois":"2Kgs",
  "1 Chroniques":"1Chr","2 Chroniques":"2Chr","Esdras":"Ezra","Néhémie":"Neh","Esther":"Esth",
  "Job":"Job","Psaumes":"Ps","Proverbes":"Prov","Ecclésiaste":"Eccl","Cantique des Cantiques":"Song",
  "Ésaïe":"Isa","Esaïe":"Isa","Jérémie":"Jer","Lamentations":"Lam","Ézéchiel":"Ezek","Ezechiel":"Ezek","Daniel":"Dan",
  "Osée":"Hos","Joël":"Joel","Amos":"Amos","Abdias":"Obad","Jonas":"Jonah","Michée":"Mic",
  "Nahum":"Nah","Habacuc":"Hab","Sophonie":"Zeph","Aggée":"Hag","Zacharie":"Zech","Malachie":"Mal",
  "Matthieu":"Matt","Marc":"Mark","Luc":"Luke","Jean":"John","Actes":"Acts","Romains":"Rom",
  "1 Corinthiens":"1Cor","2 Corinthiens":"2Cor","Galates":"Gal","Éphésiens":"Eph","Ephésiens":"Eph","Philippiens":"Phil",
  "Colossiens":"Col","1 Thessaloniciens":"1Thess","2 Thessaloniciens":"2Thess","1 Timothée":"1Tim",
  "2 Timothée":"2Tim","Tite":"Titus","Philémon":"Phlm","Hébreux":"Heb","Jacques":"Jas",
  "1 Pierre":"1Pet","2 Pierre":"2Pet","1 Jean":"1John","2 Jean":"2John","3 Jean":"3John",
  "Jude":"Jude","Apocalypse":"Rev"
};

const OT = new Set([
  "Genèse","Exode","Lévitique","Nombres","Deutéronome","Josué","Juges","Ruth","1 Samuel","2 Samuel","1 Rois","2 Rois",
  "1 Chroniques","2 Chroniques","Esdras","Néhémie","Esther","Job","Psaumes","Proverbes","Ecclésiaste","Cantique des Cantiques",
  "Ésaïe","Esaïe","Jérémie","Lamentations","Ézéchiel","Ezechiel","Daniel","Osée","Joël","Amos","Abdias","Jonas","Michée",
  "Nahum","Habacuc","Sophonie","Aggée","Zacharie","Malachie"
]);

const BOOK_META = {
  "Genèse":{ genre:"Pentateuque / narratif", auteur:"Moïse (trad.)", date:"XVe–XIIIe s. av. J.-C.", ouverture:"Dieu crée tout, établit l’ordre et la bénédiction." },
  "Exode":{ genre:"Pentateuque / loi & récit", auteur:"Moïse (trad.)", date:"XVe–XIIIe s. av. J.-C.", ouverture:"Oppression d’Israël, préparation de la délivrance." }
  // (complète au besoin)
};

// --- Outils texte ------------------------------------------------------------
function normalize(s){
  return s.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g,"")
    .replace(/[^a-z0-9\s'-]/g," ")
    .replace(/\s+/g," ")
    .trim();
}
const STOP = new Set("a ai afin ainsi alors apres au aux avec avant bien car ce cela ces comme dans de des du donc elle elles en encore est et etre il ils je la le les leur lui mais me meme mes mon ne nos notre nous on ou par pas plus pour quand que qui sans selon si son sont sur ta te tes toi ton tous tout tres tu un une vos votre vous".split(" "));

function keywordStats(text, topN=14){
  const words = normalize(text).split(" ").filter(w=>w && !STOP.has(w) && !/^\d+$/.test(w));
  const freq = new Map();
  for(const w of words){ freq.set(w,(freq.get(w)||0)+1); }
  return [...freq.entries()].sort((a,b)=>b[1]-a[1]).slice(0, topN).map(([w,c])=>({word:w,count:c}));
}

function splitVerses(raw){
  const t = String(raw).replace(/\r/g," ").replace(/\s+/g," ").trim();
  const re = /(?:^|\s)(\d{1,3})\s(.*?)(?=\s\d{1,3}\s|$)/gs;
  const verses=[], seen = new Set();
  let m; while((m=re.exec(t))){
    const n = parseInt(m[1],10); const v = (m[2]||"").trim();
    if(!Number.isNaN(n) && v && !seen.has(n)){ verses.push({ n, text:v }); seen.add(n); }
  }
  if(!verses.length) verses.push({ n:1, text:t });
  return verses;
}

function chooseKeyVerse(verses, kws){
  const keyset = new Set(kws.map(k=>k.word));
  let best=verses[0], score=-1;
  for(const v of verses){
    const tokens = normalize(v.text).split(" "); let s=0;
    for(const tk of tokens) if(keyset.has(tk)) s++;
    if(s>score){ score=s; best=v; }
  }
  return best || verses[0];
}

function guessTheme(kws){
  const k=new Set(kws.map(x=>x.word));
  const hit = a => a.some(w=>k.has(w));
  if(hit(["crea","createur","lumiere","terre","mer","homme"])) return "Création et souveraineté de Dieu";
  if(hit(["foi","croire","grace","justification"])) return "Salut par la grâce et la foi";
  if(hit(["loi","commandement","saintete","peche","repentance"])) return "Sainteté et repentance";
  if(hit(["esprit","saint","puissance"])) return "Œuvre du Saint-Esprit";
  if(hit(["amour","frere","eglise"])) return "Amour et vie de l’Église";
  return "Dieu à l’œuvre dans l’histoire du salut";
}

function crossRefs(theme){
  if(/Création/.test(theme)) return ["Psaume 8","Psaume 19:2-5","Jean 1:1-3","Colossiens 1:16"];
  if(/Saintet|repentance|Loi/i.test(theme)) return ["Psaume 51","Romains 3","1 Pierre 1:15-16"];
  if(/Grâce|foi|Salut/i.test(theme)) return ["Éphésiens 2:8-10","Romains 10:9-10","Jean 3:16"];
  if(/Esprit/.test(theme)) return ["Actes 2","Romains 8","Galates 5:16-25"];
  if(/Église|Amour/.test(theme)) return ["1 Corinthiens 13","Jean 13:34-35","1 Jean 4:7-12"];
  return ["2 Timothée 3:16-17","Psaume 119"];
}

// Entités: noms propres/lieux (heuristique)
function extractEntities(text){
  const tokens = [];
  const re = /(^|[.!?]\s+|\s)([A-ZÉÈÊÀÂÎÔÛÄËÏÖÜ][a-zA-ZÉÈÊÀÂÎÔÛÄËÏÖÜàâçéèêëîïôöùûüÿœ'-]{2,})/g;
  let m; while((m=re.exec(text))){
    const word = m[2];
    if(!/^Je$|^Il$|^Et$|^Mais$|^Or$|^Car$/.test(word)) tokens.push(word);
  }
  // top 6 uniques
  const counts = tokens.reduce((acc,w)=> (acc[w]=(acc[w]||0)+1, acc), {});
  return Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([w])=>w);
}

function bullets(arr){ return arr.filter(Boolean).map(s=>`- ${s}`).join("\n"); }

// --- Charge la liste des 28 titres ------------------------------------------
async function loadStudyPoints(req){
  const proto = req.headers["x-forwarded-proto"] || "https";
  const host  = req.headers.host;
  try{
    const r = await fetchFn(`${proto}://${host}/api/study-28`);
    if(!r.ok) throw new Error();
    const j = await r.json();
    if(Array.isArray(j) && j.length) return j;
  }catch{}
  return Array.from({length:28},(_,i)=>({title:`Point ${i+1}`, hint:""}));
}

// --- api.bible ---------------------------------------------------------------
async function fetchDarbyText(osisId){
  if(!API_KEY || !BIBLE_ID) throw new Error("Config API_BIBLE_KEY / BIBLE_ID_DARBY manquante.");
  // Essai 1 — passages
  const url1 = `${API_BASE}/bibles/${encodeURIComponent(BIBLE_ID)}/passages/${encodeURIComponent(osisId)}?content-type=text&include-chapter-numbers=false&include-verse-numbers=true&include-verse-spans=false&use-org-id=false`;
  let r = await fetchFn(url1, { headers:{ "accept":"application/json", "api-key":API_KEY }});
  let data = r.ok ? await r.json() : null;
  let raw = data?.data?.content || (Array.isArray(data?.data?.passages) && data.data.passages[0]?.content) || "";
  // Essai 2 — chapters (plaintext)
  if(!raw || !String(raw).trim()){
    const url2 = `${API_BASE}/bibles/${encodeURIComponent(BIBLE_ID)}/chapters/${encodeURIComponent(osisId)}?content-type=plaintext&include-chapter-numbers=false&include-verse-numbers=true`;
    r = await fetchFn(url2, { headers:{ "accept":"application/json", "api-key":API_KEY }});
    data = r.ok ? await r.json() : null;
    raw = data?.data?.content || "";
  }
  const text = String(raw).replace(/<[^>]+>/g," ").replace(/\u00A0/g," ").replace(/\s+\n/g,"\n").replace(/\s+/g," ").trim();
  if(!text) throw new Error("Texte DARBY introuvable.");
  return text;
}

async function fetchPrevChapterText(bookFr, chapterNum){
  const osisBook = FR_TO_OSIS[bookFr];
  if(!osisBook) return "";
  const prev = Math.max(1, Number(chapterNum)-1);
  if(prev === Number(chapterNum)) return "";
  const osisId = `${osisBook}.${prev}`;
  try{ return await fetchDarbyText(osisId); }catch{ return ""; }
}

// --- Construction des rubriques ---------------------------------------------
function buildSections(book, chapter, points, textDARBY, textPrev){
  const ref = `${book} ${chapter}`;
  const verses = splitVerses(textDARBY);
  const full   = verses.map(v=>`${v.n}. ${v.text}`).join(" ");
  const kws    = keywordStats(full, 14);
  const keyV   = chooseKeyVerse(verses, kws);
  const theme  = guessTheme(kws);
  const xrefs  = crossRefs(theme);
  const testament = OT.has(book) ? "Ancien Testament" : "Nouveau Testament";
  const meta = BOOK_META[book] || { genre:"", auteur:"", date:"", ouverture:"" };

  const headerOnce =
`*Référence :* **${ref}** *(version : Darby)*  
*Mots-clés (détectés)* : ${kws.length ? kws.map(k=>k.word).join(", ") : "(—)"}  
*Verset-clé suggéré* : v.${keyV.n} — "${keyV.text.trim()}"`;

  // ------ Réponses pour la rubrique 3 ------
  function answersForPrevChapter(){
    // Cas chapitre 1 : pas de précédent -> on répond avec le contexte du livre
    if (Number(chapter) === 1) {
      const ctx = [
        meta.genre && `Genre : ${meta.genre}`,
        meta.auteur && `Auteur (trad.) : ${meta.auteur}`,
        meta.date && `Datation : ${meta.date}`,
        meta.ouverture && `Ouverture : ${meta.ouverture}`
      ].filter(Boolean).join(" — ");
      return [
        `**Contexte menant à ${ref} :** ${ctx || "Ouverture du livre : cadre théologique initial."}`,
        `**Personnages/Lieux :** au seuil du livre, les protagonistes émergent (p. ex. Dieu créateur dans Genèse 1 ; peu ou pas de lieux encore définis).`,
        `**Révélation sur Dieu :** Dieu se présente comme sujet souverain de l’histoire du salut (créateur, législateur, rédempteur selon le livre).`,
        `**Tensions en suspens :** les questions fondamentales du livre apparaissent (origine, appel, alliance, sainteté, promesse…).`,
        `**Attentes créées :** découvrir l’œuvre de Dieu au fil des chapitres et la réponse de l’homme (foi/obéissance).`
      ];
    }

    // Cas chapitre > 1 : utiliser textPrev
    const prev = String(textPrev||"").trim();
    if (!prev) {
      return [
        `**Contexte menant à ${ref} :** le chapitre précédent n’a pas pu être chargé (réseau/API).`,
        `**Personnages/Lieux :** —`,
        `**Révélation sur Dieu :** —`,
        `**Tensions :** —`,
        `**Attentes :** réessaie plus tard pour une analyse précise.`
      ];
    }

    const prevVerses = splitVerses(prev);
    const prevFull   = prevVerses.map(v=>v.text).join(" ");
    const prevKws    = keywordStats(prevFull, 10);
    const prevEnts   = extractEntities(prev);
    const prevTeaser = prevVerses.slice(0,3).map(v=>`v.${v.n} ${v.text}`).join(" ").slice(0,240)+(prevVerses.length>3?"…":"");

    // Indices "tension" basés sur certains mots (heuristique simple)
    const hasTension = /peche|colere|conflit|famine|esclavage|ennemi|jugement|crainte|plainte|oppression/i.test(normalize(prevFull));
    const tensionTxt = hasTension ? "Des tensions apparaissent (péché/épreuve/conflit) et appellent une intervention divine." : "Peu de tension explicite ; le récit prépare le développement suivant.";

    const godSnippets = prevVerses
      .map(v => v.text)
      .filter(t => /Dieu|Éternel|Seigneur/i.test(t))
      .slice(0,2)
      .map(t => `« ${t.slice(0,140).trim()}${t.length>140?"…":""} »`)
      .join(" / ");

    return [
      `**Contexte menant à ${ref} :** ${prevTeaser || "—"}`,
      `**Personnages/Lieux (détectés) :** ${prevEnts.join(", ") || "—"}`,
      `**Révélation sur Dieu :** ${godSnippets || "Dieu est présent/à l’arrière-plan selon le passage."}`,
      `**Tensions en suspens :** ${tensionTxt}`,
      `**Attentes créées :** comprendre comment ${ref} répond à ces éléments et fait avancer le récit/la doctrine.`
    ];
  }

  const prevAnswers = answersForPrevChapter();

  // -------- Sections --------
  const sections = [];

  sections.push({
    n:1, title: points[0]?.title || "Prière d’ouverture",
    content:
`Seigneur, ouvre nos yeux et nos coeurs pour comprendre ta Parole en **${ref}**. Donne-nous d’accueillir et pratiquer ta vérité. Amen.

${headerOnce}`
  });

  sections.push({
    n:2, title: points[1]?.title || "Canon et testament",
    content:
`**Livre :** ${book} — **${OT.has(book) ? "Ancien Testament" : "Nouveau Testament"}**
**Genre :** ${meta.genre || "—"}
**Auteur (tradition) :** ${meta.auteur || "—"}
**Datation :** ${meta.date || "—"}`
  });

  sections.push({
    n:3, title: points[2]?.title || "Questions du chapitre précédent",
    content:
`${prevAnswers.map(s=>`- ${s}`).join("\n")}`
  });

  const titleProp = kws[0]?.word ? `${book} ${chapter} — ${kws[0].word.replace(/^./,c=>c.toUpperCase())}` : `${book} ${chapter} — Aperçu doctrinal`;
  sections.push({ n:4, title: points[3]?.title || "Titre du chapitre", content: `**Proposition de titre :** _${titleProp}_` });

  sections.push({
    n:5, title: points[4]?.title || "Contexte historique",
    content: bullets([
      meta.auteur ? `Auteur (tradition) : ${meta.auteur}` : "Auteur : —",
      meta.date ? `Période : ${meta.date}` : "Période : —",
      "Situation du peuple / contexte géopolitique : à préciser selon le passage.",
      "Lieux / cartes : localiser si pertinent."
    ])
  });

  const lastNum = verses[verses.length-1]?.n || verses.length || 1;
  const a = Math.max(1, Math.floor(lastNum*0.33));
  const b = Math.max(a+1, Math.floor(lastNum*0.66));

  sections.push({
    n:6, title: points[5]?.title || "Structure littéraire",
    content: bullets([
      `v.1–${a} : ouverture/situation`,
      `v.${a+1}–${b} : développement/tension`,
      `v.${b+1}–${lastNum} : résolution/transition`
    ])
  });

  sections.push({
    n:7, title: points[6]?.title || "Genre littéraire",
    content:
`**Genre principal :** ${meta.genre || "—"}
${bullets([
  "Repérer connecteurs et répétitions.",
  "Prendre en compte les figures (métaphore, symbole) si poésie/prophétie.",
  "Comparer avec d’autres passages du même genre."
])}`
  });

  sections.push({
    n:8, title: points[7]?.title || "Auteur et généalogie",
    content:
`**Auteur (tradition) :** ${meta.auteur || "—"}
**Généalogie / liaisons :** relier aux patriarches, tribus, alliances (à compléter).`
  });

  sections.push({
    n:9, title: points[8]?.title || "Verset-clé doctrinal",
    content: `**Verset-clé : v.${keyV.n}** — ${keyV.text.trim()}`
  });

  sections.push({
    n:10, title: points[9]?.title || "Analyse exégétique",
    content: bullets([
      "Observer connecteurs (car, afin que, donc…).",
      "Repérer temps verbaux et voix (actif/passif).",
      "Identifier répétitions et inclusions.",
      "Noter changement de locuteur/sujet."
    ])
  });

  sections.push({
    n:11, title: points[10]?.title || "Analyse lexicale",
    content:
`**Mots récurrents (fr) :** ${kws.length ? kws.map(k=>`${k.word} (${k.count})`).join(", ") : "—"}
Compléter par une étude hébreu/grec sur 3–5 termes.`
  });

  sections.push({
    n:12, title: points[11]?.title || "Références croisées",
    content: xrefs.join(" ; ")
  });

  sections.push({
    n:13, title: points[12]?.title || "Fondements théologiques",
    content: bullets([
      guessTheme(kws),
      "Souveraineté et fidélité de Dieu.",
      "Révélation progressive (Ancien/Nouveau Testament).",
      "Christ au centre du dessein de Dieu."
    ])
  });

  sections.push({ n:14, title: points[13]?.title || "Thème doctrinal", content: `**Thème proposé :** ${guessTheme(kws)}` });

  sections.push({ n:15, title: points[14]?.title || "Fruits spirituels", content: bullets(["foi","obéissance","amour","espérance","sainteté"]) });

  sections.push({
    n:16, title: points[15]?.title || "Types bibliques",
    content: bullets([
      "Repérer symboles/figures (eau, désert, agneau, roi…).",
      "Chercher accomplissements en Christ.",
      "Vérifier par d’autres textes (éviter sur-interprétation)."
    ])
  });

  sections.push({ n:17, title: points[16]?.title || "Appui doctrinal", content: `Autres textes d’appui : ${xrefs.join(" ; ")}` });

  sections.push({
    n:18, title: points[17]?.title || "Comparaison entre versets",
    content:
`Comparer les mouvements (${`v.1–${a}`}, ${`v.${a+1}–${b}`}, ${`v.${b+1}–${lastNum}`}) :
- Progrès narratif / argumentatif
- Point culminant
- Connecteurs charnières`
  });

  sections.push({
    n:19, title: points[18]?.title || "Comparaison avec Actes 2",
    content: bullets([
      "Œuvre de l’Esprit : continuité / nouveauté",
      "Parole proclamée / reçue",
      "Communauté : prière, partage, mission"
    ])
  });

  sections.push({
    n:20, title: points[19]?.title || "Verset à mémoriser",
    content: `**À mémoriser :** ${ref}, v.${keyV.n}\n> ${keyV.text.trim()}`
  });

  sections.push({
    n:21, title: points[20]?.title || "Enseignement pour l’Église",
    content: bullets([
      "Que l’Église doit croire / vivre ici",
      "Application liturgique / formation / mission",
      "Prière communautaire ciblée"
    ])
  });

  sections.push({
    n:22, title: points[21]?.title || "Enseignement pour la famille",
    content: bullets([
      "Lire le passage ensemble (résumé en 3 phrases)",
      "Prier selon le verset-clé",
      "Décider d’un petit acte d’obéissance"
    ])
  });

  sections.push({
    n:23, title: points[22]?.title || "Enseignement pour enfants",
    content: bullets([
      "Raconter avec images/objets",
      "Une vérité : 1 phrase simple",
      "Un geste / prière"
    ])
  });

  sections.push({
    n:24, title: points[23]?.title || "Application missionnaire",
    content: bullets([
      "Quel besoin de la ville/voisinage ce texte éclaire-t-il ?",
      "Un témoignage (2 min) inspiré du passage",
      "Une action cette semaine"
    ])
  });

  sections.push({
    n:25, title: points[24]?.title || "Application pastorale",
    content: bullets([
      "Accompagnement (consolation / exhortation)",
      "Sainteté et restauration",
      "Formation de disciples"
    ])
  });

  sections.push({
    n:26, title: points[25]?.title || "Application personnelle",
    content: bullets([
      "Ce que Dieu me montre",
      "Ce que je change aujourd’hui",
      "Qui m’accompagne ?"
    ])
  });

  sections.push({
    n:27, title: points[26]?.title || "Versets à retenir",
    content: `3 versets à retenir : v.${keyV.n} + 2 autres choisis dans ${ref}.`
  });

  sections.push({
    n:28, title: points[27]?.title || "Prière de fin",
    content: `Seigneur, merci pour ta Parole en **${ref}**. Scelle-la dans nos vies ; donne-nous de marcher dans l’obéissance et la joie. Amen.`
  });

  return sections;
}

// --- Handler -----------------------------------------------------------------
export default async function handler(req, res){
  if(req.method === "HEAD"){ res.status(200).end(); return; }
  if(req.method !== "GET"){
    res.setHeader("Allow","GET, HEAD");
    res.status(405).json({ error:"Method Not Allowed" });
    return;
  }

  const book = String(req.query.book || "").trim();
  const chapter = String(req.query.chapter || "").trim();
  if(!book || !chapter){ res.status(400).json({ error:"Paramètres requis: book, chapter" }); return; }

  const osisBook = FR_TO_OSIS[book];
  if(!osisBook){ res.status(400).json({ error:`Livre inconnu: ${book}` }); return; }
  const osisId = `${osisBook}.${chapter}`;

  try{
    const [points, text, prevText] = await Promise.all([
      loadStudyPoints(req),
      fetchDarbyText(osisId),
      fetchPrevChapterText(book, chapter)
    ]);

    const sections = buildSections(book, chapter, points, text, prevText);
    const payload = { reference:`${book} ${chapter}`, version:"DARBY", sections };

    res.setHeader("Content-Type","application/json; charset=utf-8");
    res.setHeader("Cache-Control","private, max-age=60");
    res.status(200).json(payload);

  }catch(err){
    const points = await loadStudyPoints(req);
    const sections = buildSections(book, chapter, points, "", "");
    res.status(200).json({
      reference:`${book} ${chapter}`,
      version:"DARBY",
      sections,
      warning: err?.message || "Erreur inconnue api.bible"
    });
  }
}
