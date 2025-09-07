// api/generate-study.js
//
// Étude 28 points – Génération côté serveur (Next/Vercel).
// ✅ Source texte: api.bible (version Darby côté serveur), mais le mot "Darby" N'EST JAMAIS affiché.
// ✅ Sortie HTML: <strong>, <em>, <p>, <br>, <ul>, <li> (aucun **markdown**).
// ✅ Rubriques 1 et 28: PRIÈRES longues (~1300 caractères chacune), adaptées au livre+chapitre,
//    en s'appuyant sur les mots-clés, le verset-clé et un thème doctrinal déduit.
// ✅ Les autres rubriques restent comme avant (courtes) jusqu’à validation rubrique par rubrique.
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
  // (compléter selon besoin)
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
  if(hit(["roi","royaume","justice","jugement"])) return "Royaume et justice de Dieu";
  return "Dieu à l’œuvre dans l’histoire du salut";
}

// ---------- 28 titres depuis l'API locale ----------
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

// ---------- api.bible : passages -> chapters (fallback) ----------
async function fetchDarbyText(osisId){
  if(!API_KEY || !BIBLE_ID) throw new Error("Config API_BIBLE_KEY / BIBLE_ID_DARBY manquante.");
  // Essai 1
  const url1 = `${API_BASE}/bibles/${encodeURIComponent(BIBLE_ID)}/passages/${encodeURIComponent(osisId)}?content-type=text&include-chapter-numbers=false&include-verse-numbers=true`;
  let r = await fetchFn(url1, { headers:{ "accept":"application/json", "api-key":API_KEY }});
  let data = r.ok ? await r.json() : null;
  let raw = data?.data?.content || (Array.isArray(data?.data?.passages) && data.data.passages[0]?.content) || "";
  // Essai 2
  if(!raw || !String(raw).trim()){
    const url2 = `${API_BASE}/bibles/${encodeURIComponent(BIBLE_ID)}/chapters/${encodeURIComponent(osisId)}?content-type=plaintext&include-chapter-numbers=false&include-verse-numbers=true`;
    r = await fetchFn(url2, { headers:{ "accept":"application/json", "api-key":API_KEY }});
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

// ---------- Génération des PRIÈRES longues (≈1300 caractères) ----------
function composeOpeningPrayer({book, chapter, theme, keyVerseText, meta, testament}){
  // Sélection d’axes doctrinaux selon le testament / thème
  const axes = [];
  if (OT.has(book)) {
    axes.push("Tu parles et les mondes existent, tu appelles et l’histoire s’ordonne sous ta main.");
    axes.push("Ton alliance trace un chemin de fidélité où la promesse soutient la marche des faibles.");
  } else {
    axes.push("Par ton Fils, Parole faite chair, tu nous ouvres le sens véritable des Écritures.");
    axes.push("Par l’Esprit Saint, tu illumines nos coeurs pour comprendre et aimer ta volonté.");
  }
  const axeTheme = {
    "Création et souveraineté de Dieu": "Que la lumière de ta sagesse dissipe nos ténèbres, comme au commencement, et que tout désordre se convertisse en louange.",
    "Salut par la grâce et la foi": "Accorde-nous la grâce d’une foi vivante, qui reçoit le salut sans mérite, et te répond par l’obéissance reconnaissante.",
    "Sainteté et repentance": "Rends-nous sensibles à ta sainteté afin que la repentance devienne pour nous une porte de vie et de joie.",
    "Œuvre du Saint-Esprit": "Souffle de l’Esprit, viens rendre notre lecture féconde, unissant vérité et puissance dans un même élan.",
    "Amour et vie de l’Église": "Apprends-nous la charité qui édifie, afin que ta Parole nous rassemble et nous envoie comme un seul corps.",
    "Royaume et justice de Dieu": "Fais grandir en nous la justice de ton Royaume et la douceur de ta souveraineté sur nos vies."
  }[theme] || "Que ta présence gouverne notre intelligence et notre coeur, pour que la vérité devienne chemin et vie.";

  const metaLine = meta?.ouverture ? `Tu nous introduis ici dans une page où ${meta.ouverture.toLowerCase()}` : `Tu nous introduis ici dans une page où ta sagesse se révèle.`;
  const kv = keyVerseText ? `Tu as déjà gravé dans ce chapitre cette parole qui nous oriente&nbsp;: <em>«&nbsp;${keyVerseText.trim()}&nbsp;»</em>. ` : "";

  // Construction ~1300 caractères (deux grands paragraphes + doxologie)
  const p1 = `<p><strong>Seigneur notre Dieu</strong>, alors que nous ouvrons ${book} ${chapter}, nous reconnaissons que ta Parole est vivante et qu’elle sonde les coeurs. ${metaLine}. ${axes[0]} ${axes[1]} ${kv}Donne-nous un esprit d’écoute docile : que nos pensées se taisent devant ta voix, que nos attentes s’alignent sur la tienne, et que notre désir le plus profond soit d’aimer ce que tu commandes.</p>`;
  const p2 = `<p><strong>Père de toute consolation</strong>, fais que ce chapitre devienne pour nous une école de vérité et de liberté : éclaire nos intelligences, affermis nos affections, redresse nos pas. ${axeTheme} Épargne-nous la curiosité stérile ; accorde-nous plutôt la simplicité des disciples qui cherchent ta face pour accomplir ta volonté. Que la cohérence de l’Écriture, depuis la première promesse jusqu’à l’espérance ultime, se déploie devant nous et nous conduise à te glorifier en actes et en paroles.</p>`;
  const p3 = `<p><strong>Nous te le demandons</strong> dans la paix que tu donnes : que la lecture de ${book} ${chapter} façonne notre vie, console nos blessures et fortifie notre espérance. Que ta Parole, reçue avec foi, porte un fruit qui demeure. <em>Amen</em>.</p>`;
  return (p1 + p2 + p3);
}

function composeClosingPrayer({book, chapter, theme, keyVerseText, testament}){
  const accents = {
    "Création et souveraineté de Dieu": "Tu demeures Seigneur du temps et de l’histoire ; rien n’échappe à ta sagesse.",
    "Salut par la grâce et la foi": "Tu nous as rappelé que tout vient de ta grâce ; fais-nous marcher dans une foi active.",
    "Sainteté et repentance": "Tu as visité nos consciences ; fais de la repentance un chemin quotidien vers ta joie.",
    "Œuvre du Saint-Esprit": "Ton Esprit a ouvert l’Écriture ; qu’il grave en nous ce que nous avons reçu.",
    "Amour et vie de l’Église": "Tu nous rassembles pour nous envoyer ; donne-nous d’aimer comme tu aimes.",
    "Royaume et justice de Dieu": "Tu fais lever ton Royaume au milieu de nous ; apprends-nous la justice et la douceur."
  }[theme] || "Tu as parlé ; apprends-nous à répondre avec droiture, persévérance et joie.";

  const kv = keyVerseText ? `Garde en nos mémoires la parole entendue aujourd’hui&nbsp;: <em>«&nbsp;${keyVerseText.trim()}&nbsp;»</em>, afin qu’elle nous conduise avec sûreté.` : "Grave en nous ce que tu as fait entendre aujourd’hui.";
  const ecclesia = OT.has(book)
    ? "Que notre méditation s’unisse au long témoignage de ton peuple, de génération en génération."
    : "Que la communion des saints nous fortifie pour rendre témoignage au Christ dans le monde.";

  const p1 = `<p><strong>Dieu de vérité</strong>, au terme de cette étude de ${book} ${chapter}, nous te bénissons pour la lumière reçue. ${accents} ${kv} Donne-nous d’honorer ta Parole non par des promesses vite oubliées, mais par l’obéissance humble et fidèle, afin que chaque devoir ordinaire devienne lieu de ta présence.</p>`;
  const p2 = `<p><strong>Seigneur fidèle</strong>, fais descendre dans notre vie l’intelligence que tu as donnée : éclaire nos décisions, pacifie nos relations, oriente notre service. ${ecclesia} Apprends-nous à discerner ta volonté au coeur des complexités, et, lorsque nous faiblissons, relève-nous par la consolation de l’Évangile et la force de l’Esprit Saint.</p>`;
  const p3 = `<p><strong>Nous nous remettons à toi</strong> : que ${book} ${chapter} demeure pour nous un repère et une source. Que la semence déposée aujourd’hui porte un fruit de justice, pour la gloire de ton Nom. <em>Amen</em>.</p>`;
  return (p1 + p2 + p3);
}

// ---------- Construction des 28 rubriques ----------
function buildSections(book, chapter, points, textCurr, textPrev){
  const ref = `${book} ${chapter}`;
  const verses = splitVerses(textCurr);
  const full   = verses.map(v=>`${v.n}. ${v.text}`).join(" ");
  const kws    = keywordStats(full, 14);
  const keyV   = chooseKeyVerse(verses, kws);
  const theme  = guessTheme(kws);
  const testament = OT.has(book) ? "Ancien Testament" : "Nouveau Testament";
  const meta = BOOK_META[book] || { genre:"", ouverture:"" };

  const keyVerseText = keyV?.text || "";

  // -- 1. Prière d’ouverture (≈1300 caractères) --
  const opening = composeOpeningPrayer({ book, chapter, theme, keyVerseText, meta, testament });

  // -- 28. Prière de fin (≈1300 caractères) --
  const closing = composeClosingPrayer({ book, chapter, theme, keyVerseText, testament });

  // --- Autres sections : on garde une version courte TEMPORAIRE (on les enrichira ensuite rubrique par rubrique) ---
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

  // 3 (résumé questions précédent, version courte pour l’instant)
  const prevShort = textPrev ? splitVerses(textPrev).slice(0,3).map(v=>`v.${v.n} ${v.text}`).join(" ").slice(0,300) : "";
  sections.push({
    n:3, title: points[2]?.title || "Questions du chapitre précédent",
    content: prevShort
      ? `<p><strong>Contexte menant à ${ref} :</strong> ${prevShort}…</p><p>Qu’attendons-nous que ${ref} éclaire et résolve&nbsp;?</p>`
      : `<p><em>Ouverture du livre ou indisponibilité du chapitre précédent.</em> Cette étude posera le contexte doctrinal et narratif nécessaire pour lire ${ref} avec intelligence.</p>`
  });

  // 4 Titre
  const titleProp = kws[0]?.word ? `${book} ${chapter} — ${kws[0].word.replace(/^./,c=>c.toUpperCase())}` : `${book} ${chapter} — Aperçu doctrinal`;
  sections.push({ n:4, title: points[3]?.title || "Titre du chapitre", content: `<p><strong>Proposition de titre :</strong> <em>${titleProp}</em></p>` });

  // 5 Contexte (bref)
  sections.push({ n:5, title: points[4]?.title || "Contexte historique",
    content: `<p>${BOOK_META[book]?.ouverture || "Contexte à préciser selon le livre."}</p>` });

  // 6 Structure
  sections.push({ n:6, title: points[5]?.title || "Structure littéraire",
    content: bullets([`v.1–${a} : ouverture/situation`,`v.${a+1}–${b} : développement/tension`,`v.${b+1}–${n} : résolution/transition`]) });

  // 7-27 (placeholder courts, on enrichira après validation des prières)
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
    const payload = { reference:`${book} ${chapter}`, version:"", sections }; // version vide => n'affiche rien

    res.setHeader("Content-Type","application/json; charset=utf-8");
    res.setHeader("Cache-Control","private, max-age=60");
    res.status(200).json(payload);

  }catch(err){
    // En cas d’échec API, produire quand même des prières (sans keyVerse)
    const points = await loadStudyPoints(req);
    const sections = buildSections(book, chapter, points, "", "");
    res.status(200).json({
      reference:`${book} ${chapter}`, version:"", sections,
      warning: err?.message || "Erreur inconnue api.bible"
    });
  }
}
