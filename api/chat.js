// /api/chat.js
// API Route (Vercel/Node) — Génère 28 rubriques adaptées (OT/NT + genre)
// avec références BibleGateway (sans doublon). Supprime toute trace de
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
const cleanText = (s = "") =>
  String(s)
    .replace(/<!--#injected-verses:\d+-->/g, "") // supprime marqueurs fantômes
    .replace(/&nbsp;/g, " ")
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
  return `<a href="${url}" target="_blank" rel="noopener">${label}</a>`;
}

const normRef = (s) => String(s || "").replace(/\s+/g, " ").trim();
function uniqRefs(arr = []) {
  const seen = new Set();
  const out = [];
  for (const r of arr) {
    const k = normRef(r);
    if (k && !seen.has(k)) {
      seen.add(k);
      out.push(k);
    }
  }
  return out;
}
function joinRefsInline(refs = [], version = "LSG") {
  const rs = uniqRefs(refs);
  const links = rs.map((r) => makeRefLink(r, version));
  return `<span class="refs-inline">${links.join('<span class="sep">·</span>')}</span>`;
}
const withParagraphs = (lines = []) =>
  lines.map((l) => `<p>${cleanText(l)}</p>`).join("\n");

/* ───────── Canon / Testament / Genre ───────── */

const BOOK_GROUPS = {
  TORAH: [
    "Genèse",
    "Exode",
    "Lévitique",
    "Nombres",
    "Deutéronome",
  ],
  HIST: [
    "Josué",
    "Juges",
    "Ruth",
    "1 Samuel",
    "2 Samuel",
    "1 Rois",
    "2 Rois",
    "1 Chroniques",
    "2 Chroniques",
    "Esdras",
    "Néhémie",
    "Esther",
  ],
  POETIC: ["Job", "Psaumes", "Proverbes", "Ecclésiaste", "Cantique des cantiques"],
  PROPHETIC: [
    "Ésaïe",
    "Esaïe",
    "Isaïe",
    "Jérémie",
    "Lamentations",
    "Ézéchiel",
    "Daniel",
    "Osée",
    "Joël",
    "Amos",
    "Abdias",
    "Jonas",
    "Michée",
    "Nahoum",
    "Habacuc",
    "Sophonie",
    "Aggée",
    "Zacharie",
    "Malachie",
  ],
  GOSPELS: ["Matthieu", "Marc", "Luc", "Jean"],
  ACTS: ["Actes"],
  EPISTLES: [
    "Romains",
    "1 Corinthiens",
    "2 Corinthiens",
    "Galates",
    "Éphésiens",
    "Philippiens",
    "Colossiens",
    "1 Thessaloniciens",
    "2 Thessaloniciens",
    "1 Timothée",
    "2 Timothée",
    "Tite",
    "Philémon",
    "Hébreux",
    "Jacques",
    "1 Pierre",
    "2 Pierre",
    "1 Jean",
    "2 Jean",
    "3 Jean",
    "Jude",
  ],
  APOCALYPSE: ["Apocalypse"],
};
const inGroup = (book, key) => BOOK_GROUPS[key]?.includes(book);

function classifyTestament(book) {
  const AT = [
    ...BOOK_GROUPS.TORAH,
    ...BOOK_GROUPS.HIST,
    ...BOOK_GROUPS.POETIC,
    ...BOOK_GROUPS.PROPHETIC,
  ];
  const NT = [
    ...BOOK_GROUPS.GOSPELS,
    ...BOOK_GROUPS.ACTS,
    ...BOOK_GROUPS.EPISTLES,
    ...BOOK_GROUPS.APOCALYPSE,
  ];
  if (AT.includes(book)) return "AT";
  if (NT.includes(book)) return "NT";
  return "AT";
}
function classifyGenre(book) {
  if (
    inGroup(book, "TORAH") ||
    inGroup(book, "HIST") ||
    inGroup(book, "GOSPELS") ||
    inGroup(book, "ACTS")
  )
    return "narratif";
  if (inGroup(book, "POETIC")) return "poétique";
  if (inGroup(book, "PROPHETIC") || inGroup(book, "APOCALYPSE")) return "prophétique";
  if (inGroup(book, "EPISTLES")) return "épistolaire";
  return "narratif";
}

/* ───────── Variabilité déterministe (fallback) ───────── */

function simpleHash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}
const pick = (arr, seed, salt = 0) => arr[(seed + salt) % arr.length];
const pickMany = (arr, k, seed, salt = 0) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = (seed + salt + i * 31) % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return uniqRefs(a).slice(0, Math.max(1, Math.min(k, a.length)));
};

/* ───────── Buckets de références (servir d’appui) ───────── */

const REFS = {
  CREATION: [
    "Genèse 1:1-5",
    "Psaumes 33:6",
    "Psaumes 104:24",
    "Jean 1:1-3",
    "Colossiens 1:16",
    "Hébreux 11:3",
  ],
  ALLIANCE: ["Genèse 12:1-3", "Exode 19:4-6", "Jérémie 31:31-34"],
  EVANGILE: ["Romains 1:16-17", "1 Corinthiens 15:1-4", "Jean 3:16", "Éphésiens 2:8-10", "Tite 3:4-7"],
  LECTURE_PAROLE: ["Psaumes 19:8-10", "Psaumes 119:105", "Josué 1:8-9", "2 Timothée 3:16-17"],
  EXEGESE: ["Néhémie 8:8", "Luc 24:27", "2 Timothée 2:15"],
  LEXIQUE: ["Proverbes 1:7", "Michée 6:8", "Jean 1:14", "Romains 3:24-26"],
  THEOLOGIE_AT: ["Deutéronome 6:4-5", "Habacuc 2:4"],
  THEOLOGIE_NT: ["Romains 5:1-5", "Galates 5:22-25"],
  ACTES2: ["Actes 2:1-4", "Actes 2:42-47"],
  EGLISE: ["Éphésiens 4:11-16", "Hébreux 10:24-25", "Jean 17:17"],
  FAMILLE: ["Deutéronome 6:6-7", "Josué 24:15", "Éphésiens 6:4"],
  ENFANTS: ["Marc 10:14-16", "2 Timothée 3:15"],
  MISSION: ["Matthieu 5:13-16", "1 Pierre 3:15", "Actes 1:8"],
  PASTORAL: ["1 Thessaloniciens 5:14", "Galates 6:1-2", "2 Timothée 4:2"],
  MEMO: ["Psaumes 119:11", "Colossiens 3:16"],
};

/* ───────── Prière d’ouverture (fallback varié) ───────── */

function guessMotifs(book, chapter, verse) {
  const b = (book || "").toLowerCase();
  const ch = Number(chapter || 1);
  const v = verse ? Number(String(verse).split(/[–-]/)[0]) : null;

  if ((b === "genèse" || b === "genese") && ch === 1) {
    if (!v) return ["création", "Parole qui ordonne", "lumière et ténèbres", "séparations", "vie naissante", "image de Dieu"];
    if (v === 1) return ["cieux et terre", "commencement", "Parole créatrice"];
    if (v === 2) return ["tohu-bohu", "ténèbres", "Esprit planant", "eaux profondes"];
    if (v <= 5) return ["Que la lumière soit", "séparation lumière/ténèbres", "jour et nuit"];
    if (v <= 8) return ["étendue", "séparation des eaux", "ciel"];
    if (v <= 13) return ["réunion des eaux", "terre sèche", "végétation"];
    if (v <= 19) return ["astres", "signes et saisons", "soleil et lune"];
    if (v <= 23) return ["poissons", "oiseaux", "bénédiction de fécondité"];
    if (v <= 31) return ["animaux terrestres", "homme et femme", "image de Dieu", "domination responsable"];
  }

  const testament = classifyTestament(cap(book));
  const genre = classifyGenre(cap(book));
  if (testament === "AT" && genre === "narratif") return ["alliance", "appel", "épreuves", "promesse", "fidélité de Dieu"];
  if (genre === "poétique") return ["louange", "lamentation", "sagesse", "métaphores", "images fortes"];
  if (genre === "prophétique") return ["oracle", "appel à revenir", "jugement", "espérance", "Alliance renouvelée"];
  if (genre === "épistolaire") return ["Évangile", "sainteté", "charité fraternelle", "espérance", "vie dans l’Esprit"];
  if (testament === "NT" && genre === "narratif") return ["Royaume", "paroles de Jésus", "signes", "appel à suivre", "disciples"];
  return ["Dieu parle", "réponse de foi", "espérance", "sagesse pour vivre"];
}

const INVOCATIONS = {
  AT: ["Dieu de vérité", "Seigneur de l’Alliance", "Dieu fidèle", "Père des lumières", "Dieu trois fois saint"],
  NT: ["Père de miséricorde", "Dieu de paix", "Dieu et Père de notre Seigneur Jésus-Christ", "Dieu fidèle", "Seigneur de gloire"],
};
const ATTRS = {
  narratif: ["Créateur", "Libérateur", "Guide du peuple", "Dieu qui conduit l’histoire"],
  poétique: ["Berger de nos âmes", "Roc et refuge", "Dieu compatissant", "Source de sagesse"],
  prophétique: ["Saint et Juste", "Dieu qui parle par ses prophètes", "Juge équitable", "Rédempteur"],
  épistolaire: ["Dieu de grâce", "Père des miséricordes", "Dieu de toute consolation", "Seigneur qui sanctifie"],
};
const CONCLUSIONS = [
  "Par Jésus-Christ notre Seigneur, amen.",
  "Dans la paix du Christ, amen.",
  "Nous te prions au nom de Jésus, amen.",
  "Par ton Esprit Saint, amen.",
  "À toi la gloire, maintenant et toujours, amen.",
];
const MIDDLES_BY_GENRE = {
  narratif: [
    (m2, m3) =>
      `Par ta Parole qui éclaire, apprends-nous à discerner ton œuvre au cœur de ${m2}, et à marcher dans tes voies.`,
    (m2, m3) =>
      `Raconte-nous encore tes œuvres, pour que ${m3} façonne notre confiance et notre obéissance concrète.`,
    (m2, m3) =>
      `Donne-nous de relire l’histoire à la lumière de ${m2}, pour accueillir ton dessein et y coopérer de tout cœur.`,
    (m2, m3) =>
      `Que le souvenir de tes actes en ${m3} affermisse notre foi et oriente nos décisions présentes.`,
  ],
  poétique: [
    (m2, m3) =>
      `Ouvre en nous un chant vrai: que ${m2} devienne louange et prière, afin que notre cœur s’accorde à ta sagesse.`,
    (m2, m3) =>
      `Dissipe nos illusions, affine notre regard, et fais de ${m3} une source de paix et de discernement.`,
    (m2, m3) =>
      `Apprends-nous à nommer nos joies et nos peines; que ${m2} nous éduque à la confiance et à l’espérance.`,
    (m2, m3) =>
      `Que le rythme de ta Parole, à travers ${m3}, nous apprenne la droiture, l’humilité et la gratitude.`,
  ],
  prophétique: [
    (m2, m3) =>
      `Fais retentir ton appel: que ${m2} nous conduise à revenir à toi, dans la vérité et la compassion.`,
    (m2, m3) =>
      `Donne-nous d’accueillir l’avertissement et la promesse: que ${m3} engendre repentance et espérance.`,
    (m2, m3) =>
      `Brise notre indifférence, délie nos peurs, et fais de ${m2} un chemin de justice et de paix.`,
    (m2, m3) =>
      `Établis en nous une écoute docile, pour discerner et accomplir ta volonté révélée à travers ${m3}.`,
  ],
  épistolaire: [
    (m2, m3) =>
      `Éclaire notre intelligence de l’Évangile, afin que ${m2} façonne nos pensées, nos paroles et nos actes.`,
    (m2, m3) =>
      `Affermis l’Église dans la foi et l’amour: que ${m3} devienne règle de vie simple et joyeuse.`,
    (m2, m3) =>
      `Donne-nous l’unité et la charité fraternelle; que ${m2} nous oriente vers une obéissance concrète.`,
    (m2, m3) =>
      `Que l’enseignement reçu en ${m3} renouvelle notre manière de vivre, dans la sainteté et la douceur.`,
  ],
};

function buildOpeningPrayerFallback(book, chapter, verse, version) {
  const ref = refString(book, chapter, verse);
  const motifs = guessMotifs(book, chapter, verse);
  const seed = simpleHash(`${ref}|${version || "LSG"}|${motifs.join("|")}`);

  const testament = classifyTestament(cap(book));
  const genre = classifyGenre(cap(book));

  const head = pick(INVOCATIONS[testament] || INVOCATIONS.AT, seed);
  const attr = pick(ATTRS[genre] || ATTRS.narratif, seed, 3);
  const end = pick(CONCLUSIONS, seed, 5);

  const m2 = pickMany(motifs, 2, seed, 7).join(", ");
  const m3 = pickMany(motifs, 3, seed, 11).join(", ");

  const middles = MIDDLES_BY_GENRE[genre] || MIDDLES_BY_GENRE.narratif;
  const midTpl = pick(middles, seed, 13);
  const middle = midTpl(m2, m3);

  return withParagraphs([
    `<strong>${head}</strong>, ${attr}, nous venons à toi devant <strong>${ref}</strong>. ${middle} ${end}`,
  ]);
}

/* ───────── Rubrique 3 (titre HTML autorisé) ───────── */

function buildRubrique3(blockTitleHTML) {
  return [
    `<h3>${blockTitleHTML}</h3>`,
    `<p><strong>1) Observation.</strong> Acteurs, lieux, succession d’actions, procédés (répétitions, inclusions, parallélismes). Relever les formes de discours et les verbes principaux.</p>`,
    `<p><strong>2) Compréhension.</strong> Ce que le texte révèle de Dieu (attributs, initiatives) et de l’humain (vocation, limites). Intention du passage.</p>`,
    `<p><strong>3) Interprétation.</strong> Verset-charnière, logique de l’argument/récit, accents théologiques, place dans l’Alliance.</p>`,
    `<p><strong>4) Connexions.</strong> Parallèles/échos pertinents dans le canon pour éclairer l’unité du dessein de Dieu.</p>`,
    `<p><strong>5) Application.</strong> Décision concrète (quoi/quand/comment) cohérente avec l’enseignement reçu; prière-réponse.</p>`,
  ].join("\n");
}

/* ───────── Étude canonique (28 rubriques enrichies) ───────── */

function canonicalStudy(book, chapter, verse, version) {
  const B = cap(book);
  const ref = refString(book, chapter, verse);
  const testament = classifyTestament(B);
  const genre = classifyGenre(B);
  const seed = simpleHash(`${B}|${chapter}|${verse || ""}|${version || "LSG"}`);

  const genreLine = {
    narratif: "Genre: narratif (récit théologique qui forme par l’histoire).",
    poétique: "Genre: poétique/sapiential (forme le cœur et le regard).",
    prophétique: "Genre: prophétique (appel, jugement, promesse, espérance).",
    épistolaire: "Genre: épistolaire (enseignement et exhortation pour la vie chrétienne).",
  }[genre];

  const canonRefs =
    testament === "AT"
      ? uniqRefs([...REFS.CREATION, ...REFS.ALLIANCE])
      : uniqRefs([...REFS.EVANGILE, ...REFS.LECTURE_PAROLE]);

  const ctxRefs =
    testament === "AT"
      ? uniqRefs([...REFS.ALLIANCE, ...pickMany(REFS.CREATION, 2, seed, 1)])
      : uniqRefs([...pickMany(REFS.EVANGILE, 2, seed, 2), "Galates 4:4-5", "Actes 1:8"]);

  const crossAT =
    testament === "AT"
      ? pickMany([...REFS.CREATION, ...REFS.LECTURE_PAROLE], 3, seed, 3)
      : pickMany(["Genèse 12:3", "Psaumes 110:1", "Ésaïe 53"], 3, seed, 4);

  const crossNT =
    testament === "AT"
      ? pickMany(["Jean 1:1-3", "Hébreux 1:1-3", "Galates 3:8"], 3, seed, 5)
      : pickMany([...REFS.EVANGILE, ...REFS.LECTURE_PAROLE], 3, seed, 6);

  const data = [];

  // 1. Prière d’ouverture — sera remplacée plus bas
  data.push({ id: 1, title: "Prière d’ouverture", content: "<p>…</p>" });

  // 2. Canon et testament (référence principale + repères)
  data.push({
    id: 2,
    title: "Canon et testament",
    content: withParagraphs([
      `${B} se situe dans le ${testament === "AT" ? "Premier" : "Nouveau"} Testament. ${genreLine}`,
      `Référence étudiée : ${ref}.`,
      `Repères canoniques utiles : ${joinRefsInline(canonRefs, version)}`,
    ]),
  });

  // 3. Questions du chapitre précédent (titre avec ref cliquable côté front)
  data.push({
    id: 3,
    title: "Questions du chapitre précédent",
    content: buildRubrique3(`Révision sur ${ref} — 5 questions (${genre})`),
  });

  // 4. Titre / Orientation
  data.push({
    id: 4,
    title: "Titre du chapitre",
    content: withParagraphs([
      `${ref} — <strong>Orientation de lecture</strong> : ${
        genre === "poétique"
          ? "sagesse et prière"
          : genre === "épistolaire"
          ? "structure de l’argument et implications de vie"
          : genre === "prophétique"
          ? "diagnostic – oracle – appel"
          : "mouvements du récit et sens théologique"
      }.`,
      `Versets d’appui : ${joinRefsInline(
        testament === "AT" ? ["Psaumes 19:8-10", "Psaumes 119:105"] : ["Luc 24:27", "2 Timothée 3:16-17"],
        version
      )}`,
    ]),
  });

  // 5. Contexte historique
  data.push({
    id: 5,
    title: "Contexte historique",
    content: withParagraphs([
      `Situer ${ref} : période, peuple(s), cadre géopolitique et cultuel; place du chapitre dans l’histoire du salut.`,
      `Textes de contexte : ${joinRefsInline(ctxRefs, version)}`,
    ]),
  });

  // 6. Structure littéraire
  data.push({
    id: 6,
    title: "Structure littéraire",
    content: withParagraphs([
      `Pour ${ref}, repérer l’organisation interne selon le genre.`,
      genre === "narratif"
        ? "Ouverture → péripéties/actes → résolution/signe (repérer charnières)."
        : genre === "poétique"
        ? "Parallélismes, images, progression affective et sapientiale."
        : genre === "prophétique"
        ? "Diagnostic → oracle (jugement/promesse) → appel à revenir."
        : "Indicatifs de l’Évangile → impératifs → applications communautaires.",
    ]),
  });

  // 7. Genre littéraire
  data.push({
    id: 7,
    title: "Genre littéraire",
    content: withParagraphs([`${genreLine} Exemple appliqué à ${ref}.`]),
  });

  // 8. Auteur / tradition / généalogie
  data.push({
    id: 8,
    title: "Auteur et généalogie",
    content: withParagraphs([
      `Auteur/tradition, destinataires, enracinement canonique pour ${ref}.`,
      testament === "AT"
        ? `Lien aux pères et à l’Alliance : ${joinRefsInline(["Genèse 15:6", "Exode 34:6-7", "Psaumes 103:17-18"], version)}`
        : `Lien à l’Église apostolique et à la mission : ${joinRefsInline(["Matthieu 28:18-20", "Actes 2:42-47"], version)}`,
    ]),
  });

  // 9. Verset-clé doctrinal (détermination dans le chapitre)
  data.push({
    id: 9,
    title: "Verset-clé doctrinal",
    content: withParagraphs([
      `Dans ${ref}, choisir un verset pivot (initiative divine, charnière logique, reprise d’un refrain).`,
      `Aides de discernement : ${joinRefsInline(["Psaumes 119:11", "Colossiens 3:16"], version)}`,
    ]),
  });

  // 10. Analyse exégétique
  data.push({
    id: 10,
    title: "Analyse exégétique",
    content: withParagraphs([
      `Repérer marqueurs (répétitions, inclusions, refrains), acteurs et verbes dominants pour ${ref}.`,
      `Aides : ${joinRefsInline(REFS.EXEGESE, version)}`,
    ]),
  });

  // 11. Analyse lexicale
  data.push({
    id: 11,
    title: "Analyse lexicale",
    content: withParagraphs([
      `Éclairer 1–2 termes clés du passage (justice, alliance, gloire, sagesse, esprit…) avec leur usage dans ${ref}.`,
      `Voir aussi : ${joinRefsInline(REFS.LEXIQUE, version)}`,
    ]),
  });

  // 12. Références croisées (AT↔NT selon le cas)
  data.push({
    id: 12,
    title: "Références croisées",
    content: withParagraphs([
      `Mettre ${ref} en résonance dans l’unité du canon.`,
      testament === "AT"
        ? `Vers le NT : ${joinRefsInline(crossNT, version)}`
        : `Racines dans l’AT : ${joinRefsInline(crossAT, version)}`,
    ]),
  });

  // 13. Fondements théologiques
  data.push({
    id: 13,
    title: "Fondements théologiques",
    content: withParagraphs([
      `Dans ${ref}, Dieu ${testament === "AT" ? "crée, élit, appelle, juge, promet" : "révèle en Christ, sauve, sanctifie, envoie"} ; l’homme répond par la foi et l’obéissance.`,
      `Ancrages : ${joinRefsInline(
        testament === "AT" ? REFS.THEOLOGIE_AT : REFS.THEOLOGIE_NT,
        version
      )}`,
    ]),
  });

  // 14. Thème doctrinal
  data.push({
    id: 14,
    title: "Thème doctrinal",
    content: withParagraphs([
      genre === "prophétique"
        ? "Appel à revenir / espérance"
        : genre === "poétique"
        ? "Sagesse / louange"
        : genre === "épistolaire"
        ? "Évangile / sainteté"
        : "Actes de Dieu et réponse humaine",
      `Textes en appui : ${joinRefsInline(
        genre === "poétique" ? ["Psaumes 1", "Psaumes 19:8-10", "Psaumes 119:105"] : ["Romains 12:1-2", "Philippiens 2:12-13"],
        version
      )}`,
    ]),
  });

  // 15. Fruits spirituels
  data.push({
    id: 15,
    title: "Fruits spirituels",
    content: withParagraphs([`Gratitude, discernement, persévérance, justice, charité, espérance appliqués à ${ref}.`]),
  });

  // 16. Types bibliques
  data.push({
    id: 16,
    title: "Types bibliques",
    content: withParagraphs([`Repérer préfigurations (motifs, lieux, personnes) qui convergent vers le Christ, à partir de ${ref}.`]),
  });

  // 17. Appui doctrinal
  data.push({
    id: 17,
    title: "Appui doctrinal",
    content: withParagraphs([
      testament === "AT"
        ? `Psaumes/Prophètes en renfort : ${joinRefsInline(pickMany([...REFS.CREATION, "Ésaïe 40:8", "Ésaïe 55:10-11"], 3, seed, 7), version)}`
        : `Épîtres/Évangiles : ${joinRefsInline(pickMany([...REFS.LECTURE_PAROLE, "Jean 17:17"], 3, seed, 8), version)}`,
    ]),
  });

  // 18. Comparaison entre versets
  data.push({
    id: 18,
    title: "Comparaison entre versets",
    content: withParagraphs([
      `Comparer ouverture / charnière / conclusion dans ${ref} pour clarifier la ligne théologique.`,
    ]),
  });

  // 19. Comparaison avec Actes 2
  data.push({
    id: 19,
    title: "Comparaison avec Actes 2",
    content: withParagraphs([
      `Parole – Esprit – Communauté : pertinence actuelle.`,
      `Repères : ${joinRefsInline(REFS.ACTES2, version)}`,
    ]),
  });

  // 20. Verset à mémoriser
  data.push({
    id: 20,
    title: "Verset à mémoriser",
    content: withParagraphs([
      `Choisir un verset de ${ref}; rédiger une phrase-mémo et une prière-réponse.`,
      `Aide : ${joinRefsInline(REFS.MEMO, version)}`,
    ]),
  });

  // 21. Enseignement pour l’Église
  data.push({
    id: 21,
    title: "Enseignement pour l’Église",
    content: withParagraphs([
      `Impact communautaire de ${ref} : annonce, édification, discipline, mission.`,
      `Repères : ${joinRefsInline(REFS.EGLISE, version)}`,
    ]),
  });

  // 22. Enseignement pour la famille
  data.push({
    id: 22,
    title: "Enseignement pour la famille",
    content: withParagraphs([
      `Transmettre ${ref} dans le foyer : lecture, prière, service, pardon, bénédiction.`,
      `Textes : ${joinRefsInline(REFS.FAMILLE, version)}`,
    ]),
  });

  // 23. Enseignement pour enfants
  data.push({
    id: 23,
    title: "Enseignement pour enfants",
    content: withParagraphs([
      `Raconter ${ref} simplement; prier, mémoriser, agir (jeu, dessin, mime).`,
      `Aide : ${joinRefsInline(REFS.ENFANTS, version)}`,
    ]),
  });

  // 24. Application missionnaire
  data.push({
    id: 24,
    title: "Application missionnaire",
    content: withParagraphs([
      `Témoignage humble et cohérent à partir de ${ref}; parole claire; amour concret.`,
      `Repères : ${joinRefsInline(REFS.MISSION, version)}`,
    ]),
  });

  // 25. Application pastorale
  data.push({
    id: 25,
    title: "Application pastorale",
    content: withParagraphs([
      `Accompagner par ${ref} : prière, consolation, conseil, persévérance.`,
      `Textes : ${joinRefsInline(REFS.PASTORAL, version)}`,
    ]),
  });

  // 26. Application personnelle
  data.push({
    id: 26,
    title: "Application personnelle",
    content: withParagraphs([
      `Nommer 1–2 décisions concrètes (quoi/quand/comment) pour la semaine, enracinées dans ${ref}.`,
      `Aide : ${joinRefsInline(["Jacques 1:22-25", "Psaumes 139:23-24"], version)}`,
    ]),
  });

  // 27. Versets à retenir
  data.push({
    id: 27,
    title: "Versets à retenir",
    content: withParagraphs([
      `Lister 3–5 versets marquants de ${ref}; noter une clé de compréhension pour chacun.`,
      `Suggestions d’appui (hors chapitre) : ${joinRefsInline(
        pickMany(
          testament === "AT"
            ? uniqRefs([...REFS.CREATION, ...REFS.LECTURE_PAROLE])
            : uniqRefs([...REFS.EVANGILE, ...REFS.LECTURE_PAROLE]),
          3,
          seed,
          21
        ),
        version
      )}`,
    ]),
  });

  // 28. Prière de fin
  data.push({
    id: 28,
    title: "Prière de fin",
    content: withParagraphs([
      `Que ta Parole reçue en ${ref} devienne en nous foi, prière et obéissance; et que notre vie te glorifie. Amen.`,
    ]),
  });

  // nettoyage final — pas de commentaires ni nappes d'espaces
  data.forEach((s) => {
    s.content = cleanText(s.content);
  });
  return data;
}

/* ───────── OpenAI helpers (optionnels) ───────── */

async function callOpenAI({ system, user, model = "gpt-4o-mini", temperature = 0.7, max_tokens = 600 }) {
  const url = "https://api.openai.com/v1/chat/completions";
  const body = { model, messages: [{ role: "system", content: system }, { role: "user", content: user }], temperature, max_tokens };
  const r = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(await r.text());
  const j = await r.json();
  return j.choices?.[0]?.message?.content || "";
}

function buildMotifsPrompt(ref, version, custom = "") {
  return {
    system: "Tu es un bibliste rigoureux. Réponds uniquement en JSON valide.",
    user: `
Donne 6 à 10 motifs concrets pour ${ref} (${version || "LSG"}).
Format strict:
{"motifs":[...],"attributsDivins":[...]}
${custom ? `Note: ${custom}` : ""}`.trim(),
  };
}
const safeParseJSON = (s) => {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
};

function buildPrayerPrompt(ref, version, motifs, attrs, testament, genre, custom = "", seed = 0) {
  const FORBIDDEN = [
    "nous nous approchons de toi pour méditer",
    "ouvre notre intelligence",
    "purifie nos intentions",
    "fais naître en nous l’amour de ta volonté",
    "Que ta Parole façonne notre pensée, notre prière et nos décisions.",
    "Que ton Esprit ouvre nos yeux, oriente notre volonté et établisse en nous une obéissance joyeuse.",
  ];
  return {
    system: "Tu es un bibliste pastoral. HTML autorisé: <p>, <strong>, <em> uniquement.",
    user: `
Écris une Prière d’ouverture spécifique à ${ref} (${version || "LSG"}).
Contraintes:
- Utiliser au moins 2 éléments de: ${JSON.stringify(motifs || [])}
- Nommer Dieu avec un attribut de: ${JSON.stringify(attrs || ["Créateur","Libérateur","Juste","Miséricordieux"])}
- Intégrer le contexte: Testament=${testament}, Genre=${genre}.
- 1 paragraphe, 70–120 mots, ton humble et précis au passage.
- Interdictions: ${FORBIDDEN.map((s) => `“${s}”`).join(", ")}.
- Commencer par une invocation + attribut; conclure brièvement (variante “amen”).
Graines: ${seed}.
${custom ? `Directives:\n${custom}` : ""}`.trim(),
  };
}

/* ───────── Handler ───────── */

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method Not Allowed" });

  try {
    if (req.body && req.body.probe) {
      return res.status(200).json({ ok: true, source: "probe", warn: "" });
    }

    const { book = "Genèse", chapter = 1, verse = "", version = "LSG", directives = {} } = req.body || {};
    const reference = refString(book, chapter, verse);

    let sections = canonicalStudy(book, chapter, verse, version);
    let source = "canonical";
    let warn = "";

    // Prière d’ouverture dynamique (OpenAI si dispo)
    const testament = classifyTestament(cap(book));
    const genre = classifyGenre(cap(book));
    let opening = "";

    if (OPENAI_API_KEY) {
      try {
        const motifsRaw = await callOpenAI({
          ...buildMotifsPrompt(reference, version, directives.priere_ouverture || ""),
          model: "gpt-4o-mini",
          temperature: 0.2,
          max_tokens: 250,
        });
        const motifsJson = safeParseJSON(motifsRaw) || {};
        const motifs = Array.isArray(motifsJson.motifs) ? motifsJson.motifs.filter(Boolean).slice(0, 8) : [];
        const attrs = Array.isArray(motifsJson.attributsDivins)
          ? motifsJson.attributsDivins.filter(Boolean).slice(0, 6)
          : ["Créateur", "Libérateur", "Juste", "Miséricordieux"];
        const seed = simpleHash(`${reference}|${version}|${motifs.join("|")}|${testament}|${genre}`);

        opening = await callOpenAI({
          ...buildPrayerPrompt(reference, version, motifs, attrs, testament, genre, directives.priere_ouverture || "", seed),
          model: "gpt-4o-mini",
          temperature: 0.9,
          max_tokens: 450,
        });

        if (!opening || opening.length < 40) {
          opening = buildOpeningPrayerFallback(book, chapter, verse, version);
          warn = "IA: motifs/prière trop courts — fallback varié (OT/NT + genre)";
        } else {
          source = "openai+fallback";
        }
      } catch {
        opening = buildOpeningPrayerFallback(book, chapter, verse, version);
        source = "canonical";
        warn = "OpenAI indisponible — fallback varié (OT/NT + genre)";
      }
    } else {
      opening = buildOpeningPrayerFallback(book, chapter, verse, version);
      source = "canonical";
      warn = "AI désactivée — fallback varié (OT/NT + genre)";
    }

    if (sections && sections[0]) sections[0].content = cleanText(opening);

    // nettoyage global final
    sections.forEach((s) => {
      s.content = cleanText(s.content);
    });

    res.status(200).json({
      ok: true,
      source,
      warn,
      data: { reference, version: version || "LSG", sections },
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
}
