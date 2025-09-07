// api/generate-study.js
//
// Étude 28 points – Génération côté serveur (Next/Vercel).
// ✅ Canon 66 livres (FR), validation stricte des chapitres.
// ✅ Prières 1 & 28 en "je", uniques par chapitre (variantes + données du chapitre).
// ✅ Sortie HTML: <strong>, <em>, <p> (aucun markdown **).
// ✅ Aucune mention du nom d'une version.
// ✅ Pas de cache (no-store) pour éviter toute répétition.
//
// ENV requis en prod :
//   - API_BIBLE_KEY
//   - BIBLE_ID_DARBY
//   - (optionnel) API_BIBLE_BASE (défaut: https://api.scripture.api.bible/v1)

const API_KEY  = process.env.API_BIBLE_KEY || process.env.APIBIBLE_KEY || "";
const BIBLE_ID = process.env.BIBLE_ID_DARBY || "YOUR_DARBY_BIBLE_ID";
const API_BASE = process.env.API_BIBLE_BASE || "https://api.scripture.api.bible/v1";

const fetchFn = globalThis.fetch || (await import("node-fetch")).default;

/* --------------------------- CANON 66 LIVRES --------------------------- */
// Noms FR acceptés (avec variantes accentuées) -> OSIS
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
  "1 Corinthiens":"1Cor","2 Corinthiens":"2Cor","Galates":"Gal","Éphésiens":"Eph","Philippiens":"Phil",
  "Colossiens":"Col","1 Thessaloniciens":"1Thess","2 Thessaloniciens":"2Thess","1 Timothée":"1Tim",
  "2 Timothée":"2Tim","Tite":"Titus","Philémon":"Phlm","Hébreux":"Heb","Jacques":"Jas",
  "1 Pierre":"1Pet","2 Pierre":"2Pet","1 Jean":"1John","2 Jean":"2John","3 Jean":"3John",
  "Jude":"Jude","Apocalypse":"Rev"
};

// Ordre des 66 livres (clés FR “canoniques”)
const ORDER_66 = [
  "Genèse","Exode","Lévitique","Nombres","Deutéronome","Josué","Juges","Ruth",
  "1 Samuel","2 Samuel","1 Rois","2 Rois","1 Chroniques","2 Chroniques","Esdras","Néhémie","Esther",
  "Job","Psaumes","Proverbes","Ecclésiaste","Cantique des Cantiques","Ésaïe","Jérémie","Lamentations","Ézéchiel","Daniel",
  "Osée","Joël","Amos","Abdias","Jonas","Michée","Nahum","Habacuc","Sophonie","Aggée","Zacharie","Malachie",
  "Matthieu","Marc","Luc","Jean","Actes","Romains","1 Corinthiens","2 Corinthiens","Galates","Éphésiens","Philippiens","Colossiens",
  "1 Thessaloniciens","2 Thessaloniciens","1 Timothée","2 Timothée","Tite","Philémon","Hébreux","Jacques","1 Pierre","2 Pierre",
  "1 Jean","2 Jean","3 Jean","Jude","Apocalypse"
];

// Nombre de chapitres par livre (canon protestant).
const CHAPTERS_66 = {
  "Genèse":50,"Exode":40,"Lévitique":27,"Nombres":36,"Deutéronome":34,"Josué":24,"Juges":21,"Ruth":4,
  "1 Samuel":31,"2 Samuel":24,"1 Rois":22,"2 Rois":25,"1 Chroniques":29,"2 Chroniques":36,"Esdras":10,"Néhémie":13,"Esther":10,
  "Job":42,"Psaumes":150,"Proverbes":31,"Ecclésiaste":12,"Cantique des Cantiques":8,"Ésaïe":66,"Jérémie":52,"Lamentations":5,"Ézéchiel":48,"Daniel":12,
  "Osée":14,"Joël":3,"Amos":9,"Abdias":1,"Jonas":4,"Michée":7,"Nahum":3,"Habacuc":3,"Sophonie":3,"Aggée":2,"Zacharie":14,"Malachie":4,
  "Matthieu":28,"Marc":16,"Luc":24,"Jean":21,"Actes":28,"Romains":16,"1 Corinthiens":16,"2 Corinthiens":13,"Galates":6,"Éphésiens":6,"Philippiens":4,"Colossiens":4,
  "1 Thessaloniciens":5,"2 Thessaloniciens":3,"1 Timothée":6,"2 Timothée":4,"Tite":3,"Philémon":1,"Hébreux":13,"Jacques":5,"1 Pierre":5,"2 Pierre":3,
  "1 Jean":5,"2 Jean":1,"3 Jean":1,"Jude":1,"Apocalypse":22
};

// Alias pour variantes accentuées vers la clé canonique (pour la validation)
const CANON_ALIAS = {
  "Esaïe":"Ésaïe",
  "Ezechiel":"Ézéchiel"
};

/* ------------------------ MÉTA & CLASSIFICATION ------------------------ */
const OT = new Set(ORDER_66.slice(0,39));
const BOOK_META = {
  "Genèse":{ genre:"Pentateuque / narratif", ouverture:"Commencement, création, alliance et promesse." },
  "Exode":{ genre:"Pentateuque / loi & récit", ouverture:"Délivrance, alliance, présence." },
  "Lévitique":{ genre:"Pentateuque / loi", ouverture:"Sainteté, sacerdoce, approche de Dieu." },
  "Nombres":{ genre:"Pentateuque / récit", ouverture:"Marche au désert, organisation, épreuves." },
  "Deutéronome":{ genre:"Pentateuque / loi", ouverture:"Rappel de l’alliance, obéissance, choix de vie." },
  "Psaumes":{ genre:"Poésie / prière", ouverture:"Louange, plainte, confiance." },
  "Ésaïe":{ genre:"Prophète majeur", ouverture:"Sainteté de Dieu, jugement et consolation." },
  "Matthieu":{ genre:"Évangile", ouverture:"Royaume, accomplissement, Messie." },
  "Marc":{ genre:"Évangile", ouverture:"Urgence de la Bonne Nouvelle, puissance du Fils." },
  "Luc":{ genre:"Évangile", ouverture:"Miséricorde, salut pour tous, Esprit." },
  "Jean":{ genre:"Évangile", ouverture:"Verbe fait chair, lumière et vie." },
  "Actes":{ genre:"Histoire", ouverture:"Esprit Saint, Église en mission." },
  "Romains":{ genre:"Épître", ouverture:"Justice de Dieu, foi, grâce." }
};

/* ----------------------------- UTILITAIRES ----------------------------- */
function normalize(s){
  return String(s||"").toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g,"")
    .replace(/[^a-z0-9\s'-]/g," ")
    .replace(/\s+/g," ")
    .trim();
}
const STOP = new Set("a ai afin ainsi alors apres au aux avec avant bien car ce cela ces comme dans de des du donc elle elles en encore est et etre il ils je la le les leur lui mais me meme mes mon ne nos notre nous on ou par pas plus pour quand que qui sans selon si son sont sur ta te tes toi ton tous tout tres tu un une vos votre vous".split(" "));

function keywordStats(text, topN=18){
  const words = normalize(text).split(" ").filter(w=>w && !STOP.has(w) && !/^\d+$/.test(w));
  const freq = new Map();
  for(const w of words){ freq.set(w,(freq.get(w)||0)+1); }
  return [...freq.entries()].sort((a,b)=>b[1]-a[1]).slice(0, topN).map(([w,c])=>({word:w,count:c}));
}

function splitVerses(raw){
  const t = String(raw).replace(/\r/g," ").replace(/\s+/g," ").trim();
  // Détection "numéro + espace + texte"
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
  if(hit(["crea","createur","lumiere","terre","mer","homme","ciel"])) return "Création et souveraineté de Dieu";
  if(hit(["foi","croire","grace","justification"])) return "Salut par la grâce et la foi";
  if(hit(["loi","commandement","saintete","peche","repentance"])) return "Sainteté et repentance";
  if(hit(["esprit","saint","puissance","onction"])) return "Œuvre du Saint-Esprit";
  if(hit(["amour","frere","eglise","corps"])) return "Amour et vie de l’Église";
  if(hit(["roi","royaume","justice","jugement"])) return "Royaume et justice de Dieu";
  return "Dieu à l’œuvre dans l’histoire du salut";
}

function canonizeBookName(frName){
  if(CANON_ALIAS[frName]) return CANON_ALIAS[frName];
  return frName;
}

function assertChapterInRange(bookFr, chapterStr){
  const book = canonizeBookName(bookFr);
  const max = CHAPTERS_66[book];
  if(!max) throw new Error(`Livre inconnu ou hors canon (66) : ${bookFr}`);
  const ch = Number(chapterStr);
  if(!Number.isFinite(ch) || ch < 1 || ch > max){
    const err = new Error(`${book} comporte ${max} chapitres. Chapitre demandé: ${chapterStr}.`);
    err.status = 400;
    throw err;
  }
  return { book, chapter: String(ch), max };
}

function previousRef(bookFr, chapterStr){
  const book = canonizeBookName(bookFr);
  const idx = ORDER_66.indexOf(book);
  const ch = Number(chapterStr);
  if(ch > 1) return { book, chapter: String(ch-1) };
  if(idx > 0){
    const prevBook = ORDER_66[idx-1];
    return { book: prevBook, chapter: String(CHAPTERS_66[prevBook]) };
  }
  return null;
}

/* -------------------------- API.BIBLE (texte) -------------------------- */
async function fetchBibleText(osisId){
  if(!API_KEY || !BIBLE_ID) throw new Error("Config API_BIBLE_KEY / BIBLE_ID_DARBY manquante.");
  // 1) passages
  const url1 = `${API_BASE}/bibles/${encodeURIComponent(BIBLE_ID)}/passages/${encodeURIComponent(osisId)}?content-type=text&include-chapter-numbers=false&include-verse-numbers=true`;
  let r = await fetchFn(url1, { headers:{ "accept":"application/json", "api-key":API_KEY }, cache:"no-store" });
  let data = r.ok ? await r.json() : null;
  let raw = data?.data?.content || (Array.isArray(data?.data?.passages) && data.data.passages[0]?.content) || "";

  // 2) fallback chapters/plaintext
  if(!raw || !String(raw).trim()){
    const url2 = `${API_BASE}/bibles/${encodeURIComponent(BIBLE_ID)}/chapters/${encodeURIComponent(osisId)}?content-type=plaintext&include-chapter-numbers=false&include-verse-numbers=true`;
    r = await fetchFn(url2, { headers:{ "accept":"application/json", "api-key":API_KEY }, cache:"no-store" });
    data = r.ok ? await r.json() : null;
    raw = data?.data?.content || "";
  }

  return String(raw)
    .replace(/<[^>]+>/g," ")
    .replace(/\u00A0/g," ")
    .replace(/\s+\n/g,"\n")
    .replace(/\s+/g," ")
    .trim();
}

async function fetchChapterText(frBook, chapterStr){
  const osisBook = FR_TO_OSIS[frBook] || FR_TO_OSIS[CANON_ALIAS[frBook]]; // accepte alias accent
  if(!osisBook) throw new Error(`Livre inconnu: ${frBook}`);
  const osisId = `${osisBook}.${chapterStr}`;
  return await fetchBibleText(osisId);
}

/* ------------------ VARIATION DES PRIÈRES (par chapitre) ------------------ */
function sampleVerse(verses, where="start"){
  if(!verses.length) return null;
  if(where==="start") return verses[0];
  if(where==="end") return verses[verses.length-1];
  const midIdx = Math.max(0, Math.min(verses.length-1, Math.floor(verses.length/2)));
  return verses[midIdx];
}
function clip(s, n=140){
  s = String(s||"").replace(/\s+/g," ").trim();
  if(s.length<=n) return s;
  return s.slice(0, n-1).trim()+"…";
}

function variantByChapter(arr, chapterNum){
  if(!arr.length) return "";
  return arr[(Math.max(1, Number(chapterNum)) - 1) % arr.length];
}

function composeOpeningPrayerJe(ctx){
  const {book, chapter, theme, keyVerseText, meta, verses, testament} = ctx;
  const vStart = sampleVerse(verses, "start");
  const vMid   = sampleVerse(verses, "mid");
  const vEnd   = sampleVerse(verses, "end");
  const nVers  = verses.length;

  const metaLine = meta?.ouverture
    ? variantByChapter([
        `Tu ouvres devant moi une page où ${meta.ouverture.toLowerCase()}.`,
        `Tu me conduis dans un terrain où ${meta.ouverture.toLowerCase()} prennent corps.`,
        `Tu me fais entrer là où ${meta.ouverture.toLowerCase()} s’éclairent.`
      ], chapter)
    : variantByChapter([
        "Tu ouvres devant moi une page où ta sagesse se révèle.",
        "Tu éclaires une page qui porte la trace de ta fidélité.",
        "Tu me donnes à lire une page travaillée par ta providence."
      ], chapter);

  const axesOT = [
    "Tu parles et l’histoire se met en ordre ; je reconnais ta souveraineté qui fonde ma confiance.",
    "Par ton alliance, tu soutiens la marche des faibles ; je veux me souvenir de tes promesses."
  ];
  const axesNT = [
    `Par Jésus, Parole faite chair, tu éclaires mon intelligence ; je reçois sa lumière sur ${book} ${chapter}.`,
    "Par l’Esprit Saint, tu ouvres mon coeur ; unis en moi vérité et obéissance."
  ];
  const axes = OT.has(book) ? axesOT : axesNT;

  const lineTheme = {
    "Création et souveraineté de Dieu": [
      "Comme au commencement, fais briller ta lumière et dissipe mes ténèbres.",
      "Du chaos fais naître l’ordre en moi pour que tout devienne louange."
    ],
    "Salut par la grâce et la foi": [
      "Rappelle à mon coeur que tout est grâce ; que ma foi vive produise l’obéissance reconnaissante."
    ],
    "Sainteté et repentance": [
      "Rends-moi sensible à ta sainteté ; que la repentance ouvre un chemin de joie.",
      "Apprends-moi à haïr le péché et à aimer la vérité."
    ],
    "Œuvre du Saint-Esprit": [
      "Souffle de l’Esprit, viens féconder ma lecture ; grave en moi ce que tu m’enseignes."
    ],
    "Amour et vie de l’Église": [
      "Apprends-moi la charité qui édifie ; fais de moi un artisan d’unité."
    ],
    "Royaume et justice de Dieu": [
      "Fais grandir en moi la douceur de ton règne et la droiture de ta justice."
    ]
  }[theme] || ["Gouverne mon intelligence et mon coeur pour que ta vérité devienne mon chemin."];

  const kv = keyVerseText ? `Tu as placé dans ${book} ${chapter} une parole qui m’oriente : <em>« ${keyVerseText.trim()} »</em>. ` : "";
  const startLine = vStart ? `Dès l’ouverture (v.${vStart.n}), j’entends : <em>${clip(vStart.text, 120)}</em>. ` : "";
  const midLine   = vMid   ? `Au milieu (v.${vMid.n}), tu poursuis : <em>${clip(vMid.text, 120)}</em>. ` : "";
  const endLine   = vEnd   ? `Et vers la fin (v.${vEnd.n}), tu scelles : <em>${clip(vEnd.text, 120)}</em>. ` : "";
  const countLine = variantByChapter([
    `Ce chapitre compte ${nVers} versets : donne-moi de les recevoir comme ta voix pour aujourd’hui.`,
    `${nVers} versets forment un itinéraire : apprends-moi à les parcourir avec foi.`,
    `En ${nVers} versets, tu traces un chemin ; que je le suive avec intelligence et amour.`
  ], chapter);

  const p1 = `<p><strong>Seigneur</strong>, j’ouvre ${book} ${chapter} et je me tiens devant toi. ${metaLine} ${axes[0]} ${kv}Fais taire en moi ce qui ne vient pas de toi ; accorde-moi un coeur humble et une intelligence docile.</p>`;
  const p2 = `<p><strong>Père</strong>, éclaire ma pensée et affermis ma volonté. ${variantByChapter(lineTheme, chapter)} ${axes[1]} ${startLine}${midLine}${endLine}${countLine}</p>`;
  const p3 = `<p><strong>Je te le demande</strong> : que la lecture de ${book} ${chapter} transforme mon regard, pacifie mes relations et oriente mes choix. Que ta Parole porte en moi un fruit qui demeure. <em>Amen</em>.</p>`;

  return (p1+p2+p3);
}

function composeClosingPrayerJe(ctx){
  const {book, chapter, theme, keyVerseText, verses} = ctx;
  const vStart = sampleVerse(verses, "start");
  const vEnd   = sampleVerse(verses, "end");

  const accents = {
    "Création et souveraineté de Dieu": [
      "Tu demeures Seigneur de l’histoire ; je m’abandonne à ta sagesse.",
      "Tout est entre tes mains ; enseigne-moi la confiance active."
    ],
    "Salut par la grâce et la foi": [
      "Tu m’as rappelé que tout est grâce ; apprends-moi une foi qui agit par l’amour."
    ],
    "Sainteté et repentance": [
      "Tu as visité ma conscience ; fais de la repentance un chemin quotidien vers ta joie."
    ],
    "Œuvre du Saint-Esprit": [
      "Ton Esprit a ouvert l’Écriture ; qu’il grave en moi ce que j’ai reçu."
    ],
    "Amour et vie de l’Église": [
      "Tu me rassembles et m’envoies ; fais de moi un artisan de paix."
    ],
    "Royaume et justice de Dieu": [
      "Ton Royaume avance ; rends-moi droit et doux sous ton règne."
    ]
  }[theme] || ["Tu as parlé ; donne-moi de répondre avec droiture, persévérance et joie."];

  const kv = keyVerseText
    ? `Garde en moi cette parole : <em>« ${keyVerseText.trim()} »</em>. `
    : "";

  const startSeal = vStart ? `Ce que j’ai entendu dès le début (v.${vStart.n}) demeure : <em>${clip(vStart.text,120)}</em>. ` : "";
  const endSeal   = vEnd   ? `Et ce sceau final (v.${vEnd.n}) m’accompagne : <em>${clip(vEnd.text,120)}</em>. ` : "";

  const p1 = `<p><strong>Dieu de vérité</strong>, au terme de ${book} ${chapter}, je te bénis pour la lumière reçue. ${variantByChapter(accents, chapter)} ${kv}${startSeal}${endSeal}</p>`;
  const p2 = `<p><strong>Seigneur fidèle</strong>, fais descendre en moi l’intelligence donnée : éclaire mes décisions, pacifie mes relations, oriente mon service. Quand je faiblis, relève-moi par ta consolation et la force de l’Esprit Saint.</p>`;
  const p3 = `<p><strong>Je me remets à toi</strong> : que ${book} ${chapter} reste un repère pour ma route. Que la semence déposée aujourd’hui porte un fruit de justice pour la gloire de ton Nom. <em>Amen</em>.</p>`;

  return (p1+p2+p3);
}

/* --------------------------- CONSTRUCTION 28 --------------------------- */
async function loadStudyPoints(req){
  const proto = req.headers["x-forwarded-proto"] || "https";
  const host  = req.headers.host;
  try{
    const r = await fetchFn(`${proto}://${host}/api/study-28`, { cache: "no-store" });
    if(!r.ok) throw new Error();
    const j = await r.json();
    if(Array.isArray(j) && j.length) return j;
  }catch{}
  return Array.from({length:28},(_,i)=>({title:`Point ${i+1}`, hint:""}));
}

function buildSections(book, chapter, points, textCurr, textPrev){
  const ref = `${book} ${chapter}`;
  const verses = splitVerses(textCurr);
  const full   = verses.map(v=>`${v.n}. ${v.text}`).join(" ");
  const kws    = keywordStats(full, 18);
  const keyV   = chooseKeyVerse(verses, kws);
  const theme  = guessTheme(kws);
  const testament = OT.has(book) ? "Ancien Testament" : "Nouveau Testament";
  const meta = BOOK_META[book] || { genre:"", ouverture:"" };
  const keyVerseText = keyV?.text || "";

  // Contexte prières
  const prayerCtx = { book, chapter, theme, keyVerseText, meta, testament, verses };

  // 1 & 28 : prières
  const opening = composeOpeningPrayerJe(prayerCtx);
  const closing = composeClosingPrayerJe(prayerCtx);

  // Placeholders (on enrichira rub./rub.)
  function bullets(arr){ return arr.filter(Boolean).map(s=>`- ${s}`).join("\n"); }
  const n = verses[verses.length-1]?.n || verses.length || 1;
  const a = Math.max(1, Math.floor(n*0.33));
  const b = Math.max(a+1, Math.floor(n*0.66));

  const sections = [];
  sections.push({ n:1,  title: points[0]?.title  || "Prière d’ouverture", content: opening });
  sections.push({ n:2,  title: points[1]?.title  || "Canon et testament",
    content: `<p><strong>Livre :</strong> ${book} — <strong>${testament}</strong><br><strong>Genre :</strong> ${meta.genre || "—"}</p>` });

  const prevShort = textPrev ? splitVerses(textPrev).slice(0,3).map(v=>`v.${v.n} ${v.text}`).join(" ").slice(0,300) : "";
  sections.push({ n:3, title: points[2]?.title || "Questions du chapitre précédent",
    content: prevShort
      ? `<p><strong>Contexte menant à ${ref} :</strong> ${prevShort}…</p><p>Qu’attends-je que ${ref} éclaire et résolve&nbsp;?</p>`
      : `<p><em>Ouverture du livre ou indisponibilité du chapitre précédent</em> — je poserai le contexte nécessaire pour lire ${ref} avec intelligence.</p>`
  });

  const titleProp = kws[0]?.word ? `${book} ${chapter} — ${kws[0].word.replace(/^./,c=>c.toUpperCase())}` : `${book} ${chapter} — Aperçu doctrinal`;
  sections.push({ n:4, title: points[3]?.title || "Titre du chapitre", content: `<p><strong>Proposition de titre :</strong> <em>${titleProp}</em></p>` });

  sections.push({ n:5, title: points[4]?.title || "Contexte historique",
    content: `<p>${BOOK_META[book]?.ouverture || "Contexte à préciser selon le livre."}</p>` });

  sections.push({ n:6, title: points[5]?.title || "Structure littéraire",
    content: bullets([`v.1–${a} : ouverture/situation`,`v.${a+1}–${b} : développement/tension`,`v.${b+1}–${n} : résolution/transition`]) });

  for(let i=7;i<=27;i++){
    sections.push({
      n:i, title: points[i-1]?.title || `Point ${i}`,
      content: `<p><em>Cette rubrique sera enrichie après validation des prières (phase suivante : génération longue 2000–2500 caractères).</em></p>`
    });
  }

  sections.push({ n:28, title: points[27]?.title || "Prière de fin", content: closing });
  return sections;
}

/* ------------------------------ HANDLER ------------------------------ */
export default async function handler(req, res){
  if(req.method === "HEAD"){ res.status(200).end(); return; }
  if(req.method !== "GET"){
    res.setHeader("Allow","GET, HEAD");
    res.status(405).json({ error:"Method Not Allowed" });
    return;
  }

  try{
    const rawBook = String(req.query.book || "").trim();
    const rawCh   = String(req.query.chapter || "").trim();
    if(!rawBook || !rawCh){ res.status(400).json({ error:"Paramètres requis: book, chapter" }); return; }

    // Validation canon 66
    const { book, chapter } = assertChapterInRange(rawBook, rawCh);

    const osisBook = FR_TO_OSIS[book] || FR_TO_OSIS[CANON_ALIAS[book]];
    if(!osisBook){ res.status(400).json({ error:`Livre inconnu: ${book}` }); return; }
    const osisId = `${osisBook}.${chapter}`;

    // Charger points + chapitre courant
    const [points, text] = await Promise.all([
      loadStudyPoints(req),
      fetchChapterText(book, chapter)
    ]);

    // Chapitre précédent (même livre ou livre précédent si ch=1)
    let prevText = "";
    const prev = previousRef(book, chapter);
    if(prev){
      try{ prevText = await fetchChapterText(prev.book, prev.chapter); }catch{}
    }

    const sections = buildSections(book, chapter, points, text, prevText);
    const payload = { reference:`${book} ${chapter}`, version:"", sections };

    // Désactiver les caches
    res.setHeader("Content-Type","application/json; charset=utf-8");
    res.setHeader("Cache-Control","no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma","no-cache");
    res.setHeader("Expires","0");

    res.status(200).json(payload);

  }catch(err){
    const status = err?.status || 500;
    if(status === 400){
      res.status(400).json({ error: err.message });
      return;
    }
    // En cas d’échec API, produire quand même des prières (sans keyVerse)
    try{
      const rawBook = String(req.query.book || "").trim();
      const rawCh   = String(req.query.chapter || "").trim();
      const { book, chapter } = assertChapterInRange(rawBook, rawCh);
      const points = await loadStudyPoints(req);
      const sections = buildSections(book, chapter, points, "", "");
      res.setHeader("Content-Type","application/json; charset=utf-8");
      res.setHeader("Cache-Control","no-store, no-cache, must-revalidate, proxy-revalidate");
      res.setHeader("Pragma","no-cache");
      res.setHeader("Expires","0");
      res.status(200).json({
        reference:`${book} ${chapter}`, version:"", sections,
        warning: err?.message || "Erreur inconnue api.bible"
      });
    }catch(e){
      res.status(500).json({ error: err?.message || "Erreur serveur" });
    }
  }
}
