// /api/chat.js
// API Route (Vercel/Node) — Génère 28 rubriques adaptées (OT/NT + genre) et insère
// des références bibliques cliquables (BibleGateway). Supprime toute trace de
// commentaires d’injection comme <!--#injected-verses:0-->.
//
// POST JSON: { book, chapter, verse?, version?, directives? }

export const config = { runtime: "nodejs" };

const OPENAI_API_KEY =
  process.env.OPENAI_API_KEY ||
  process.env.OPENAI_APIKEY ||
  process.env.OPENAI_KEY;

/* ──────────── Utils ──────────── */

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n || 1));
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "");
const cleanText = (s="") =>
  String(s)
    .replace(/<!--#injected-verses:\d+-->/g, "")     // (7) supprimer les marqueurs fantômes
    .replace(/&nbsp;/g, " ")                          // supprimer les nappes d'espaces
    .replace(/\s{2,}/g, " ")
    .trim();

function refString(book, chapter, verse) {
  const ch = clamp(parseInt(chapter, 10), 1, 150);
  if (verse) return `${cap(book)} ${ch}:${verse}`;
  return `${cap(book)} ${ch}`;
}

function bgwUrl(search, version) {
  const v = encodeURIComponent(version || "LSG");
  const q = encodeURIComponent(search);
  return `https://www.biblegateway.com/passage/?search=${q}&version=${v}`;
}

function makeRefLink(label, version) {
  const url = bgwUrl(label, version);
  // on renvoie du texte HTML simple (le front garde l’auto-link aussi)
  return `<a href="${url}" target="_blank" rel="noopener">${label}</a>`;
}

function joinRefsInline(refs=[], version="LSG") {
  const links = refs.map(r => makeRefLink(r, version));
  return `<span class="refs-inline">${links.join('<span class="sep">·</span>')}</span>`;
}

function withParagraphs(lines=[]) {
  return lines.map(l => `<p>${cleanText(l)}</p>`).join("\n");
}

/* ───────── Canon / Testament / Genre ───────── */

const BOOK_GROUPS = {
  TORAH: ["Genèse","Exode","Lévitique","Nombres","Deutéronome"],
  HIST: ["Josué","Juges","Ruth","1 Samuel","2 Samuel","1 Rois","2 Rois","1 Chroniques","2 Chroniques","Esdras","Néhémie","Esther"],
  POETIC: ["Job","Psaumes","Proverbes","Ecclésiaste","Cantique des cantiques"],
  PROPHETIC: ["Ésaïe","Esaïe","Isaïe","Jérémie","Lamentations","Ézéchiel","Daniel","Osée","Joël","Amos","Abdias","Jonas","Michée","Nahoum","Habacuc","Sophonie","Aggée","Zacharie","Malachie"],
  GOSPELS: ["Matthieu","Marc","Luc","Jean"],
  ACTS: ["Actes"],
  EPISTLES: ["Romains","1 Corinthiens","2 Corinthiens","Galates","Éphésiens","Philippiens","Colossiens","1 Thessaloniciens","2 Thessaloniciens","1 Timothée","2 Timothée","Tite","Philémon","Hébreux","Jacques","1 Pierre","2 Pierre","1 Jean","2 Jean","3 Jean","Jude"],
  APOCALYPSE: ["Apocalypse"]
};
const inGroup = (book, key) => BOOK_GROUPS[key]?.includes(book);

function classifyTestament(book) {
  const AT = [...BOOK_GROUPS.TORAH, ...BOOK_GROUPS.HIST, ...BOOK_GROUPS.POETIC, ...BOOK_GROUPS.PROPHETIC];
  const NT = [...BOOK_GROUPS.GOSPELS, ...BOOK_GROUPS.ACTS, ...BOOK_GROUPS.EPISTLES, ...BOOK_GROUPS.APOCALYPSE];
  if (AT.includes(book)) return "AT";
  if (NT.includes(book)) return "NT";
  return "AT";
}
function classifyGenre(book) {
  if (inGroup(book,"TORAH") || inGroup(book,"HIST") || inGroup(book,"GOSPELS") || inGroup(book,"ACTS")) return "narratif";
  if (inGroup(book,"POETIC")) return "poétique";
  if (inGroup(book,"PROPHETIC") || inGroup(book,"APOCALYPSE")) return "prophétique";
  if (inGroup(book,"EPISTLES")) return "épistolaire";
  return "narratif";
}

/* ───────── Prière d’ouverture (fallback varié) ───────── */

function simpleHash(str){ let h=0; for (let i=0;i<str.length;i++){ h=((h<<5)-h)+str.charCodeAt(i); h|=0;} return Math.abs(h); }
const pick = (arr, seed, salt=0) => arr[(seed + salt) % arr.length];
const shuffleBySeed = (arr, seed, salt=0) => {
  const a = [...arr];
  for (let i=a.length-1;i>0;i--){
    const j = (seed + salt + i*31) % (i+1);
    [a[i],a[j]] = [a[j],a[i]];
  }
  return a;
};
const pickMany = (arr, k, seed, salt=0) => shuffleBySeed(arr, seed, salt).slice(0, Math.max(1, Math.min(k, arr.length)));

function guessMotifs(book, chapter, verse) {
  const b = (book || "").toLowerCase();
  const ch = Number(chapter || 1);
  const v  = verse ? Number(String(verse).split(/[–-]/)[0]) : null;

  if ((b === "genèse" || b === "genese") && ch === 1) {
    if (!v)  return ["création","Parole qui ordonne","lumière et ténèbres","séparations","vie naissante","image de Dieu"];
    if (v === 1)  return ["cieux et terre","commencement","Parole créatrice"];
    if (v === 2)  return ["tohu-bohu","ténèbres","Esprit planant","eaux profondes"];
    if (v <= 5)   return ["Que la lumière soit","séparation lumière/ténèbres","jour et nuit"];
    if (v <= 8)   return ["étendue","séparation des eaux","ciel"];
    if (v <= 13)  return ["réunion des eaux","terre sèche","végétation"];
    if (v <= 19)  return ["astres","signes et saisons","soleil et lune"];
    if (v <= 23)  return ["poissons","oiseaux","bénédiction de fécondité"];
    if (v <= 31)  return ["animaux terrestres","homme et femme","image de Dieu","domination responsable"];
  }

  const testament = classifyTestament(cap(book));
  const genre = classifyGenre(cap(book));
  if (testament === "AT" && genre === "narratif") return ["alliance","appel","épreuves","promesse","fidélité de Dieu"];
  if (genre === "poétique") return ["louange","lamentation","sagesse","métaphores","images fortes"];
  if (genre === "prophétique") return ["oracle","appel à revenir","jugement","espérance","Alliance renouvelée"];
  if (genre === "épistolaire") return ["Évangile","sainteté","charité fraternelle","espérance","vie dans l’Esprit"];
  if (testament === "NT" && genre === "narratif") return ["Royaume","paroles de Jésus","signes","appel à suivre","disciples"];
  return ["Dieu parle","réponse de foi","espérance","sagesse pour vivre"];
}

const INVOCATIONS = {
  AT: ["Dieu de vérité","Seigneur de l’Alliance","Dieu fidèle","Père des lumières","Dieu trois fois saint"],
  NT: ["Père de miséricorde","Dieu de paix","Dieu et Père de notre Seigneur Jésus-Christ","Dieu fidèle","Seigneur de gloire"]
};
const ATTRS = {
  narratif: ["Créateur","Libérateur","Guide du peuple","Dieu qui conduit l’histoire"],
  poétique: ["Berger de nos âmes","Roc et refuge","Dieu compatissant","Source de sagesse"],
  prophétique: ["Saint et Juste","Dieu qui parle par ses prophètes","Juge équitable","Rédempteur"],
  épistolaire: ["Dieu de grâce","Père des miséricordes","Dieu de toute consolation","Seigneur qui sanctifie"]
};
const CONCLUSIONS = [
  "Par Jésus-Christ notre Seigneur, amen.",
  "Dans la paix du Christ, amen.",
  "Nous te prions au nom de Jésus, amen.",
  "Par ton Esprit Saint, amen.",
  "À toi la gloire, maintenant et toujours, amen."
];
const MIDDLES_BY_GENRE = {
  narratif: [
    (m2,m3)=>`Par ta Parole qui éclaire, apprends-nous à discerner ton œuvre au cœur de ${m2}, et à marcher dans tes voies.`,
    (m2,m3)=>`Raconte-nous encore tes œuvres, pour que ${m3} façonne notre confiance et notre obéissance concrète.`,
    (m2,m3)=>`Donne-nous de relire l’histoire à la lumière de ${m2}, pour accueillir ton dessein et y coopérer de tout cœur.`,
    (m2,m3)=>`Que le souvenir de tes actes en ${m3} affermisse notre foi et oriente nos décisions présentes.`
  ],
  poétique: [
    (m2,m3)=>`Ouvre en nous un chant vrai: que ${m2} devienne louange et prière, afin que notre cœur s’accorde à ta sagesse.`,
    (m2,m3)=>`Dissipe nos illusions, affine notre regard, et fais de ${m3} une source de paix et de discernement.`,
    (m2,m3)=>`Apprends-nous à nommer nos joies et nos peines; que ${m2} nous éduque à la confiance et à l’espérance.`,
    (m2,m3)=>`Que le rythme de ta Parole, à travers ${m3}, nous apprenne la droiture, l’humilité et la gratitude.`
  ],
  prophétique: [
    (m2,m3)=>`Fais retentir ton appel: que ${m2} nous conduise à revenir à toi, dans la vérité et la compassion.`,
    (m2,m3)=>`Donne-nous d’accueillir l’avertissement et la promesse: que ${m3} engendre repentance et espérance.`,
    (m2,m3)=>`Brise notre indifférence, délie nos peurs, et fais de ${m2} un chemin de justice et de paix.`,
    (m2,m3)=>`Établis en nous une écoute docile, pour discerner et accomplir ta volonté révélée à travers ${m3}.`
  ],
  épistolaire: [
    (m2,m3)=>`Éclaire notre intelligence de l’Évangile, afin que ${m2} façonne nos pensées, nos paroles et nos actes.`,
    (m2,m3)=>`Affermis l’Église dans la foi et l’amour: que ${m3} devienne règle de vie simple et joyeuse.`,
    (m2,m3)=>`Donne-nous l’unité et la charité fraternelle; que ${m2} nous oriente vers une obéissance concrète.`,
    (m2,m3)=>`Que l’enseignement reçu en ${m3} renouvelle notre manière de vivre, dans la sainteté et la douceur.`
  ]
};

function buildOpeningPrayerFallback(book, chapter, verse, version) {
  const ref = refString(book, chapter, verse);
  const motifs = guessMotifs(book, chapter, verse);
  const seed = simpleHash(`${ref}|${version||"LSG"}|${motifs.join("|")}`);

  const testament = classifyTestament(cap(book));
  const genre = classifyGenre(cap(book));

  const head = pick(INVOCATIONS[testament] || INVOCATIONS.AT, seed);
  const attr = pick(ATTRS[genre] || ATTRS.narratif, seed, 3);
  const end  = pick(CONCLUSIONS, seed, 5);

  const m2 = pickMany(motifs, 2, seed, 7).join(", ");
  const m3 = pickMany(motifs, 3, seed, 11).join(", ");

  const middles = MIDDLES_BY_GENRE[genre] || MIDDLES_BY_GENRE.narratif;
  const midTpl = pick(middles, seed, 13);
  const middle = midTpl(m2, m3);

  return withParagraphs([
    `<strong>${head}</strong>, ${attr}, nous venons à toi devant <strong>${ref}</strong>. ${middle} ${end}`
  ]);
}

/* ───────── Rubrique 3 adaptée ───────── */

function buildRubrique3(blockTitle) {
  // bloc orienté “école théologique”, sans doublons, sans commentaires
  return [
    `<h3>${cleanText(blockTitle)}</h3>`,
    `<p><strong>1) Observation.</strong> Acteurs, lieux, succession d’actions, procédés (répétitions, inclusions, parallélismes). Relever les formes de discours et les verbes principaux.</p>`,
    `<p><strong>2) Compréhension.</strong> Ce que le texte révèle de Dieu (attributs, initiatives) et de l’humain (vocation, limites). Intention du passage.</p>`,
    `<p><strong>3) Interprétation.</strong> Verset-charnière, logique de l’argument/récit, accents théologiques, place dans l’Alliance.</p>`,
    `<p><strong>4) Connexions.</strong> Parallèles/échos pertinents dans le canon pour éclairer l’unité du dessein de Dieu.</p>`,
    `<p><strong>5) Application.</strong> Décision concrète (quoi/quand/comment) cohérente avec l’enseignement reçu; prière-réponse.</p>`
  ].join("\n");
}

/* ───────── Pools dynamiques de références ───────── */

const POOLS = {
  creation: ["Genèse 1:1-5","Psaumes 33:6","Jean 1:1-3","Hébreux 11:3","Colossiens 1:16","Psaumes 104:24"],
  covenant: ["Genèse 12:1-3","Exode 19:4-6","Jérémie 31:31-34","Ézéchiel 36:26-27","Galates 3:8","Luc 22:20"],
  wisdom: ["Proverbes 1:7","Psaumes 1","Ecclésiaste 12:13","Jacques 1:5","Colossiens 3:16"],
  gospel: ["Romains 1:16-17","1 Corinthiens 15:1-4","Jean 3:16","Éphésiens 2:8-10","Tite 3:4-7"],
  spirit: ["Actes 2:1-4","Romains 8:1-11","Galates 5:22-25","Jean 14:26","Éphésiens 5:18"],
  church: ["Actes 2:42-47","Éphésiens 4:11-16","Hébreux 10:24-25","Matthieu 28:18-20","1 Pierre 2:9-10"],
  mission: ["Matthieu 5:13-16","1 Pierre 3:15","Actes 1:8","Romains 10:14-15"],
  holiness: ["1 Pierre 1:15-16","Hébreux 12:14","1 Thessaloniciens 4:3-4","Romains 12:1-2"],
  hope: ["Romains 5:1-5","1 Pierre 1:3-5","Apocalypse 21:1-5","Hébreux 6:19"],
  justice: ["Michée 6:8","Ésaïe 1:17","Amos 5:24","Luc 4:18-19"],
  love: ["1 Corinthiens 13","Jean 13:34-35","Romains 5:8","1 Jean 4:7-12"],
  prayer: ["Psaumes 23","Psaumes 51:10-12","Matthieu 6:9-13","Philippiens 4:6-7"],
  word: ["2 Timothée 3:16-17","Néhémie 8:8","Psaumes 119:105","Jean 17:17"]
};

function refsFromPools(poolNames, k, seed, salt=0) {
  const flat = poolNames.flatMap(name => POOLS[name] || []);
  return pickMany(flat, k, seed, salt);
}

// Ancres simples autour du chapitre courant (reste valable même si tous les versets n’existent pas : BibleGateway gère)
function currentAnchors(book, chapter, seed) {
  const B = cap(book);
  const ch = clamp(parseInt(chapter,10), 1, 150);
  const v1 = 1;
  const v2 = (seed % 10) + 3;      // 3..12
  const v3 = ((seed >> 3) % 15) + 8; // 8..22
  return [`${B} ${ch}:${v1}-${v1+4}`, `${B} ${ch}:${v2}`, `${B} ${Math.max(1,ch-1)}:${(seed%7)+1}`];
}

/* ───────── Étude canonique (28 rubriques) — dynamique ───────── */

function canonicalStudy(book, chapter, verse, version) {
  const B = cap(book);
  const ref = refString(book, chapter, verse);
  const testament = classifyTestament(B);
  const genre = classifyGenre(B);
  const seed = simpleHash(`${B}|${chapter}|${verse||""}`);

  const genreLine = {
    narratif: "Genre: narratif (récit théologique qui forme par l’histoire).",
    poétique: "Genre: poétique/sapiential (forme le cœur et le regard).",
    prophétique:"Genre: prophétique (appel, jugement, promesse, espérance).",
    épistolaire:"Genre: épistolaire (enseignement et exhortation pour la vie chrétienne)."
  }[genre];

  // Sélections thématiques variables selon Testament/Genre
  const baseAT = ["creation","covenant","word","wisdom"];
  const baseNT = ["gospel","spirit","church","love","holiness","hope","mission"];
  const poolPack = testament === "AT" ? baseAT : baseNT;

  const anchors = currentAnchors(B, chapter, seed);

  const data = [];
  data.push({ id: 1, title: "Prière d’ouverture", content: "<p>…</p>" }); // remplacée ensuite

  // 2
  data.push({
    id: 2, title: "Canon et testament",
    content: withParagraphs([
      `${B} se situe dans le ${testament === "AT" ? "Premier" : "Nouveau"} Testament. ${genreLine}`,
      `Repères canoniques utiles : ${joinRefsInline(refsFromPools(poolPack, 3, seed, 1), version)}`
    ])
  });

  // 3
  data.push({
    id: 3, title: "Questions du chapitre précédent",
    content: buildRubrique3(`Révision sur ${ref} — 5 questions (${genre})`)
  });

  // 4
  data.push({
    id: 4, title: "Titre du chapitre",
    content: withParagraphs([
      `${ref} — <strong>Orientation de lecture</strong> : ${genre==="poétique"?"sagesse et prière":"axes narratifs/argumentatifs et réponse de foi"}.`,
      `Versets d’appui (${B} ${chapter}) : ${joinRefsInline(anchors.slice(0,2), version)}`
    ])
  });

  // 5
  data.push({
    id: 5, title: "Contexte historique",
    content: withParagraphs([
      `Situer la période, le(s) peuple(s), le cadre géopolitique et cultuel. Clarifier la place du chapitre dans l’histoire du salut.`,
      `Textes de contexte : ${joinRefsInline(testament==="AT" ? refsFromPools(["covenant","creation"], 2, seed, 3) : refsFromPools(["church","mission"], 2, seed, 3), version)}`
    ])
  });

  // 6
  data.push({
    id: 6, title: "Structure littéraire",
    content: withParagraphs([
      genre==="narratif"
        ? "Ouverture → péripéties/actes → résolution/signe."
        : genre==="poétique"
        ? "Parallélismes, images, progression affective et sapientiale."
        : genre==="prophétique"
        ? "Diagnostic → oracle (jugement/promesse) → appel à revenir."
        : "Indicatifs de l’Évangile → impératifs de la vie nouvelle → applications communautaires."
    ])
  });

  // 7
  data.push({ id: 7, title: "Genre littéraire", content: withParagraphs([genreLine]) });

  // 8
  data.push({
    id: 8, title: "Auteur et généalogie",
    content: withParagraphs([
      `Auteur/tradition, destinataires et enracinement canonique.`,
      testament==="AT"
        ? `Lien aux pères et à l’Alliance : ${joinRefsInline(refsFromPools(["covenant"], 2, seed, 5), version)}`
        : `Lien à l’Église apostolique et à la mission : ${joinRefsInline(refsFromPools(["church","mission"], 2, seed, 5), version)}`
    ])
  });

  // 9
  data.push({
    id: 9, title: "Verset-clé doctrinal",
    content: withParagraphs([
      `Choisir un pivot qui condense l’intention du passage (révélation de Dieu / appel à l’homme).`,
      `Deux ancres candidates : ${joinRefsInline(anchors.slice(0,2), version)}`
    ])
  });

  // 10
  data.push({
    id:10, title: "Analyse exégétique",
    content: withParagraphs([
      `Repérer les marqueurs (répétitions, inclusions, refrains), les acteurs et les verbes dominants. Discerner la logique du passage.`,
      `Aides : ${joinRefsInline(refsFromPools(["word"], 2, seed, 7).concat(refsFromPools(["gospel"], 1, seed, 8)), version)}`
    ])
  });

  // 11
  data.push({
    id:11, title: "Analyse lexicale",
    content: withParagraphs([
      `Éclairer 1–2 termes décisifs (justice, alliance, gloire, sagesse, esprit…). Définir brièvement, avec contexte d’usage.`,
      `Voir aussi : ${joinRefsInline(refsFromPools(["wisdom","justice","holiness"], 3, seed, 9), version)}`
    ])
  });

  // 12
  data.push({
    id:12, title: "Références croisées",
    content: withParagraphs([
      `Repérer 2–4 échos AT/NT pour montrer l’unité du dessein de Dieu.`,
      testament==="AT"
        ? `Passerelles vers le NT : ${joinRefsInline(refsFromPools(["gospel","church","spirit"], 3, seed, 11), version)}`
        : `Racines dans l’AT : ${joinRefsInline(refsFromPools(["creation","covenant","wisdom","justice"], 3, seed, 11), version)}`
    ])
  });

  // 13
  data.push({
    id:13, title: "Fondements théologiques",
    content: withParagraphs([
      `Dieu ${testament==="AT"?"crée/élit/appelle/juge/promet":"révèle en Christ/sauve/sanctifie/envoie"} ; l’homme ${testament==="AT"?"répond par l’obéissance de la foi":"marche par l’Esprit, dans la charité"}.`,
      `Ancrages : ${joinRefsInline(testament==="AT" ? refsFromPools(["covenant","justice","hope"], 2, seed, 13) : refsFromPools(["gospel","holiness","hope"], 2, seed, 13), version)}`
    ])
  });

  // 14
  data.push({
    id:14, title: "Thème doctrinal",
    content: withParagraphs([
      genre==="prophétique" ? "Appel à revenir / espérance" :
      genre==="poétique"    ? "Sagesse / louange" :
      genre==="épistolaire" ? "Évangile / sainteté" :
                               "Actes de Dieu et réponse humaine",
      `Textes en appui : ${joinRefsInline(genre==="poétique" ? refsFromPools(["wisdom","prayer"], 2, seed, 15) : refsFromPools(["gospel","holiness","love"], 2, seed, 15), version)}`
    ])
  });

  // 15
  data.push({ id:15, title: "Fruits spirituels", content: withParagraphs([`Gratitude, discernement, persévérance, justice, charité, espérance.`]) });

  // 16
  data.push({ id:16, title: "Types bibliques", content: withParagraphs([`Préfigurations et figures (motifs, lieux, personnes) qui convergent vers le Christ.`]) });

  // 17
  data.push({
    id:17, title: "Appui doctrinal",
    content: withParagraphs([
      testament==="AT"
        ? `Psaumes/Prophètes en renfort : ${joinRefsInline(refsFromPools(["wisdom","justice"], 2, seed, 17), version)}`
        : `Épîtres/Évangiles : ${joinRefsInline(refsFromPools(["word","gospel","holiness"], 2, seed, 17), version)}`
    ])
  });

  // 18
  data.push({ id:18, title: "Comparaison entre versets", content: withParagraphs([`Comparer ouverture / charnière / conclusion pour clarifier la ligne théologique du passage.`, `Ancres : ${joinRefsInline(anchors, version)}`]) });

  // 19
  data.push({
    id:19, title: "Comparaison avec Actes 2",
    content: withParagraphs([
      `Parole – Esprit – Communauté : pertinence pour aujourd’hui.`,
      `Voir : ${joinRefsInline(refsFromPools(["spirit","church"], 2, seed, 19), version)}`
    ])
  });

  // 20
  data.push({
    id:20, title: "Verset à mémoriser",
    content: withParagraphs([
      `Choisir un verset ; rédiger une phrase-mémo et une prière-réponse.`,
      `Aide : ${joinRefsInline(refsFromPools(["word","prayer"], 2, seed, 20), version)}`
    ])
  });

  // 21
  data.push({
    id:21, title: "Enseignement pour l’Église",
    content: withParagraphs([
      `Annonce, édification, discipline, mission : impact communautaire du passage.`,
      `Repères : ${joinRefsInline(refsFromPools(["church","love","holiness"], 2, seed, 21), version)}`
    ])
  });

  // 22
  data.push({
    id:22, title: "Enseignement pour la famille",
    content: withParagraphs([
      `Transmettre : lecture, prière, service, pardon, bénédiction.`,
      `Références : ${joinRefsInline(refsFromPools(["wisdom","prayer","love"], 2, seed, 22), version)}`
    ])
  });

  // 23
  data.push({
    id:23, title: "Enseignement pour enfants",
    content: withParagraphs([
      `Approche simple et visuelle : raconter, prier, mémoriser, agir.`,
      `Aide : ${joinRefsInline(refsFromPools(["prayer","love"], 2, seed, 23), version)}`
    ])
  });

  // 24
  data.push({
    id:24, title: "Application missionnaire",
    content: withParagraphs([
      `Témoignage humble et cohérent ; parole claire ; amour concret.`,
      `Repères : ${joinRefsInline(refsFromPools(["mission","gospel"], 2, seed, 24), version)}`
    ])
  });

  // 25
  data.push({
    id:25, title: "Application pastorale",
    content: withParagraphs([
      `Accompagnement : prière, consolation, conseil, persévérance.`,
      `Textes : ${joinRefsInline(refsFromPools(["holiness","love","hope"], 2, seed, 25), version)}`
    ])
  });

  // 26
  data.push({
    id:26, title: "Application personnelle",
    content: withParagraphs([
      `Nommer 1–2 décisions concrètes (quoi/quand/comment) pour la semaine.`,
      `Aide : ${joinRefsInline(refsFromPools(["wisdom","holiness","prayer"], 2, seed, 26), version)}`
    ])
  });

  // 27
  data.push({
    id:27, title: "Versets à retenir",
    content: withParagraphs([
      `Lister 3–5 versets du chapitre ; noter une clé de compréhension pour chacun.`,
      `Suggestions (chapitre courant + échos) : ${joinRefsInline(pickMany(anchors.concat(refsFromPools(poolPack, 4, seed, 27)), 4, seed, 27), version)}`
    ])
  });

  // 28
  data.push({
    id:28, title: "Prière de fin",
    content: withParagraphs([`Que ta Parole devienne en nous foi, prière et obéissance ; et que notre vie te glorifie. Amen.`])
  });

  // nettoyage final (7) — pas de commentaires d’injection ni nappe d’espaces
  data.forEach(s => { s.content = cleanText(s.content); });
  return data;
}

/* ───────── OpenAI helpers (optionnels) ───────── */

async function callOpenAI({ system, user, model = "gpt-4o-mini", temperature = 0.7, max_tokens = 600 }) {
  const url = "https://api.openai.com/v1/chat/completions";
  const body = { model, messages:[{role:"system",content:system},{role:"user",content:user}], temperature, max_tokens };
  const r = await fetch(url, {
    method:"POST",
    headers:{ "Authorization":`Bearer ${OPENAI_API_KEY}`, "Content-Type":"application/json" },
    body: JSON.stringify(body)
  });
  if (!r.ok) throw new Error(await r.text());
  const j = await r.json();
  return j.choices?.[0]?.message?.content || "";
}

function buildMotifsPrompt(ref, version, custom=""){
  return {
    system: "Tu es un bibliste rigoureux. Réponds uniquement en JSON valide.",
    user: `
Donne 6 à 10 motifs concrets pour ${ref} (${version||"LSG"}).
Format strict:
{"motifs":[...],"attributsDivins":[...]}
${custom ? `Note: ${custom}` : ""}`.trim()
  };
}
const safeParseJSON = (s)=>{ try{ return JSON.parse(s); }catch{ return null; } };

function buildPrayerPrompt(ref, version, motifs, attrs, testament, genre, custom="", seed=0){
  const FORBIDDEN = [
    "nous nous approchons de toi pour méditer",
    "ouvre notre intelligence",
    "purifie nos intentions",
    "fais naître en nous l’amour de ta volonté",
    "Que ta Parole façonne notre pensée, notre prière et nos décisions.",
    "Que ton Esprit ouvre nos yeux, oriente notre volonté et établisse en nous une obéissance joyeuse."
  ];
  return {
    system: "Tu es un bibliste pastoral. HTML autorisé: <p>, <strong>, <em> uniquement.",
    user: `
Écris une Prière d’ouverture spécifique à ${ref} (${version||"LSG"}).
Contraintes:
- Utiliser au moins 2 éléments de: ${JSON.stringify(motifs||[])}
- Nommer Dieu avec un attribut de: ${JSON.stringify(attrs||["Créateur","Libérateur","Juste","Miséricordieux"])}
- Intégrer le contexte: Testament=${testament}, Genre=${genre}.
- 1 paragraphe, 70–120 mots, ton humble et précis au passage.
- Interdictions: ${FORBIDDEN.map(s=>`“${s}”`).join(", ")}.
- Commencer par une invocation + attribut; conclure brièvement (variante “amen”).
Graines: ${seed}.
${custom ? `Directives:\n${custom}` : ""}`.trim()
  };
}

/* ───────── Handler ───────── */

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok:false, error:"Method Not Allowed" });

  try {
    if (req.body && req.body.probe) {
      return res.status(200).json({ ok:true, source:"probe", warn:"" });
    }

    const { book="Genèse", chapter=1, verse="", version="LSG", directives={} } = req.body || {};
    const reference = refString(book, chapter, verse);

    let sections = canonicalStudy(book, chapter, verse, version);
    let source   = "canonical";
    let warn     = "";

    // Prière d’ouverture dynamique (OpenAI si dispo)
    const testament = classifyTestament(cap(book));
    const genre = classifyGenre(cap(book));
    let opening = "";

    if (OPENAI_API_KEY) {
      try {
        const motifsRaw = await callOpenAI({
          ...buildMotifsPrompt(reference, version, directives.priere_ouverture || ""),
          model: "gpt-4o-mini", temperature: 0.2, max_tokens: 250
        });
        const motifsJson = safeParseJSON(motifsRaw) || {};
        const motifs = Array.isArray(motifsJson.motifs) ? motifsJson.motifs.filter(Boolean).slice(0, 8) : [];
        const attrs  = Array.isArray(motifsJson.attributsDivins) ? motifsJson.attributsDivins.filter(Boolean).slice(0, 6) : ["Créateur","Libérateur","Juste","Miséricordieux"];
        const seed = simpleHash(`${reference}|${version}|${motifs.join("|")}|${testament}|${genre}`);

        opening = await callOpenAI({
          ...buildPrayerPrompt(reference, version, motifs, attrs, testament, genre, directives.priere_ouverture || "", seed),
          model: "gpt-4o-mini", temperature: 0.9, max_tokens: 450
        });

        if (!opening || opening.length < 40) {
          opening = buildOpeningPrayerFallback(book, chapter, verse, version);
          warn = "IA: motifs/prière trop courts — fallback varié (OT/NT + genre)";
        } else {
          source = "openai+fallback";
        }
      } catch {
        opening = buildOpeningPrayerFallback(book, chapter, verse, version);
        source  = "canonical";
        warn    = "OpenAI indisponible — fallback varié (OT/NT + genre)";
      }
    } else {
      opening = buildOpeningPrayerFallback(book, chapter, verse, version);
      source  = "canonical";
      warn    = "AI désactivée — fallback varié (OT/NT + genre)";
    }

    if (sections && sections[0]) sections[0].content = cleanText(opening);

    // nettoyage global final
    sections.forEach(s => { s.content = cleanText(s.content); });

    res.status(200).json({
      ok: true,
      source,
      warn,
      data: { reference, version: (version || "LSG"), sections }
    });
  } catch (e) {
    res.status(500).json({ ok:false, error: String(e?.message || e) });
  }
}
