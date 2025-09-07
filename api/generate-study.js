// api/generate-study.js
//
// Génération enrichie des 28 rubriques à partir d’un livre + chapitre.
// - Source texte : api.bible (DARBY)  ✅ pas de LSG
// - Analyse heuristique : découpe versets, mots-clés FR, verset-clé,
//   titre proposé, thème doctrinal probable, applications, etc.
// - Sortie attendue par le front : { reference, version:"DARBY", sections:[{n,title,content}] }
//
// ⚙️ Variables d’environnement (Vercel → Project Settings → Environment Variables)
//   - API_BIBLE_KEY   : votre clé api.bible
//   - BIBLE_ID_DARBY  : ID de la Bible DARBY (ex: "f392f5f5f0b74a1a-01" — à vérifier dans votre compte)
//   - API_BIBLE_BASE  : (optionnel) défaut "https://api.scripture.api.bible/v1"
//
// ✅ La route accepte :
//   - GET  /api/generate-study?book=Exode&chapter=1
//   - HEAD (pour health-check)

const API_KEY  = process.env.API_BIBLE_KEY || process.env.APIBIBLE_KEY || "";
const BIBLE_ID = process.env.BIBLE_ID_DARBY || "YOUR_DARBY_BIBLE_ID";
const API_BASE = process.env.API_BIBLE_BASE || "https://api.scripture.api.bible/v1";

// fetch universel (Vercel Node 18+ a global fetch)
const fetchFn = globalThis.fetch || (await import("node-fetch")).default;

// --- Utilitaires -------------------------------------------------------------

const FR_TO_OSIS = {
  "Genèse":"Gen", "Exode":"Exod", "Lévitique":"Lev", "Nombres":"Num", "Deutéronome":"Deut",
  "Josué":"Josh", "Juges":"Judg", "Ruth":"Ruth",
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
  // (méta minimales ; n’hésite pas à compléter à l’avenir)
  "Genèse":{ genre:"Pentateuque / Narratif", auteur:"Moïse (tradition)", date:"XVe–XIIIe s. av. J.-C." },
  "Exode":{ genre:"Pentateuque / Loi & Narratif", auteur:"Moïse (tradition)", date:"XVe–XIIIe s. av. J.-C." },
  "Lévitique":{ genre:"Pentateuque / Loi", auteur:"Moïse (tradition)", date:"XVe–XIIIe s. av. J.-C." },
  "Nombres":{ genre:"Pentateuque / Narratif", auteur:"Moïse (tradition)", date:"XVe–XIIIe s. av. J.-C." },
  "Deutéronome":{ genre:"Pentateuque / Loi", auteur:"Moïse (tradition)", date:"XVe–XIIIe s. av. J.-C." },
  "Josué":{ genre:"Histoire", auteur:"Tradition attribuée à Josué", date:"XIIIe–XIIe s. av. J.-C." },
  "Juges":{ genre:"Histoire", auteur:"Anonyme (tradit. Samuel)", date:"XIe–Xe s. av. J.-C." },
  "Ruth":{ genre:"Récit", auteur:"Anonyme", date:"Époque des Juges" },
  "1 Samuel":{ genre:"Histoire", auteur:"Anonyme (tradit. Samuel)", date:"Xe s. av. J.-C." },
  "2 Samuel":{ genre:"Histoire", auteur:"Anonyme", date:"Xe s. av. J.-C." },
  "1 Rois":{ genre:"Histoire", auteur:"Anonyme", date:"IXe–VIIIe s. av. J.-C." },
  "2 Rois":{ genre:"Histoire", auteur:"Anonyme", date:"IXe–VIIIe s. av. J.-C." },
  "1 Chroniques":{ genre:"Histoire", auteur:"Anonyme", date:"IVe s. av. J.-C." },
  "2 Chroniques":{ genre:"Histoire", auteur:"Anonyme", date:"IVe s. av. J.-C." },
  "Esdras":{ genre:"Histoire", auteur:"Esdras (tradition)", date:"Ve s. av. J.-C." },
  "Néhémie":{ genre:"Histoire", auteur:"Néhémie (tradition)", date:"Ve s. av. J.-C." },
  "Esther":{ genre:"Récit historique", auteur:"Anonyme", date:"Ve s. av. J.-C." },
  "Job":{ genre:"Poésie / Sagesse", auteur:"Anonyme", date:"Ancien" },
  "Psaumes":{ genre:"Poésie / Prière", auteur:"David et autres", date:"Xe–Ve s. av. J.-C." },
  "Proverbes":{ genre:"Sagesse", auteur:"Salomon et autres", date:"Xe–IXe s. av. J.-C." },
  "Ecclésiaste":{ genre:"Sagesse", auteur:"Tradition : Salomon", date:"Xe–IIIe s. av. J.-C." },
  "Cantique des Cantiques":{ genre:"Poésie", auteur:"Tradition : Salomon", date:"Xe s. av. J.-C." },
  "Ésaïe":{ genre:"Prophète majeur", auteur:"Ésaïe", date:"VIIIe s. av. J.-C." },
  "Jérémie":{ genre:"Prophète majeur", auteur:"Jérémie", date:"VIIe–VIe s. av. J.-C." },
  "Lamentations":{ genre:"Poésie", auteur:"Tradition : Jérémie", date:"VIe s. av. J.-C." },
  "Ézéchiel":{ genre:"Prophète majeur", auteur:"Ézéchiel", date:"VIe s. av. J.-C." },
  "Daniel":{ genre:"Apocalyptique", auteur:"Daniel", date:"VIe–IIe s. av. J.-C." },
  "Osée":{ genre:"Prophète mineur", auteur:"Osée", date:"VIIIe s. av. J.-C." },
  "Joël":{ genre:"Prophète mineur", auteur:"Joël", date:"IXe–Ve s. av. J.-C." },
  "Amos":{ genre:"Prophète mineur", auteur:"Amos", date:"VIIIe s. av. J.-C." },
  "Abdias":{ genre:"Prophète mineur", auteur:"Abdias", date:"VIe s. av. J.-C." },
  "Jonas":{ genre:"Prophète mineur", auteur:"Jonas", date:"VIIIe s. av. J.-C." },
  "Michée":{ genre:"Prophète mineur", auteur:"Michée", date:"VIIIe s. av. J.-C." },
  "Nahum":{ genre:"Prophète mineur", auteur:"Nahum", date:"VIIe s. av. J.-C." },
  "Habacuc":{ genre:"Prophète mineur", auteur:"Habacuc", date:"VIIe s. av. J.-C." },
  "Sophonie":{ genre:"Prophète mineur", auteur:"Sophonie", date:"VIIe s. av. J.-C." },
  "Aggée":{ genre:"Prophète mineur", auteur:"Aggée", date:"VIe s. av. J.-C." },
  "Zacharie":{ genre:"Prophète mineur", auteur:"Zacharie", date:"VIe–Ve s. av. J.-C." },
  "Malachie":{ genre:"Prophète mineur", auteur:"Malachie", date:"Ve s. av. J.-C." },

  "Matthieu":{ genre:"Évangile", auteur:"Matthieu", date:"60–85 ap. J.-C." },
  "Marc":{ genre:"Évangile", auteur:"Marc", date:"50–70 ap. J.-C." },
  "Luc":{ genre:"Évangile", auteur:"Luc", date:"60–90 ap. J.-C." },
  "Jean":{ genre:"Évangile", auteur:"Jean", date:"80–95 ap. J.-C." },
  "Actes":{ genre:"Histoire de l'Église", auteur:"Luc", date:"60–90 ap. J.-C." },
  "Romains":{ genre:"Épître", auteur:"Paul", date:"57 ap. J.-C." },
  "1 Corinthiens":{ genre:"Épître", auteur:"Paul", date:"55 ap. J.-C." },
  "2 Corinthiens":{ genre:"Épître", auteur:"Paul", date:"56 ap. J.-C." },
  "Galates":{ genre:"Épître", auteur:"Paul", date:"48–55 ap. J.-C." },
  "Éphésiens":{ genre:"Épître", auteur:"Paul", date:"60–62 ap. J.-C." },
  "Philippiens":{ genre:"Épître", auteur:"Paul", date:"60–62 ap. J.-C." },
  "Colossiens":{ genre:"Épître", auteur:"Paul", date:"60–62 ap. J.-C." },
  "1 Thessaloniciens":{ genre:"Épître", auteur:"Paul", date:"50–51 ap. J.-C." },
  "2 Thessaloniciens":{ genre:"Épître", auteur:"Paul", date:"51–52 ap. J.-C." },
  "1 Timothée":{ genre:"Épître pastorale", auteur:"Paul", date:"62–64 ap. J.-C." },
  "2 Timothée":{ genre:"Épître pastorale", auteur:"Paul", date:"64–67 ap. J.-C." },
  "Tite":{ genre:"Épître pastorale", auteur:"Paul", date:"62–66 ap. J.-C." },
  "Philémon":{ genre:"Épître", auteur:"Paul", date:"60–62 ap. J.-C." },
  "Hébreux":{ genre:"Homélie/Épître", auteur:"Anonyme", date:"60–90 ap. J.-C." },
  "Jacques":{ genre:"Épître", auteur:"Jacques", date:"44–62 ap. J.-C." },
  "1 Pierre":{ genre:"Épître", auteur:"Pierre", date:"62–64 ap. J.-C." },
  "2 Pierre":{ genre:"Épître", auteur:"Pierre", date:"64–68 ap. J.-C." },
  "1 Jean":{ genre:"Épître", auteur:"Jean", date:"85–95 ap. J.-C." },
  "2 Jean":{ genre:"Épître", auteur:"Jean", date:"85–95 ap. J.-C." },
  "3 Jean":{ genre:"Épître", auteur:"Jean", date:"85–95 ap. J.-C." },
  "Jude":{ genre:"Épître", auteur:"Jude", date:"65–80 ap. J.-C." },
  "Apocalypse":{ genre:"Apocalyptique", auteur:"Jean", date:"95 ap. J.-C." }
};

const STOPWORDS_FR = new Set(`
a ai afin ainsi alors apres assez au aux avec avait avant bien car ce cela ces chez comme comment dans de des du donc elle elles en encore est et etc etre eux fait fois font hors il ils je la le les leur lui mais malgré me meme memes mes mon ne ni nos notre nous on or ou où par parce parmi pas pendant peut plus pour pourquoi pourtant pres puisque quand que quel quelle quelles quels qui quoi sans sauf selon si sinon soit son sont sous sur ta te tes toi ton toujours tous tout tres tu un une vers via voici voila vos votre vous
sa ses leurs leurs-là cet cette ceux celles chacun chacune chaque dont lesquels lesquelles auquel auxquels auxquelles duquel desquels desquelles tandis tandisque quoique lorsque lorsqu' jusque jusque-là deja déjà tres très aujourdhui aujourd'hui meme même
`.split(/\s+/).filter(Boolean));

function normalize(s){
  return s
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g,"") // accents
    .replace(/[^a-z0-9\s'-]/g," ")
    .replace(/\s+/g," ")
    .trim();
}

function keywordStats(text, topN=12){
  const words = normalize(text).split(" ").filter(w => w && !STOPWORDS_FR.has(w) && !/^\d+$/.test(w));
  const freq = new Map();
  for(const w of words){ freq.set(w, (freq.get(w)||0)+1); }
  return [...freq.entries()].sort((a,b)=>b[1]-a[1]).slice(0, topN).map(([w,c])=>({word:w, count:c}));
}

function splitVerses(raw){
  const t = String(raw).replace(/\s+/g," ").trim();
  const verses=[];
  const re = /(?:^|\s)(\d{1,3})\s(.*?)(?=\s\d{1,3}\s|$)/gs;
  let m;
  while((m = re.exec(t))){
    const n = parseInt(m[1],10);
    const v = (m[2]||"").trim();
    if(!Number.isNaN(n) && v) verses.push({ n, text: v });
  }
  if(verses.length===0){
    // fallback: tout le chapitre comme v1
    verses.push({ n:1, text: t });
  }
  return verses;
}

function chooseKeyVerse(verses, kws){
  // score = nb de mots-clés présents
  const keyset = new Set(kws.map(k=>k.word));
  let best = verses[0], bestScore=-1;
  for(const v of verses){
    const tokens = normalize(v.text).split(" ");
    let s=0;
    for(const tok of tokens){ if(keyset.has(tok)) s++; }
    if(s>bestScore){ bestScore=s; best=v; }
  }
  return best || verses[0];
}

function guessDoctrinalTheme(kws){
  const k = new Set(kws.map(x=>x.word));
  const hit = (arr)=>arr.some(w=>k.has(w));
  if(hit(["foi","croire","grace","justification","evangile"])) return "Salut par la grâce et la foi";
  if(hit(["loi","commandement","saintete","peche","repentance"])) return "Sainteté, loi et repentance";
  if(hit(["esprit","saint","esprit-saint","puissance","don"])) return "Oeuvre du Saint-Esprit";
  if(hit(["amour","charite","frere","epouse","eglise"])) return "Amour et vie de l’Église";
  if(hit(["sacrifice","agneau","sang","autel","sacrificateur","souverain"])) return "Rédemption et sacrifice";
  if(hit(["roi","royaume","justice","jugement","jour"])) return "Royaume et jugement de Dieu";
  if(hit(["pri","priere"])) return "Prière et dépendance";
  return "Dieu à l’œuvre dans l’histoire du salut";
}

function crossRefsFromTheme(theme){
  // quelques renvois standards selon le thème
  if(/Salut/.test(theme)) return ["Jean 3:16","Éphésiens 2:8-10","Romains 10:9-10"];
  if(/Saintet|repentance|Loi/i.test(theme)) return ["Psaume 51","1 Pierre 1:15-16","Romains 3"];
  if(/Esprit/.test(theme)) return ["Actes 2","Galates 5:16-25","Romains 8"];
  if(/Amour/.test(theme)) return ["1 Corinthiens 13","1 Jean 4:7-12","Jean 13:34-35"];
  if(/Redemption|sacrifice/i.test(theme)) return ["Hébreux 9","Ésaïe 53","Jean 1:29"];
  if(/Royaume|jugement/i.test(theme)) return ["Matthieu 5-7","Apocalypse 20","Michée 6:8"];
  if(/Priere/i.test(theme)) return ["Matthieu 6:5-13","Psaume 34","Philippiens 4:6-7"];
  return ["Psaume 119","2 Timothée 3:16-17"];
}

function segmentStructure(verses){
  // Découpage simple en 3-4 blocs équilibrés pour une "structure littéraire"
  const n = verses.length;
  if(n<=4) return [`v.1–${n}: unité du passage`];
  const p1 = Math.max(1, Math.floor(n*0.33));
  const p2 = Math.max(p1+1, Math.floor(n*0.66));
  return [
    `v.1–${p1} : ouverture/situation`,
    `v.${p1+1}–${p2} : développement/tension`,
    `v.${p2+1}–${n} : résolution/transition`
  ];
}

function makeTitleSuggestion(book, chapter, kws){
  const top = (kws[0]?.word || "").replace(/^./, c=>c.toUpperCase());
  return top ? `${book} ${chapter} — ${top} devant Dieu` : `${book} ${chapter} — Aperçu doctrinal`;
}

function bullets(arr){ return arr.map(s=>`- ${s}`).join("\n"); }

// Récupère les 28 titres/hints depuis l’API locale
async function loadStudyPoints(req) {
  const proto = req.headers["x-forwarded-proto"] || "https";
  const host  = req.headers.host;
  try {
    const r = await fetchFn(`${proto}://${host}/api/study-28`);
    if(!r.ok) throw new Error("HTTP "+r.status);
    const j = await r.json();
    if(Array.isArray(j)&&j.length) return j;
  } catch {}
  return Array.from({length:28},(_,i)=>({title:`Point ${i+1}`, hint:""}));
}

// Appel api.bible DARBY
async function fetchDarbyChapter(bookFr, chapter) {
  if(!API_KEY || !BIBLE_ID) throw new Error("Config API_BIBLE_KEY ou BIBLE_ID_DARBY manquante.");
  const osis = FR_TO_OSIS[bookFr];
  if(!osis) throw new Error(`Livre inconnu: ${bookFr}`);
  const passageId = `${osis}.${chapter}`;
  const url = `${API_BASE}/bibles/${encodeURIComponent(BIBLE_ID)}/passages/${encodeURIComponent(passageId)}?content-type=text&include-chapter-numbers=false&include-verse-numbers=true&include-verse-spans=false&use-org-id=false`;
  const r = await fetchFn(url, { headers:{ "accept":"application/json","api-key":API_KEY }});
  if(!r.ok){
    const t = await r.text().catch(()=> "");
    throw new Error(`api.bible ${r.status} ${r.statusText}: ${t.slice(0,120)}`);
  }
  const data = await r.json();
  const d = data?.data || data?.result || data;
  const content = (d?.content) || (Array.isArray(d?.passages) && d.passages[0]?.content) || "";
  const text = String(content).replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim();
  return { text, passageId };
}

// Construit les 28 sections "riches"
function buildSections(book, chapter, points, rawText){
  const verses = splitVerses(rawText);
  const full   = verses.map(v=>`${v.n}. ${v.text}`).join(" ");
  const kws    = keywordStats(full, 14);
  const keyV   = chooseKeyVerse(verses, kws);
  const theme  = guessDoctrinalTheme(kws);
  const refs   = crossRefsFromTheme(theme);
  const struct = segmentStructure(verses);

  const meta = BOOK_META[book] || { genre:"", auteur:"", date:"" };
  const testament = OT.has(book) ? "Ancien Testament" : "Nouveau Testament";
  const refLabel = `${book} ${chapter}`;

  // util: quelques blocs prêts
  const introTxt =
`*Texte source* : **${refLabel} — DARBY**  
*Mots-clés* : ${kws.map(k=>k.word).join(", ") || "(—)"}  
*Verset-clé* : v.${keyV.n} — "${keyV.text.trim()}"`;

  const doctrineTxt =
`Thème doctrinal probable : **${theme}**.  
Références croisées : ${refs.join(" ; ")}.`;

  const structureTxt = bullets(struct);

  // Génère 28 contenus selon les titres fournis
  const sections = points.map((p, i) => {
    const n = i+1;
    const title = p.title || `Point ${n}`;
    let content = "";

    switch(n){
      case 1: // Prière d’ouverture
        content =
`Seigneur, nous te prions d’ouvrir nos yeux et nos coeurs pour comprendre **${refLabel}** (DARBY).  
Donne-nous l’humilité d’écouter, la joie d’obéir et la sagesse de mettre en pratique. Amen.

${introTxt}`;
        break;

      case 2: // Canon et testament
        content =
`**Livre :** ${book} — **${testament}**  
**Genre :** ${meta.genre || "—"}  
**Auteur (tradition) :** ${meta.auteur || "—"}  
**Datation :** ${meta.date || "—"}

${introTxt}`;
        break;

      case 3: // Questions du chapitre précédent
        content =
bullets([
  `Que retient-on du contexte menant à **${refLabel}** ?`,
  `Quels personnages/lieux reviennent et pourquoi ?`,
  `Qu’a révélé le passage précédent sur Dieu ?`,
  `Quelles tensions restent en suspens ?`,
  `Quelles attentes crée la fin du chapitre précédent ?`
]) + `

${introTxt}`;
        break;

      case 4: // Titre du chapitre
        content = `**Proposition de titre :** _${makeTitleSuggestion(book, chapter, kws)}_\n\n${introTxt}`;
        break;

      case 5: // Contexte historique
        content =
`**Repères historiques :**  
${bullets([
  meta.auteur ? `Auteur (tradition) : ${meta.auteur}` : "Auteur : —",
  meta.date ? `Période : ${meta.date}` : "Période : —",
  "Situation du peuple : à situer précisément selon le livre.",
  "Carte / lieux : à préciser (ville, région, routes, royaumes)."
])}

${introTxt}`;
        break;

      case 6: // Structure littéraire
        content = `**Structure proposée :**\n${structureTxt}\n\n${introTxt}`;
        break;

      case 7: // Genre littéraire
        content = `**Genre principal :** ${meta.genre || "—"}\n\n**Effets du genre sur l’interprétation :**\n${bullets([
          "Repérer les marqueurs (récit, loi, poésie, prophétie, épître…).",
          "Adapter l’attente herméneutique (littéral/poétique/symbolique).",
          "Comparer avec des passages du même genre."
        ])}\n\n${introTxt}`;
        break;

      case 8: // Auteur et généalogie
        content = `**Auteur (tradition) :** ${meta.auteur || "—"}\n**Généalogie/liaisons :** à compléter (lignées, tribus, alliances).\n\n${introTxt}`;
        break;

      case 9: // Verset-clé doctrinal
        content = `**Verset-clé : v.${keyV.n}** — ${keyV.text.trim()}\n\n${doctrineTxt}\n\n${introTxt}`;
        break;

      case 10: // Analyse exégétique
        content =
`**Observations exégétiques (bref) :**  
${bullets([
  "Repérer les connecteurs (car, afin que, donc…).",
  "Observer les temps verbaux et les répétitions.",
  "Identifier sujet/verbe/compléments et changements d’énonciateur.",
  "Noter parallèle, chiasme, inclusions s’il y en a."
])}\n\n${introTxt}`;
        break;

      case 11: // Analyse lexicale
        content =
`**Mots récurrents :** ${kws.map(k=>`${k.word} (${k.count})`).join(", ") || "—"}  
**À creuser (hébreu/grec) :** choisir 3–5 termes marquants et vérifier leur champ sémantique.\n\n${introTxt}`;
        break;

      case 12: // Références croisées
        content = `**Passages parallèles/soutiens :** ${refs.join(" ; ")}\n\n${introTxt}`;
        break;

      case 13: // Fondements théologiques
        content = `**Lignes doctrinales :**\n${bullets([
          theme,
          "Souveraineté et fidélité de Dieu.",
          "Révélation progressive (Ancien/Nouveau Testament).",
          "Christ au centre du salut."
        ])}\n\n${introTxt}`;
        break;

      case 14: // Thème doctrinal
        content = `**Thème doctrinal dominant (proposé) :** ${theme}\n\n${introTxt}`;
        break;

      case 15: // Fruits spirituels
        content = `**Fruits visés :** ${bullets(["foi","obéissance","amour","espérance","sainteté"])}\n\n${introTxt}`;
        break;

      case 16: // Types bibliques
        content =
`**Typologie (à vérifier) :**  
- Repérer symboles, figures (eau, désert, roi, agneau…).  
- Voir accomplissements en Christ ou dans l’Église.\n\n${introTxt}`;
        break;

      case 17: // Appui doctrinal
        content = `**Autres textes d’appui :** ${refs.join(" ; ")}\n\n${introTxt}`;
        break;

      case 18: // Comparaison entre versets
        content =
`Comparer les sections mises en évidence par la structure (ex. ${struct.join(" | ")}) :  
- Que renforce chaque mouvement ?  
- Où se situe le point culminant ?\n\n${introTxt}`;
        break;

      case 19: // Comparaison avec Actes 2
        content =
`**Lien avec Actes 2 :**  
- Œuvre de l’Esprit : continuité/discontinuité.  
- Peuple de Dieu : rassemblement, mission, sainteté.  
- Parole : annonce, repentance, baptême.\n\n${introTxt}`;
        break;

      case 20: // Verset à mémoriser
        content = `**À mémoriser : ${refLabel}, v.${keyV.n}**\n> ${keyV.text.trim()}\n\n${introTxt}`;
        break;

      case 21: // Enseignement Église
        content = `**Pour l’Église :**\n${bullets([
          "Discerner l’appel collectif du passage.",
          "Mettre en place une réponse communautaire concrète.",
          "Prière et soutien mutuel."
        ])}\n\n${introTxt}`;
        break;

      case 22: // Enseignement famille
        content = `**Pour la famille :**\n${bullets([
          "Lire le passage ensemble ; résumer en 3 phrases.",
          "Prier selon le verset-clé.",
          "Décider d’un petit acte d’obéissance."
        ])}\n\n${introTxt}`;
        break;

      case 23: // Enfants
        content = `**Pour enfants :**\n${bullets([
          "Raconter le passage avec images/objets.",
          "Une vérité : 1 phrase simple.",
          "Un geste/prière court."
        ])}\n\n${introTxt}`;
        break;

      case 24: // Mission
        content = `**Application missionnaire :**\n${bullets([
          "Quel besoin de la ville/le voisinage ?",
          "Un témoignage inspiré par le passage.",
          "Une action cette semaine."
        ])}\n\n${introTxt}`;
        break;

      case 25: // Pastorale
        content = `**Application pastorale :**\n${bullets([
          "Accompagnement (consolation, exhortation).",
          "Discipline/sainteté avec douceur et vérité.",
          "Formation de disciples."
        ])}\n\n${introTxt}`;
        break;

      case 26: // Personnel
        content = `**Application personnelle :**\n${bullets([
          "Ce que Dieu me montre.",
          "Ce que je change aujourd’hui.",
          "Qui peut m’accompagner ?"
        ])}\n\n${introTxt}`;
        break;

      case 27: // Versets à retenir (pastorale)
        content = `**3 versets à retenir :** v.${keyV.n} + 2 autres de ton choix.\n\n${introTxt}`;
        break;

      case 28: // Prière de fin
        content =
`Seigneur, merci pour **${refLabel}** (DARBY).  
Scelle ta Parole en nous ; donne-nous de marcher dans l’obéissance et la joie, au nom de Jésus. Amen.

${introTxt}`;
        break;

      default:
        content = `${introTxt}`;
    }

    return { n, title, content };
  });

  return sections;
}

// --- Handler ----------------------------------------------------------------

export default async function handler(req, res){
  if(req.method === "HEAD"){ res.status(200).end(); return; }
  if(req.method !== "GET"){
    res.setHeader("Allow","GET, HEAD");
    res.status(405).json({ error:"Method Not Allowed" });
    return;
  }

  const book    = String(req.query.book || "").trim();
  const chapter = String(req.query.chapter || "").trim();
  if(!book || !chapter){
    res.status(400).json({ error:"Paramètres requis: book, chapter" });
    return;
  }

  try{
    const [points, passage] = await Promise.all([
      loadStudyPoints(req),
      fetchDarbyChapter(book, chapter)
    ]);

    const sections = buildSections(book, chapter, points, passage.text);
    const payload = {
      reference: `${book} ${chapter}`,
      version: "DARBY",
      sections
    };

    res.setHeader("Content-Type","application/json; charset=utf-8");
    res.setHeader("Cache-Control","private, max-age=60");
    res.status(200).json(payload);

  }catch(err){
    // Fournit une sortie exploitable même en échec API
    const points = await loadStudyPoints(req);
    const sections = buildSections(book, chapter, points, "");
    res.status(200).json({
      reference: `${book} ${chapter}`,
      version: "DARBY",
      sections,
      warning: err?.message || "Erreur inconnue"
    });
  }
}
