// api/generate-study.js
//
// Étude 28 points – Génération côté serveur (Next/Vercel).
// ✅ Source texte: api.bible (version serveur), mais le nom de la version n'est jamais affiché.
// ✅ Prières d'ouverture (1) et de fin (28) en PREMIÈRE PERSONNE ("je") et spécifiques à CHAQUE chapitre.
// ✅ Le contenu varie avec: mots-clés, verset-clé, versets d'ouverture/milieu/fin, nombre de versets, testament, meta du livre.
// ✅ Sortie HTML: <strong>, <em>, <p> (aucun markdown **).
// ✅ Pas de cache côté API pour éviter toute répétition visible.
//
// ENV (Vercel):
//   - API_BIBLE_KEY
//   - BIBLE_ID_DARBY
//   - API_BIBLE_BASE (optionnel, défaut: https://api.scripture.api.bible/v1)

const API_KEY  = process.env.API_BIBLE_KEY || process.env.APIBIBLE_KEY || "";
const BIBLE_ID = process.env.BIBLE_ID_DARBY || "YOUR_DARBY_BIBLE_ID";
const API_BASE = process.env.API_BIBLE_BASE || "https://api.scripture.api.bible/v1";

const fetchFn = globalThis.fetch || (await import("node-fetch")).default;

// ---------- Mapping FR -> OSIS ----------
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

const OT = new Set([
  "Genèse","Exode","Lévitique","Nombres","Deutéronome","Josué","Juges","Ruth","1 Samuel","2 Samuel","1 Rois","2 Rois",
  "1 Chroniques","2 Chroniques","Esdras","Néhémie","Esther","Job","Psaumes","Proverbes","Ecclésiaste","Cantique des Cantiques",
  "Ésaïe","Esaïe","Jérémie","Lamentations","Ézéchiel","Ezechiel","Daniel","Osée","Joël","Amos","Abdias","Jonas","Michée",
  "Nahum","Habacuc","Sophonie","Aggée","Zacharie","Malachie"
]);

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

// ---------- Utilitaires texte ----------
function normalize(s){
  return s.toLowerCase()
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
  // Texte "1 Au commencement ... 2 La terre ..." -> détecter "numéro + espace + texte"
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
  if(hit(["roi","royaume","justice","jugement"])) return "Royaume et justice de Dieu";
  return "Dieu à l’œuvre dans l’histoire du salut";
}

// ---------- 28 titres depuis l'API locale ----------
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

// ---------- api.bible : passages -> chapters (fallback) ----------
async function fetchDarbyText(osisId){
  if(!API_KEY || !BIBLE_ID) throw new Error("Config API_BIBLE_KEY / BIBLE_ID_DARBY manquante.");
  // Essai 1: passages, texte avec numéros de versets
  const url1 = `${API_BASE}/bibles/${encodeURIComponent(BIBLE_ID)}/passages/${encodeURIComponent(osisId)}?content-type=text&include-chapter-numbers=false&include-verse-numbers=true`;
  let r = await fetchFn(url1, { headers:{ "accept":"application/json", "api-key":API_KEY }, cache:"no-store" });
  let data = r.ok ? await r.json() : null;
  let raw = data?.data?.content || (Array.isArray(data?.data?.passages) && data.data.passages[0]?.content) || "";

  // Essai 2: chapters/plaintext (fallback)
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

async function fetchPrevChapterText(bookFr, chapterNum){
  const osisBook = FR_TO_OSIS[bookFr];
  if(!osisBook) return "";
  const prev = Math.max(1, Number(chapterNum)-1);
  if(prev === Number(chapterNum)) return "";
  const osisId = `${osisBook}.${prev}`;
  try{ return await fetchDarbyText(osisId); }catch{ return ""; }
}

// ---------- Aides pour varier VRAIMENT selon le chapitre ----------
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
function tokensSnippet(kws, n=5){
  return kws.slice(0, n).map(k=>k.word).join(", ");
}

// ---------- PRIÈRES (première personne) ----------
function composeOpeningPrayerJe(ctx){
  const {book, chapter, theme, keyVerseText, meta, testament, verses} = ctx;
  const vStart = sampleVerse(verses, "start");
  const vMid   = sampleVerse(verses, "mid");
  const vEnd   = sampleVerse(verses, "end");
  const nVers  = verses.length;

  const metaLine = meta?.ouverture
    ? `Tu ouvres devant moi une page où ${meta.ouverture.toLowerCase()}`
    : `Tu ouvres devant moi une page où ta sagesse se révèle`;

  const axisOT = [
    "Tu parles et l’histoire se met en ordre ; je reconnais ta souveraineté qui fonde ma confiance.",
    "Par ton alliance tu soutiens la marche des faibles ; je veux me souvenir de tes promesses."
  ];
  const axisNT = [
    "Par Jésus, Parole faite chair, tu éclaires mon intelligence ; je reçois sa lumière sur ${book} ${chapter}.",
    "Par l’Esprit Saint, tu ouvres mon coeur ; je te prie d’unir vérité et obéissance en moi."
  ];
  const axes = OT.has(book) ? axisOT : axisNT;

  const lineTheme = {
    "Création et souveraineté de Dieu": "Comme au commencement, fais briller ta lumière et dissipe mes ténèbres ; ordonne le chaos de mes pensées pour que tout devienne louange.",
    "Salut par la grâce et la foi": "Rappelle à mon coeur que tout est grâce ; que ma foi vive produise l’obéissance reconnaissante.",
    "Sainteté et repentance": "Rends-moi sensible à ta sainteté ; que la repentance ouvre en moi un chemin de joie et de vie.",
    "Œuvre du Saint-Esprit": "Souffle de l’Esprit, viens féconder ma lecture ; grave en moi ce que tu m’enseignes.",
    "Amour et vie de l’Église": "Apprends-moi la charité qui édifie, afin que ta Parole me rassemble et m’envoie.",
    "Royaume et justice de Dieu": "Fais grandir en moi la douceur de ton règne et la droiture de ta justice."
  }[theme] || "Gouverne mon intelligence et mon coeur pour que ta vérité devienne mon chemin.";

  const kv = keyVerseText ? `Tu as placé dans ${book} ${chapter} une parole qui m’oriente : <em>« ${keyVerseText.trim()} »</em>. ` : "";
  const startLine = vStart ? `Dès l’ouverture (v.${vStart.n}), j’entends : <em>${clip(vStart.text, 120)}</em>. ` : "";
  const midLine   = vMid   ? `Au milieu (v.${vMid.n}), tu poursuis : <em>${clip(vMid.text, 120)}</em>. ` : "";
  const endLine   = vEnd   ? `Et vers la fin (v.${vEnd.n}), tu scelles : <em>${clip(vEnd.text, 120)}</em>. ` : "";
  const countLine = `Ce chapitre compte ${nVers} versets : donne-moi de les recevoir non comme des mots, mais comme ta voix pour aujourd’hui.`;

  const p1 = `<p><strong>Seigneur</strong>, j’ouvre ${book} ${chapter} et je me tiens devant toi. ${metaLine}. ${axes[0]} ${axes[1]} ${kv}Fais taire en moi ce qui ne vient pas de toi ; accorde-moi un coeur humble et une intelligence docile, afin que je lise pour t’aimer et t’obéir.</p>`;
  const p2 = `<p><strong>Père</strong>, éclaire ma pensée et affermis ma volonté. ${lineTheme} ${startLine}${midLine}${endLine}${countLine} Préserve-moi d’une curiosité stérile ; donne-moi la simplicité du disciple qui écoute pour mettre en pratique ce que tu commandes.</p>`;
  const p3 = `<p><strong>Je te le demande</strong> : que la lecture de ${book} ${chapter} transforme mon regard, pacifie mes relations et oriente mes choix. Que ta Parole porte en moi un fruit qui demeure. <em>Amen</em>.</p>`;

  return (p1+p2+p3);
}

function composeClosingPrayerJe(ctx){
  const {book, chapter, theme, keyVerseText, verses} = ctx;
  const vStart = sampleVerse(verses, "start");
  const vEnd   = sampleVerse(verses, "end");

  const accents = {
    "Création et souveraineté de Dieu": "Tu demeures Seigneur de l’histoire ; je m’abandonne avec confiance à ta sagesse.",
    "Salut par la grâce et la foi": "Tu m’as rappelé que tout est grâce ; apprends-moi une foi qui agit par l’amour.",
    "Sainteté et repentance": "Tu as visité ma conscience ; fais de la repentance un mouvement quotidien vers ta joie.",
    "Œuvre du Saint-Esprit": "Ton Esprit a ouvert l’Écriture ; qu’il grave en moi ce que j’ai reçu.",
    "Amour et vie de l’Église": "Tu me rassembles et m’envoies ; fais de moi un artisan de paix.",
    "Royaume et justice de Dieu": "Ton Royaume avance ; rends-moi droit et doux sous ton règne."
  }[theme] || "Tu as parlé ; donne-moi de répondre avec droiture, persévérance et joie.";

  const kv = keyVerseText
    ? `Garde en moi cette parole : <em>« ${keyVerseText.trim()} »</em>, qu’elle me conduise avec sûreté. `
    : "";

  const startSeal = vStart ? `Ce que j’ai entendu dès le début (v.${vStart.n}) demeure : <em>${clip(vStart.text,120)}</em>. ` : "";
  const endSeal   = vEnd   ? `Et ce sceau final (v.${vEnd.n}) m’accompagne : <em>${clip(vEnd.text,120)}</em>. ` : "";

  const p1 = `<p><strong>Dieu de vérité</strong>, au terme de ${book} ${chapter}, je te bénis pour la lumière reçue. ${accents} ${kv}${startSeal}${endSeal}Je ne veux pas sortir de cette étude en oubliant ce que j’ai vu ; fais de ma vie l’écho de ta Parole.</p>`;
  const p2 = `<p><strong>Seigneur fidèle</strong>, fais descendre en moi l’intelligence que tu m’as donnée : éclaire mes décisions, pacifie mes relations, oriente mon service. Quand je faiblis, relève-moi par ta consolation et la force de l’Esprit Saint.</p>`;
  const p3 = `<p><strong>Je me remets à toi</strong> : que ${book} ${chapter} reste un repère pour ma route. Que la semence déposée aujourd’hui porte un fruit de justice pour la gloire de ton Nom. <em>Amen</em>.</p>`;

  return (p1+p2+p3);
}

// ---------- Construction des 28 rubriques ----------
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

  // CONTEXTE pour les prières
  const prayerCtx = { book, chapter, theme, keyVerseText, meta, testament, verses };

  // -- 1. Prière d’ouverture (première personne) --
  const opening = composeOpeningPrayerJe(prayerCtx);

  // -- 28. Prière de fin (première personne) --
  const closing = composeClosingPrayerJe(prayerCtx);

  // --- Autres sections (placeholders courts — on les enrichira rub./rub.) ---
  function bullets(arr){ return arr.filter(Boolean).map(s=>`- ${s}`).join("\n"); }
  const n = verses[verses.length-1]?.n || verses.length || 1;
  const a = Math.max(1, Math.floor(n*0.33));
  const b = Math.max(a+1, Math.floor(n*0.66));

  const sections = [];

  // 1
  sections.push({ n:1, title: points[0]?.title || "Prière d’ouverture", content: opening });

  // 2
  sections.push({
    n:2, title: points[1]?.title || "Canon et testament",
    content: `<p><strong>Livre :</strong> ${book} — <strong>${testament}</strong><br><strong>Genre :</strong> ${meta.genre || "—"}</p>`
  });

  // 3 (questions du chapitre précédent — court pour l’instant)
  const prevShort = textPrev ? splitVerses(textPrev).slice(0,3).map(v=>`v.${v.n} ${v.text}`).join(" ").slice(0,300) : "";
  sections.push({
    n:3, title: points[2]?.title || "Questions du chapitre précédent",
    content: prevShort
      ? `<p><strong>Contexte menant à ${ref} :</strong> ${prevShort}…</p><p>Qu’attends-je que ${ref} éclaire et résolve&nbsp;?</p>`
      : `<p><em>Ouverture du livre ou indisponibilité du chapitre précédent.</em> Cette étude posera le contexte doctrinal et narratif nécessaire pour lire ${ref} avec intelligence.</p>`
  });

  // 4 Titre
  const titleProp = kws[0]?.word ? `${book} ${chapter} — ${kws[0].word.replace(/^./,c=>c.toUpperCase())}` : `${book} ${chapter} — Aperçu doctrinal`;
  sections.push({ n:4, title: points[3]?.title || "Titre du chapitre", content: `<p><strong>Proposition de titre :</strong> <em>${titleProp}</em></p>` });

  // 5 Contexte
  sections.push({ n:5, title: points[4]?.title || "Contexte historique",
    content: `<p>${BOOK_META[book]?.ouverture || "Contexte à préciser selon le livre."}</p>` });

  // 6 Structure
  sections.push({ n:6, title: points[5]?.title || "Structure littéraire",
    content: bullets([`v.1–${a} : ouverture/situation`,`v.${a+1}–${b} : développement/tension`,`v.${b+1}–${n} : résolution/transition`]) });

  // 7–27 placeholders (seront enrichis ensuite, rub./rub.)
  for(let i=7;i<=27;i++){
    sections.push({
      n:i, title: points[i-1]?.title || `Point ${i}`,
      content: `<p><em>Cette rubrique sera enrichie après validation des prières (phase suivante : génération longue 2000–2500 caractères).</em></p>`
    });
  }

  // 28
  sections.push({ n:28, title: points[27]?.title || "Prière de fin", content: closing });

  return sections;
}

// ---------- Handler ----------
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
    const payload = { reference:`${book} ${chapter}`, version:"", sections };

    // Désactiver le cache pour éviter la réutilisation d'une prière précédente
    res.setHeader("Content-Type","application/json; charset=utf-8");
    res.setHeader("Cache-Control","no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma","no-cache");
    res.setHeader("Expires","0");

    res.status(200).json(payload);

  }catch(err){
    // En cas d’échec API, produire quand même des prières (sans keyVerse)
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
  }
}
