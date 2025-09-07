// api/generate-study.js
//
// Génération structurée des 28 rubriques à partir d’un livre + chapitre.
// ✅ Source: api.bible en version DARBY (jamais LSG)
// ✅ Réponses utiles sans LLM : mots-clés, verset-clé, structure, thèmes, applications,
//    et prise en compte du chapitre précédent si chapter > 1.
// ✅ "DARBY" n'est plus répété partout : mentionné une fois dans l'en-tête et aux endroits utiles.
//
// Variables d'environnement (Vercel):
//  - API_BIBLE_KEY    : clé api.bible
//  - BIBLE_ID_DARBY   : ID de la Bible Darby (ex: "f392f5f5f0b74a1a-01" – à confirmer)
//  - API_BIBLE_BASE   : (optionnel) défaut: "https://api.scripture.api.bible/v1"
//
// GET /api/generate-study?book=Exode&chapter=1
// HEAD → 200

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
  "Genèse":{ genre:"Pentateuque / narratif", auteur:"Moïse (trad.)", date:"XVe–XIIIe s. av. J.-C." },
  "Exode":{ genre:"Pentateuque / loi & récit", auteur:"Moïse (trad.)", date:"XVe–XIIIe s. av. J.-C." },
  "Lévitique":{ genre:"Pentateuque / loi", auteur:"Moïse (trad.)", date:"XVe–XIIIe s. av. J.-C." },
  "Nombres":{ genre:"Pentateuque / récit", auteur:"Moïse (trad.)", date:"XVe–XIIIe s. av. J.-C." },
  "Deutéronome":{ genre:"Pentateuque / loi", auteur:"Moïse (trad.)", date:"XVe–XIIIe s. av. J.-C." }
  // (compléter au besoin)
};

// --- Helpers texte -----------------------------------------------------------
function normalize(s){
  return s
    .toLowerCase()
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
  // cherche des patrons "1 " "2 " "3 " … dans un texte continu
  const t = String(raw).replace(/\r/g,"").replace(/\s+/g," ").trim();
  const re = /(?:^|\s)(\d{1,3})\s(.*?)(?=\s\d{1,3}\s|$)/gs;
  const verses=[];
  let m; while((m=re.exec(t))){
    const n = parseInt(m[1],10);
    const v = (m[2]||"").trim();
    if(!Number.isNaN(n) && v) verses.push({ n, text: v });
  }
  if(!verses.length) verses.push({ n:1, text:t });
  return verses;
}

function chooseKeyVerse(verses, kws){
  const keyset = new Set(kws.map(k=>k.word));
  let best=verses[0], score=-1;
  for(const v of verses){
    const tokens = normalize(v.text).split(" ");
    let s=0; for(const tk of tokens) if(keyset.has(tk)) s++;
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

function bullets(arr){ return arr.map(s=>`- ${s}`).join("\n"); }

// --- Chargement des titres 28 points ----------------------------------------
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

// --- api.bible: double stratégie pour obtenir du texte (évite les blancs) ---
async function fetchDarbyText(osisId){
  if(!API_KEY || !BIBLE_ID) throw new Error("Config API_BIBLE_KEY / BIBLE_ID_DARBY manquante.");

  // Essai 1 — passages (content-type=text)
  const url1 = `${API_BASE}/bibles/${encodeURIComponent(BIBLE_ID)}/passages/${encodeURIComponent(osisId)}?content-type=text&include-chapter-numbers=false&include-verse-numbers=true&include-verse-spans=false&use-org-id=false`;
  let r = await fetchFn(url1, { headers:{ "accept":"application/json", "api-key":API_KEY }});
  let data = r.ok ? await r.json() : null;
  let raw = data?.data?.content || (Array.isArray(data?.data?.passages) && data.data.passages[0]?.content) || "";

  // Essai 2 — chapters (plaintext) si vide
  if(!raw || !String(raw).trim()){
    const url2 = `${API_BASE}/bibles/${encodeURIComponent(BIBLE_ID)}/chapters/${encodeURIComponent(osisId)}?content-type=plaintext&include-chapter-numbers=false&include-verse-numbers=true`;
    r = await fetchFn(url2, { headers:{ "accept":"application/json", "api-key":API_KEY }});
    data = r.ok ? await r.json() : null;
    raw = data?.data?.content || "";
  }

  const text = String(raw)
    .replace(/<[^>]+>/g," ")
    .replace(/\u00A0/g," ")
    .replace(/\s+\n/g,"\n")
    .replace(/\s+/g," ")
    .trim();

  if(!text) throw new Error("Texte DARBY introuvable (vérifier BIBLE_ID_DARBY et droits).");
  return text;
}

// Si chapter>1, va chercher le chapitre précédent (pour alimenter la rubrique 3)
async function fetchPrevChapterText(bookFr, chapterNum){
  const osisBook = FR_TO_OSIS[bookFr];
  if(!osisBook) return "";
  const prev = Math.max(1, Number(chapterNum)-1);
  if(prev === Number(chapterNum)) return "";
  const osisId = `${osisBook}.${prev}`;
  try{
    return await fetchDarbyText(osisId);
  }catch{ return ""; }
}

// --- Construction des 28 rubriques ------------------------------------------
function buildSections(book, chapter, points, textDARBY, textPrev){
  const ref = `${book} ${chapter}`;
  const verses = splitVerses(textDARBY);
  const full   = verses.map(v=>`${v.n}. ${v.text}`).join(" ");
  const kws    = keywordStats(full, 14);
  const keyV   = chooseKeyVerse(verses, kws);
  const theme  = guessTheme(kws);
  const xrefs  = crossRefs(theme);
  const testament = OT.has(book) ? "Ancien Testament" : "Nouveau Testament";
  const meta = BOOK_META[book] || { genre:"", auteur:"", date:"" };

  const headerOnce =
`*Référence :* **${ref}** *(version : Darby)*  
*Mots-clés (détectés)* : ${kws.length ? kws.map(k=>k.word).join(", ") : "(—)"}  
*Verset-clé suggéré* : v.${keyV.n} — "${keyV.text.trim()}"`;

  // Récap bref du chapitre précédent
  let prevBlock = "";
  if (textPrev && String(textPrev).trim()) {
    const prevVerses = splitVerses(textPrev);
    const prevKws = keywordStats(prevVerses.map(v=>v.text).join(" "), 10);
    const teaser = prevVerses.slice(0,3).map(v=>`v.${v.n} ${v.text}`).join(" ");
    prevBlock =
`**Résumé du chapitre précédent (bref)**  
${teaser.slice(0,300)}${teaser.length>300?"…":""}

*Repères clés (détectés)* : ${prevKws.map(k=>k.word).join(", ") || "(—)"}`;
  } else if (Number(chapter) === 1) {
    prevBlock = "_Il n’existe pas de chapitre précédent pour ce livre._";
  } else {
    prevBlock = "_Le chapitre précédent n’a pas pu être chargé (réseau/API). Réessaie plus tard._";
  }

  function section(n, title, content){ return { n, title, content }; }

  const sections = [];

  // 1. Prière d’ouverture (en-tête unique avec DARBY + analyse)
  sections.push(section(1, points[0]?.title || "Prière d’ouverture",
`Seigneur, ouvre nos yeux et nos coeurs pour comprendre ta Parole en **${ref}**. Donne-nous d’accueillir et pratiquer ta vérité. Amen.

${headerOnce}
`));

  // 2. Canon et testament
  sections.push(section(2, points[1]?.title || "Canon et testament",
`**Livre :** ${book} — **${testament}**  
**Genre :** ${meta.genre || "—"}  
**Auteur (tradition) :** ${meta.auteur || "—"}  
**Datation :** ${meta.date || "—"}`));

  // 3. Questions du chapitre précédent (maintenant contextualisées)
  sections.push(section(3, points[2]?.title || "Questions du chapitre précédent",
`${prevBlock}

**Questions de relance :**  
- Que retient-on du contexte menant à **${ref}** ?  
- Quels personnages/lieux reviennent et pourquoi ?  
- Qu’a révélé le passage précédent sur Dieu ?  
- Quelles tensions restent en suspens ?  
- Quelles attentes crée la fin du chapitre précédent ?`));

  // 4. Titre du chapitre
  const titleProp = kws[0]?.word ? `${book} ${chapter} — ${kws[0].word.replace(/^./,c=>c.toUpperCase())}` : `${book} ${chapter} — Aperçu doctrinal`;
  sections.push(section(4, points[3]?.title || "Titre du chapitre",
`**Proposition de titre :** _${titleProp}_`));

  // 5. Contexte historique
  sections.push(section(5, points[4]?.title || "Contexte historique",
bullets([
  meta.auteur ? `Auteur (tradition) : ${meta.auteur}` : "Auteur : —",
  meta.date ? `Période : ${meta.date}` : "Période : —",
  "Situation du peuple / contexte géopolitique : à préciser selon le passage.",
  "Lieux / cartes : localiser si pertinent."
])));

  // 6. Structure littéraire (3 mouvements équilibrés)
  const n = verses[verses.length-1]?.n || verses.length;
  const a = Math.max(1, Math.floor(n*0.33));
  const b = Math.max(a+1, Math.floor(n*0.66));
  sections.push(section(6, points[5]?.title || "Structure littéraire",
bullets([
  `v.1–${a} : ouverture/situation`,
  `v.${a+1}–${b} : développement/tension`,
  `v.${b+1}–${n} : résolution/transition`
])));

  // 7. Genre littéraire
  sections.push(section(7, points[6]?.title || "Genre littéraire",
`**Genre principal :** ${meta.genre || "—"}  
**Pour l’interprétation :** ${bullets([
  "Repérer connecteurs, répétitions, rythmes.",
  "Prendre en compte les figures (métaphore, symbole) si poésie/prophétie.",
  "Comparer avec d’autres passages du même genre."
])}`));

  // 8. Auteur et généalogie
  sections.push(section(8, points[7]?.title || "Auteur et généalogie",
`**Auteur (tradition) :** ${meta.auteur || "—"}  
**Généalogie / liaisons :** relier aux patriarches, tribus, alliances (à compléter).`));

  // 9. Verset-clé doctrinal (réel)
  sections.push(section(9, points[8]?.title || "Verset-clé doctrinal",
`**Verset-clé : v.${keyV.n}** — ${keyV.text.trim()}`));

  // 10. Analyse exégétique
  sections.push(section(10, points[9]?.title || "Analyse exégétique",
bullets([
  "Observer connecteurs (car, afin que, donc…).",
  "Repérer temps verbaux et voix (actif/passif).",
  "Identifier répétitions et inclusions.",
  "Noter changement de locuteur/sujet."
])));

  // 11. Analyse lexicale (mots du chapitre)
  sections.push(section(11, points[10]?.title || "Analyse lexicale",
`**Mots récurrents (fr) :** ${kws.length ? kws.map(k=>`${k.word} (${k.count})`).join(", ") : "—"}  
Compléter par une étude hébreu/grec sur 3–5 termes.`));

  // 12. Références croisées
  sections.push(section(12, points[11]?.title || "Références croisées",
xrefs.join(" ; ")));

  // 13. Fondements théologiques
  sections.push(section(13, points[12]?.title || "Fondements théologiques",
bullets([
  guessTheme(kws),
  "Souveraineté et fidélité de Dieu.",
  "Révélation progressive (Ancien/Nouveau Testament).",
  "Christ au centre du dessein de Dieu."
])));

  // 14. Thème doctrinal
  sections.push(section(14, points[13]?.title || "Thème doctrinal",
`**Thème proposé :** ${guessTheme(kws)}`));

  // 15. Fruits spirituels
  sections.push(section(15, points[14]?.title || "Fruits spirituels",
bullets(["foi","obéissance","amour","espérance","sainteté"])));

  // 16. Types bibliques
  sections.push(section(16, points[15]?.title || "Types bibliques",
bullets([
  "Repérer symboles/figures (eau, désert, agneau, roi…).",
  "Chercher accomplissements en Christ.",
  "Vérifier par d’autres textes (éviter sur-interprétation)."
])));

  // 17. Appui doctrinal
  sections.push(section(17, points[16]?.title || "Appui doctrinal",
`Autres textes d’appui : ${xrefs.join(" ; ")}`));

  // 18. Comparaison entre versets
  sections.push(section(18, points[17]?.title || "Comparaison entre versets",
`Comparer les mouvements (${`v.1–${a}`}, ${`v.${a+1}–${b}`}, ${`v.${b+1}–${n}`}) :  
- Progres narratif / argumentatif  
- Point culminant  
- Connecteurs charnières`));

  // 19. Comparaison avec Actes 2
  sections.push(section(19, points[18]?.title || "Comparaison avec Actes 2",
bullets([
  "Œuvre de l’Esprit : continuité / nouveauté",
  "Parole proclamée / reçue",
  "Communauté : prière, partage, mission"
])));

  // 20. Verset à mémoriser
  sections.push(section(20, points[19]?.title || "Verset à mémoriser",
`**À mémoriser :** ${ref}, v.${keyV.n}  
> ${keyV.text.trim()}`));

  // 21. Enseignement pour l’Église
  sections.push(section(21, points[20]?.title || "Enseignement pour l’Église",
bullets([
  "Que l’Église doit croire / vivre ici",
  "Application liturgique / formation / mission",
  "Prière communautaire ciblée"
])));

  // 22. Famille
  sections.push(section(22, points[21]?.title || "Enseignement pour la famille",
bullets([
  "Lire le passage ensemble (résumé en 3 phrases)",
  "Prier selon le verset-clé",
  "Décider d’un petit acte d’obéissance"
])));

  // 23. Enfants
  sections.push(section(23, points[22]?.title || "Enseignement pour enfants",
bullets([
  "Raconter avec images/objets",
  "Une vérité : 1 phrase simple",
  "Un geste / prière"
])));

  // 24. Mission
  sections.push(section(24, points[23]?.title || "Application missionnaire",
bullets([
  "Quel besoin de la ville/voisinage ce texte éclaire-t-il ?",
  "Un témoignage (2 min) inspiré du passage",
  "Une action cette semaine"
])));

  // 25. Pastorale
  sections.push(section(25, points[24]?.title || "Application pastorale",
bullets([
  "Accompagnement (consolation / exhortation)",
  "Sainteté et restauration",
  "Formation de disciples"
])));

  // 26. Personnel
  sections.push(section(26, points[25]?.title || "Application personnelle",
bullets([
  "Ce que Dieu me montre",
  "Ce que je change aujourd’hui",
  "Qui m’accompagne ?"
])));

  // 27. Versets à retenir
  sections.push(section(27, points[26]?.title || "Versets à retenir",
`3 versets à retenir : v.${keyV.n} + 2 autres choisis dans ${ref}.`));

  // 28. Prière de fin
  sections.push(section(28, points[27]?.title || "Prière de fin",
`Seigneur, merci pour ta Parole en **${ref}**. Scelle-la dans nos vies ; donne-nous de marcher dans l’obéissance et la joie. Amen.`));

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
    // Sortie exploitable même si l'API échoue — mais sans spam "DARBY"
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
