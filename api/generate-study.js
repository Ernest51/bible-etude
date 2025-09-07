// api/generate-study.js
//
// Génération enrichie des 28 rubriques à partir d’un livre + chapitre.
// - Source : api.bible (texte Darby côté serveur), mais **jamais** le mot “Darby” n’est affiché.
// - Sortie HTML: <strong>…</strong> au lieu de **…**.
// - Rubrique 3 répond réellement (contexte du livre si chapitre=1, sinon analyse du chapitre précédent).
//
// ENV (Vercel):
//   API_BIBLE_KEY      : clé api.bible
//   BIBLE_ID_DARBY     : ID bible Darby dans api.bible
//   API_BIBLE_BASE     : (optionnel, déf. "https://api.scripture.api.bible/v1")

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
  "Genèse":{ genre:"Pentateuque / narratif", auteur:"Moïse (trad.)", date:"XVe–XIIIe s. av. J.-C.", ouverture:"Dieu crée tout et établit l’ordre et la bénédiction." },
  "Exode":{ genre:"Pentateuque / loi & récit", auteur:"Moïse (trad.)", date:"XVe–XIIIe s. av. J.-C.", ouverture:"Oppression d’Israël, préparation de la délivrance." }
  // (compléter au besoin)
};

// ---------- Outils texte ----------
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

function extractEntities(text){
  const tokens = [];
  const re = /(^|[.!?]\s+|\s)([A-ZÉÈÊÀÂÎÔÛÄËÏÖÜ][a-zA-ZÉÈÊÀÂÎÔÛÄËÏÖÜàâçéèêëîïôöùûüÿœ'-]{2,})/g;
  let m; while((m=re.exec(text))){
    const word = m[2];
    if(!/^Je$|^Il$|^Et$|^Mais$|^Or$|^Car$/.test(word)) tokens.push(word);
  }
  const counts = tokens.reduce((acc,w)=> (acc[w]=(acc[w]||0)+1, acc), {});
  return Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([w])=>w);
}

function bullets(arr){ return arr.filter(Boolean).map(s=>`- ${s}`).join("\n"); }

// ---------- API locale (28 titres) ----------
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

// ---------- api.bible (double stratégie : passages -> chapters) ----------
async function fetchDarbyText(osisId){
  if(!API_KEY || !BIBLE_ID) throw new Error("Config API_BIBLE_KEY / BIBLE_ID_DARBY manquante.");
  // 1) passages (content-type=text)
  const url1 = `${API_BASE}/bibles/${encodeURIComponent(BIBLE_ID)}/passages/${encodeURIComponent(osisId)}?content-type=text&include-chapter-numbers=false&include-verse-numbers=true`;
  let r = await fetchFn(url1, { headers:{ "accept":"application/json", "api-key":API_KEY }});
  let data = r.ok ? await r.json() : null;
  let raw = data?.data?.content || (Array.isArray(data?.data?.passages) && data.data.passages[0]?.content) || "";
  // 2) chapters (plaintext) si vide
  if(!raw || !String(raw).trim()){
    const url2 = `${API_BASE}/bibles/${encodeURIComponent(BIBLE_ID)}/chapters/${encodeURIComponent(osisId)}?content-type=plaintext&include-chapter-numbers=false&include-verse-numbers=true`;
    r = await fetchFn(url2, { headers:{ "accept":"application/json", "api-key":API_KEY }});
    data = r.ok ? await r.json() : null;
    raw = data?.data?.content || "";
  }
  return String(raw).replace(/<[^>]+>/g," ").replace(/\u00A0/g," ").replace(/\s+\n/g,"\n").replace(/\s+/g," ").trim();
}

async function fetchPrevChapterText(bookFr, chapterNum){
  const osisBook = FR_TO_OSIS[bookFr];
  if(!osisBook) return "";
  const prev = Math.max(1, Number(chapterNum)-1);
  if(prev === Number(chapterNum)) return "";
  const osisId = `${osisBook}.${prev}`;
  try{ return await fetchDarbyText(osisId); }catch{ return ""; }
}

// ---------- Construction des rubriques ----------
function buildSections(book, chapter, points, textCurr, textPrev){
  const ref = `${book} ${chapter}`;
  const verses = splitVerses(textCurr);
  const full   = verses.map(v=>`${v.n}. ${v.text}`).join(" ");
  const kws    = keywordStats(full, 14);
  const keyV   = chooseKeyVerse(verses, kws);
  const testament = OT.has(book) ? "Ancien Testament" : "Nouveau Testament";
  const meta = BOOK_META[book] || { genre:"", auteur:"", date:"", ouverture:"" };

  const headerOnce =
`<strong>Référence :</strong> ${ref}
<strong>Mots-clés :</strong> ${kws.length ? kws.map(k=>k.word).join(", ") : "(—)"}
<strong>Verset-clé suggéré :</strong> v.${keyV.n} — "${keyV.text.trim()}"`;

  function answersForPrev(){
    if(Number(chapter) === 1){
      const ctx = [
        meta.genre && `Genre : ${meta.genre}`,
        meta.auteur && `Auteur (trad.) : ${meta.auteur}`,
        meta.date && `Datation : ${meta.date}`,
        meta.ouverture && `Ouverture : ${meta.ouverture}`
      ].filter(Boolean).join(" — ");
      return [
        `<strong>Contexte menant à ${ref} :</strong> ${ctx || "Ouverture du livre : cadre théologique initial."}`,
        `<strong>Personnages/Lieux :</strong> au seuil du livre, les protagonistes émergent ; peu ou pas de lieux encore définis.`,
        `<strong>Dieu révélé :</strong> Dieu se présente comme sujet souverain de l’histoire du salut.`,
        `<strong>Tensions :</strong> questions fondatrices (origine, alliance, sainteté, promesse…).`,
        `<strong>Attentes :</strong> découvrir l’œuvre de Dieu au fil des chapitres et la réponse de l’homme (foi/obéissance).`
      ];
    }
    const prev = String(textPrev||"").trim();
    if(!prev){
      return [
        `<strong>Contexte menant à ${ref} :</strong> le chapitre précédent n’a pas été chargé.`,
        `<strong>Personnages/Lieux :</strong> —`,
        `<strong>Dieu révélé :</strong> —`,
        `<strong>Tensions :</strong> —`,
        `<strong>Attentes :</strong> réessaie plus tard pour une analyse précise.`
      ];
    }
    const pvVerses = splitVerses(prev);
    const pvFull   = pvVerses.map(v=>v.text).join(" ");
    const ents     = extractEntities(pvFull).join(", ") || "—";
    const teaser   = pvVerses.slice(0,3).map(v=>`v.${v.n} ${v.text}`).join(" ").slice(0,240)+(pvVerses.length>3?"…":"");
    const godSnip  = pvVerses.map(v=>v.text).filter(t=>/Dieu|Éternel|Seigneur/i.test(t)).slice(0,2)
                      .map(t=>`« ${t.slice(0,140).trim()}${t.length>140?"…":""} »`).join(" / ");
    const tense    = /peche|colere|conflit|famine|esclavage|ennemi|jugement|crainte|plainte|oppression/i.test(normalize(pvFull))
                      ? "Des tensions apparaissent (péché/épreuve/conflit) et appellent une intervention divine."
                      : "Peu de tension explicite ; le récit prépare le développement suivant.";
    return [
      `<strong>Contexte menant à ${ref} :</strong> ${teaser || "—"}`,
      `<strong>Personnages/Lieux (détectés) :</strong> ${ents}`,
      `<strong>Dieu révélé :</strong> ${godSnip || "Dieu est à l’œuvre en arrière-plan."}`,
      `<strong>Tensions :</strong> ${tense}`,
      `<strong>Attentes :</strong> voir comment ${ref} répond à ces éléments et fait avancer le récit.`
    ];
  }

  const sections = [];

  // 1
  sections.push({
    n:1, title: points[0]?.title || "Prière d’ouverture",
    content: `Seigneur, ouvre nos yeux et nos coeurs pour comprendre ta Parole en <strong>${ref}</strong>. Donne-nous d’accueillir et pratiquer ta vérité. Amen.\n\n${headerOnce}`
  });
  // 2
  sections.push({
    n:2, title: points[1]?.title || "Canon et testament",
    content: `<strong>Livre :</strong> ${book} — <strong>${testament}</strong>\n<strong>Genre :</strong> ${meta.genre || "—"}\n<strong>Auteur (tradition) :</strong> ${meta.auteur || "—"}\n<strong>Datation :</strong> ${meta.date || "—"}`
  });
  // 3
  sections.push({
    n:3, title: points[2]?.title || "Questions du chapitre précédent",
    content: answersForPrev().map(s=>`- ${s}`).join("\n")
  });
  // 4
  const titleProp = kws[0]?.word ? `${book} ${chapter} — ${kws[0].word.replace(/^./,c=>c.toUpperCase())}` : `${book} ${chapter} — Aperçu doctrinal`;
  sections.push({
    n:4, title: points[3]?.title || "Titre du chapitre",
    content: `<strong>Proposition de titre :</strong> <em>${titleProp}</em>`
  });
  // 5
  sections.push({
    n:5, title: points[4]?.title || "Contexte historique",
    content: bullets([
      meta.auteur ? `Auteur (tradition) : ${meta.auteur}` : "Auteur : —",
      meta.date ? `Période : ${meta.date}` : "Période : —",
      "Situation du peuple / contexte géopolitique : à préciser.",
      "Lieux / cartes : localiser si pertinent."
    ])
  });
  // 6 structure
  const lastNum = verses[verses.length-1]?.n || verses.length || 1;
  const a = Math.max(1, Math.floor(lastNum*0.33));
  const b = Math.max(a+1, Math.floor(lastNum*0.66));
  sections.push({ n:6, title: points[5]?.title || "Structure littéraire",
    content: bullets([`v.1–${a} : ouverture/situation`,`v.${a+1}–${b} : développement/tension`,`v.${b+1}–${lastNum} : résolution/transition`]) });
  // 7 genre
  sections.push({ n:7, title: points[6]?.title || "Genre littéraire",
    content: `<strong>Genre principal :</strong> ${meta.genre || "—"}\n` + bullets([
      "Repérer connecteurs et répétitions.",
      "Prendre en compte les figures si poésie/prophétie.",
      "Comparer avec d’autres passages du même genre."
    ])});
  // 8 auteur
  sections.push({ n:8, title: points[7]?.title || "Auteur et généalogie",
    content: `<strong>Auteur (tradition) :</strong> ${meta.auteur || "—"}\n<strong>Généalogie / liaisons :</strong> relier aux patriarches, tribus, alliances (à compléter).`});
  // 9 verset-clé
  sections.push({ n:9, title: points[8]?.title || "Verset-clé doctrinal",
    content: `<strong>Verset-clé :</strong> v.${keyV.n} — ${keyV.text.trim()}`});
  // 10 exégèse
  sections.push({ n:10, title: points[9]?.title || "Analyse exégétique",
    content: bullets([
      "Observer connecteurs (car, afin que, donc…).",
      "Repérer temps verbaux et voix (actif/passif).",
      "Identifier répétitions et inclusions.",
      "Noter changement de locuteur/sujet."
    ])});
  // 11 lexique
  sections.push({ n:11, title: points[10]?.title || "Analyse lexicale",
    content: `<strong>Mots récurrents :</strong> ${kws.length ? kws.map(k=>`${k.word} (${k.count})`).join(", ") : "—"}\nCompléter par une étude hébreu/grec sur 3–5 termes.`});
  // 12 refs croisées (thème simple)
  function guessTheme(kwsArr){
    const k=new Set(kwsArr.map(x=>x.word)); const hit=a=>a.some(w=>k.has(w));
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
  const theme = guessTheme(kws);
  const xrefs = crossRefs(theme);
  sections.push({ n:12, title: points[11]?.title || "Références croisées", content: xrefs.join(" ; ") });
  // 13-28 applications & suites
  sections.push({ n:13, title: points[12]?.title || "Fondements théologiques",
    content: bullets([theme,"Souveraineté et fidélité de Dieu.","Révélation progressive (AT/NT).","Christ au centre du dessein de Dieu."])});
  sections.push({ n:14, title: points[13]?.title || "Thème doctrinal", content: `<strong>Thème proposé :</strong> ${theme}`});
  sections.push({ n:15, title: points[14]?.title || "Fruits spirituels", content: bullets(["foi","obéissance","amour","espérance","sainteté"])});
  sections.push({ n:16, title: points[15]?.title || "Types bibliques", content: bullets([
    "Repérer symboles/figures (eau, désert, agneau, roi…).","Chercher accomplissements en Christ.","Vérifier par d’autres textes."
  ])});
  sections.push({ n:17, title: points[16]?.title || "Appui doctrinal", content: `Autres textes d’appui : ${xrefs.join(" ; ")}`});
  sections.push({ n:18, title: points[17]?.title || "Comparaison entre versets",
    content: `Comparer les mouvements (v.1–${a}, v.${a+1}–${b}, v.${b+1}–${lastNum}) :\n- Progrès narratif / argumentatif\n- Point culminant\n- Connecteurs charnières`});
  sections.push({ n:19, title: points[18]?.title || "Comparaison avec Actes 2",
    content: bullets(["Œuvre de l’Esprit : continuité / nouveauté","Parole proclamée / reçue","Communauté : prière, partage, mission"])});
  sections.push({ n:20, title: points[19]?.title || "Verset à mémoriser", content: `<strong>À mémoriser :</strong> ${ref}, v.${keyV.n}\n> ${keyV.text.trim()}`});
  sections.push({ n:21, title: points[20]?.title || "Enseignement pour l’Église",
    content: bullets(["Ce que l’Église doit croire / vivre ici","Application liturgique / formation / mission","Prière communautaire ciblée"])});
  sections.push({ n:22, title: points[21]?.title || "Enseignement pour la famille",
    content: bullets(["Lire le passage ensemble (3 phrases)","Prier selon le verset-clé","Décider d’un petit acte d’obéissance"])});
  sections.push({ n:23, title: points[22]?.title || "Enfants",
    content: bullets(["Raconter avec images/objets","Une vérité : 1 phrase simple","Un geste / prière"])});
  sections.push({ n:24, title: points[23]?.title || "Mission",
    content: bullets(["Quel besoin local ce texte éclaire ?","Un témoignage (2 min)","Une action cette semaine"])});
  sections.push({ n:25, title: points[24]?.title || "Pastorale",
    content: bullets(["Consolation / exhortation","Sainteté et restauration","Formation de disciples"])});
  sections.push({ n:26, title: points[25]?.title || "Personnel",
    content: bullets(["Ce que Dieu me montre","Ce que je change aujourd’hui","Qui m’accompagne ?"])});
  sections.push({ n:27, title: points[26]?.title || "Versets à retenir",
    content: `3 versets à retenir : v.${keyV.n} + 2 autres choisis dans ${ref}.`});
  sections.push({ n:28, title: points[27]?.title || "Prière de fin",
    content: `Seigneur, merci pour ta Parole en <strong>${ref}</strong>. Scelle-la dans nos vies ; donne-nous de marcher dans l’obéissance et la joie. Amen.`});

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
    const payload = { reference:`${book} ${chapter}`, version:"", sections }; // version vide pour ne rien afficher

    res.setHeader("Content-Type","application/json; charset=utf-8");
    res.setHeader("Cache-Control","private, max-age=60");
    res.status(200).json(payload);

  }catch(err){
    const points = await loadStudyPoints(req);
    const sections = buildSections(book, chapter, points, "", "");
    res.status(200).json({
      reference:`${book} ${chapter}`, version:"", sections,
      warning: err?.message || "Erreur inconnue api.bible"
    });
  }
}
