// /api/chat.js
// Génère 28 rubriques. La dynamique des rubriques 2→27 s'appuie sur
// les mêmes ingrédients que la prière d’ouverture : motifs + attributs
// (OpenAI si dispo, sinon fallback déterministe). Références BibleGateway
// sans doublon, HTML simple et nettoyé.
//
// POST: { book, chapter, verse?, version?, directives? }

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
    .replace(/<!--#injected-verses:\d+-->/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();

function refString(book, chapter, verse) {
  const ch = clamp(parseInt(chapter, 10), 1, 150);
  return verse ? `${cap(book)} ${ch}:${verse}` : `${cap(book)} ${ch}`;
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
  const seen = new Set(), out = [];
  for (const r of arr) { const k = normRef(r); if (k && !seen.has(k)) { seen.add(k); out.push(k); } }
  return out;
}
function joinRefsInline(refs = [], version = "LSG") {
  const links = uniqRefs(refs).map((r) => makeRefLink(r, version));
  return `<span class="refs-inline">${links.join('<span class="sep">·</span>')}</span>`;
}
const withParagraphs = (lines = []) => lines.map((l) => `<p>${cleanText(l)}</p>`).join("\n");

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

/* ───────── Variabilité déterministe ───────── */

function simpleHash(str){ let h=0; for (let i=0;i<str.length;i++){ h=((h<<5)-h)+str.charCodeAt(i); h|=0;} return Math.abs(h); }
const pick = (arr, seed, salt=0) => arr[(seed + salt) % arr.length];
const pickMany = (arr, k, seed, salt=0) => {
  const a = [...arr];
  for (let i=a.length-1;i>0;i--){ const j=(seed+salt+i*31)%(i+1); [a[i],a[j]]=[a[j],a[i]]; }
  return uniqRefs(a).slice(0, Math.max(1, Math.min(k, a.length)));
};

/* ───────── Références d’appui (buckets) ───────── */

const REFS = {
  CREATION: ["Genèse 1:1-5","Psaumes 33:6","Psaumes 104:24","Jean 1:1-3","Colossiens 1:16","Hébreux 11:3"],
  ALLIANCE: ["Genèse 12:1-3","Exode 19:4-6","Jérémie 31:31-34"],
  EVANGILE: ["Romains 1:16-17","1 Corinthiens 15:1-4","Jean 3:16","Éphésiens 2:8-10","Tite 3:4-7"],
  LECTURE_PAROLE: ["Psaumes 19:8-10","Psaumes 119:105","Josué 1:8-9","2 Timothée 3:16-17"],
  EXEGESE: ["Néhémie 8:8","Luc 24:27","2 Timothée 2:15"],
  LEXIQUE: ["Proverbes 1:7","Michée 6:8","Jean 1:14","Romains 3:24-26"],
  THEOLOGIE_AT: ["Deutéronome 6:4-5","Habacuc 2:4"],
  THEOLOGIE_NT: ["Romains 5:1-5","Galates 5:22-25"],
  ACTES2: ["Actes 2:1-4","Actes 2:42-47"],
  EGLISE: ["Éphésiens 4:11-16","Hébreux 10:24-25","Jean 17:17"],
  FAMILLE: ["Deutéronome 6:6-7","Josué 24:15","Éphésiens 6:4"],
  ENFANTS: ["Marc 10:14-16","2 Timothée 3:15"],
  MISSION: ["Matthieu 5:13-16","1 Pierre 3:15","Actes 1:8"],
  PASTORAL: ["1 Thessaloniciens 5:14","Galates 6:1-2","2 Timothée 4:2"],
  MEMO: ["Psaumes 119:11","Colossiens 3:16"]
};

/* ───────── Motifs/attributs (comme la prière) ───────── */

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
    if (v <= 13)  return ["terre sèche","végétation","bénédiction"];
    if (v <= 19)  return ["astres","signes et saisons"];
    if (v <= 23)  return ["poissons","oiseaux","fécondité"];
    if (v <= 31)  return ["homme et femme","image de Dieu","domination responsable"];
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
  const seed = simpleHash(`${ref}|${version || "LSG"}|${motifs.join("|")}`);

  const testament = classifyTestament(cap(book));
  const genre = classifyGenre(cap(book));

  const head = pick(INVOCATIONS[testament] || INVOCATIONS.AT, seed);
  const attr = pick(ATTRS[genre] || ATTRS.narratif, seed, 3);
  const end  = pick(CONCLUSIONS, seed, 5);

  const m2 = pickMany(motifs, 2, seed, 7).join(", ");
  const m3 = pickMany(motifs, 3, seed, 11).join(", ");

  const midTpl = pick(MIDDLES_BY_GENRE[genre] || MIDDLES_BY_GENRE.narratif, seed, 13);
  const middle = midTpl(m2, m3);

  return withParagraphs([`<strong>${head}</strong>, ${attr}, nous venons à toi devant <strong>${ref}</strong>. ${middle} ${end}`]);
}

/* ───────── OpenAI (motifs/attributs) ───────── */

async function callOpenAI({ system, user, model = "gpt-4o-mini", temperature = 0.7, max_tokens = 600 }) {
  const url = "https://api.openai.com/v1/chat/completions";
  const body = { model, messages:[{role:"system",content:system},{role:"user",content:user}], temperature, max_tokens };
  const r = await fetch(url, { method:"POST", headers:{ "Authorization":`Bearer ${OPENAI_API_KEY}`, "Content-Type":"application/json" }, body: JSON.stringify(body) });
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

/* ───────── Contenus dynamiques (rubriques 2→27) ───────── */

function dynamicRefsFromMotifs(motifs = [], testament = "AT", genre = "narratif", seed = 0) {
  const m = motifs.map((x) => x.toLowerCase());

  const buckets = [];
  if (m.some((t) => /création|commencement|cieux|terre|lumière|parole/.test(t))) buckets.push("CREATION");
  if (m.some((t) => /alliance|pères|promesse|élection/.test(t))) buckets.push("ALLIANCE");
  if (m.some((t) => /évangile|grâce|foi|justification|christ/.test(t))) buckets.push("EVANGILE");
  if (m.some((t) => /sagesse|louange|psaume|parole/.test(t))) buckets.push("LECTURE_PAROLE");
  if (m.some((t) => /appel|repentance|jugement|espérance|oracle/.test(t))) buckets.push("PROPHETIC");
  if (m.some((t) => /esprit|église|communauté|disciples/.test(t))) buckets.push("ACTES2");

  // Traduction bucket -> REFS
  const from = [];
  for (const b of uniqRefs(buckets)) {
    if (b === "CREATION") from.push(...REFS.CREATION);
    if (b === "ALLIANCE") from.push(...REFS.ALLIANCE);
    if (b === "EVANGILE") from.push(...REFS.EVANGILE);
    if (b === "LECTURE_PAROLE") from.push(...REFS.LECTURE_PAROLE);
    if (b === "PROPHETIC") from.push("Ésaïe 40:8","Ésaïe 55:10-11");
    if (b === "ACTES2") from.push(...REFS.ACTES2);
  }

  // Fallback si motifs trop vagues
  if (!from.length) {
    if (testament === "AT") from.push(...REFS.CREATION, ...REFS.ALLIANCE, ...REFS.LECTURE_PAROLE);
    else from.push(...REFS.EVANGILE, ...REFS.LECTURE_PAROLE, ...REFS.ACTES2);
  }
  const base = uniqRefs(from);

  // Ajuster par genre
  const genreBoost =
    genre === "poétique" ? ["Psaumes 19:8-10","Psaumes 119:105"] :
    genre === "épistolaire" ? ["Romains 12:1-2","Philippiens 2:12-13"] :
    genre === "prophétique" ? ["Jérémie 31:31-34","Ésaïe 53"] : [];
  return uniqRefs([...base, ...genreBoost].slice(0, 12)); // cap
}

function sectionTextFromMotifs(ref, motifs, attrs, testament, genre, version, seed) {
  // Gabarits courts, nourris par motifs/attributs
  const m2 = pickMany(motifs, 2, seed, 1).join(", ");
  const a1 = pick(attrs, seed, 3) || "Dieu";
  const lineCanon =
    testament === "AT"
      ? `${ref} prend place dans l’économie de l’Alliance; les motifs de ${m2} orientent la lecture.`
      : `${ref} s’inscrit dans l’accomplissement en Christ; ${m2} devient clef de compréhension.`;

  const lineStruct =
    genre === "narratif"
      ? "Repérer ouverture, péripéties, charnières et résolution."
      : genre === "poétique"
      ? "Relever parallélismes, images et progression sapientiale."
      : genre === "prophétique"
      ? "Suivre diagnostic, oracle (jugement/promesse) et appel."
      : "Lire l’argument: indicatifs de l’Évangile → impératifs → applications.";

  const lineFruits = `Sous l’action du ${a1}, ces motifs appellent gratitude, discernement et persévérance.`;

  return { lineCanon, lineStruct, lineFruits };
}

/* ───────── Génération complète des 28 rubriques ───────── */

function buildAllSections({ book, chapter, verse, version, motifs, attrs }) {
  const B = cap(book);
  const ref = refString(book, chapter, verse);
  const testament = classifyTestament(B);
  const genre = classifyGenre(B);
  const seed = simpleHash(`${B}|${chapter}|${verse || ""}|${version || "LSG"}|${(motifs||[]).join("|")}`);

  const { lineCanon, lineStruct, lineFruits } = sectionTextFromMotifs(ref, motifs, attrs, testament, genre, version, seed);
  const canonRefs = dynamicRefsFromMotifs(motifs, testament, genre, seed);

  const data = [];
  data.push({ id: 1, title: "Prière d’ouverture", content: "<p>…</p>" }); // remplacée plus tard

  // 2. Canon & testament
  data.push({
    id: 2,
    title: "Canon et testament",
    content: withParagraphs([
      `${B} se situe dans le ${testament === "AT" ? "Premier" : "Nouveau"} Testament. Genre : ${genre}.`,
      lineCanon,
      `Repères : ${joinRefsInline(canonRefs.slice(0, 4), version)}`
    ])
  });

  // 3. Questions (bloc pédagogique fixe mais titré par ref)
  data.push({
    id: 3,
    title: "Questions du chapitre précédent",
    content: [
      `<h3>Révision sur ${ref} — 5 questions (${genre})</h3>`,
      `<p><strong>1) Observation.</strong> Acteurs, lieux, procédés (répétitions, parallélismes). Verbes-clés.</p>`,
      `<p><strong>2) Compréhension.</strong> Ce que le texte révèle de Dieu et de l’humain.</p>`,
      `<p><strong>3) Interprétation.</strong> Verset-charnière; logique du passage; place dans l’Alliance.</p>`,
      `<p><strong>4) Connexions.</strong> Échos canoniques pertinents.</p>`,
      `<p><strong>5) Application.</strong> Décision concrète (quoi/quand/comment); prière-réponse.</p>`
    ].join("\n")
  });

  // 4. Titre / orientation
  data.push({
    id: 4,
    title: "Titre du chapitre",
    content: withParagraphs([
      `${ref} — <strong>Orientation</strong> : à partir de ${pickMany(motifs, 2, seed, 2).join(", ")}.`,
      `Appuis : ${joinRefsInline((testament==="AT"?["Psaumes 19:8-10","Psaumes 119:105"]:["Luc 24:27","2 Timothée 3:16-17"]), version)}`
    ])
  });

  // 5. Contexte historique (références dépendantes des motifs)
  data.push({
    id: 5,
    title: "Contexte historique",
    content: withParagraphs([
      `Situer ${ref} : période, peuple(s), cadre géopolitique et cultuel; place dans l’histoire du salut.`,
      `Textes de contexte : ${joinRefsInline(pickMany(canonRefs, 3, seed, 4), version)}`
    ])
  });

  // 6. Structure littéraire
  data.push({ id: 6, title: "Structure littéraire", content: withParagraphs([lineStruct]) });

  // 7. Genre littéraire
  data.push({ id: 7, title: "Genre littéraire", content: withParagraphs([`Genre: ${genre}. Conséquences pour la lecture de ${ref}.`]) });

  // 8. Auteur & généalogie
  data.push({
    id: 8,
    title: "Auteur et généalogie",
    content: withParagraphs([
      `Auteur/tradition, destinataires, enracinement canonique pour ${ref}.`,
      testament==="AT"
        ? `Lien aux pères et à l’Alliance : ${joinRefsInline(["Genèse 15:6","Exode 34:6-7","Psaumes 103:17-18"], version)}`
        : `Lien à l’Église apostolique et à la mission : ${joinRefsInline(["Matthieu 28:18-20","Actes 2:42-47"], version)}`
    ])
  });

  // 9. Verset-clé doctrinal
  data.push({
    id: 9,
    title: "Verset-clé doctrinal",
    content: withParagraphs([
      `Dans ${ref}, choisir un pivot lié à ${pickMany(motifs,2,seed,5).join(", ")}.`,
      `Aide : ${joinRefsInline(["Psaumes 119:11","Colossiens 3:16"], version)}`
    ])
  });

  // 10. Analyse exégétique
  data.push({
    id: 10,
    title: "Analyse exégétique",
    content: withParagraphs([
      `Repérer marqueurs (répétitions, inclusions), acteurs, verbes dominants. Croiser avec ${pick(attrs,seed,6)}.`,
      `Aides : ${joinRefsInline(REFS.EXEGESE, version)}`
    ])
  });

  // 11. Analyse lexicale
  data.push({
    id: 11,
    title: "Analyse lexicale",
    content: withParagraphs([
      `Éclairer 1–2 termes liés à ${pickMany(motifs,2,seed,7).join(", ")} dans ${ref}.`,
      `Voir aussi : ${joinRefsInline(REFS.LEXIQUE, version)}`
    ])
  });

  // 12. Références croisées
  const towardsNT = ["Jean 1:1-3","Hébreux 1:1-3","Galates 3:8"];
  const rootsAT   = ["Genèse 12:3","Psaumes 110:1","Ésaïe 53"];
  data.push({
    id: 12,
    title: "Références croisées",
    content: withParagraphs([
      `Relier ${ref} à l’unité du canon en tenant compte de ${pickMany(motifs,2,seed,8).join(", ")}.`,
      testament==="AT"
        ? `Vers le NT : ${joinRefsInline(pickMany(uniqRefs([...towardsNT, ...canonRefs]), 3, seed, 9), version)}`
        : `Racines dans l’AT : ${joinRefsInline(pickMany(uniqRefs([...rootsAT, ...canonRefs]), 3, seed, 10), version)}`
    ])
  });

  // 13. Fondements théologiques
  data.push({
    id: 13,
    title: "Fondements théologiques",
    content: withParagraphs([
      `Dans ${ref}, Dieu agit comme ${pick(attrs,seed,11)}; ${lineFruits}`,
      `Ancrages : ${joinRefsInline(testament==="AT"?REFS.THEOLOGIE_AT:REFS.THEOLOGIE_NT, version)}`
    ])
  });

  // 14. Thème doctrinal
  const themeLine =
    genre==="prophétique" ? "Appel à revenir / espérance" :
    genre==="poétique"    ? "Sagesse / louange" :
    genre==="épistolaire" ? "Évangile / sainteté" :
                             "Actes de Dieu et réponse humaine";
  data.push({
    id: 14,
    title: "Thème doctrinal",
    content: withParagraphs([
      `${themeLine} en lien avec ${pickMany(motifs,2,seed,12).join(", ")}.`,
      `Textes en appui : ${joinRefsInline(genre==="poétique"?["Psaumes 1","Psaumes 19:8-10","Psaumes 119:105"]:["Romains 12:1-2","Philippiens 2:12-13"], version)}`
    ])
  });

  // 15. Fruits spirituels
  data.push({ id: 15, title: "Fruits spirituels", content: withParagraphs([lineFruits]) });

  // 16. Types bibliques
  data.push({ id: 16, title: "Types bibliques", content: withParagraphs([`Repérer motifs/figures de ${ref} qui préfigurent le Christ.`]) });

  // 17. Appui doctrinal
  data.push({
    id: 17,
    title: "Appui doctrinal",
    content: withParagraphs([
      testament==="AT"
        ? `Psaumes/Prophètes en renfort : ${joinRefsInline(pickMany(uniqRefs([...REFS.CREATION,"Ésaïe 40:8","Ésaïe 55:10-11"]),3,seed,13), version)}`
        : `Épîtres/Évangiles : ${joinRefsInline(pickMany(uniqRefs([...REFS.LECTURE_PAROLE,"Jean 17:17"]),3,seed,14), version)}`
    ])
  });

  // 18. Comparaison interne
  data.push({ id: 18, title: "Comparaison entre versets", content: withParagraphs([`Comparer ouverture/charnière/conclusion dans ${ref}.`]) });

  // 19. Actes 2
  data.push({ id: 19, title: "Comparaison avec Actes 2", content: withParagraphs([`Parole – Esprit – Communauté : ${joinRefsInline(REFS.ACTES2, version)}`]) });

  // 20. Verset à mémoriser
  data.push({ id: 20, title: "Verset à mémoriser", content: withParagraphs([`Choisir un verset de ${ref}; phrase-mémo + prière-réponse.`, `Aide : ${joinRefsInline(REFS.MEMO, version)}`]) });

  // 21. Église
  data.push({ id: 21, title: "Enseignement pour l’Église", content: withParagraphs([`Impact communautaire de ${ref} (annonce, édification, discipline, mission).`, `Repères : ${joinRefsInline(REFS.EGLISE, version)}`]) });

  // 22. Famille
  data.push({ id: 22, title: "Enseignement pour la famille", content: withParagraphs([`Transmettre ${ref} : lecture, prière, service, pardon, bénédiction.`, `Textes : ${joinRefsInline(REFS.FAMILLE, version)}`]) });

  // 23. Enfants
  data.push({ id: 23, title: "Enseignement pour enfants", content: withParagraphs([`Raconter simplement ${ref}; prier, mémoriser, agir.`, `Aide : ${joinRefsInline(REFS.ENFANTS, version)}`]) });

  // 24. Mission
  data.push({ id: 24, title: "Application missionnaire", content: withParagraphs([`Témoignage humble et cohérent à partir de ${ref}.`, `Repères : ${joinRefsInline(REFS.MISSION, version)}`]) });

  // 25. Pastoral
  data.push({ id: 25, title: "Application pastorale", content: withParagraphs([`Prière, consolation, conseil, persévérance à la lumière de ${ref}.`, `Textes : ${joinRefsInline(REFS.PASTORAL, version)}`]) });

  // 26. Personnel
  data.push({ id: 26, title: "Application personnelle", content: withParagraphs([`Décider 1–2 actions concrètes (quoi/quand/comment) pour la semaine avec ${ref}.`, `Aide : ${joinRefsInline(["Jacques 1:22-25","Psaumes 139:23-24"], version)}`]) });

  // 27. Versets à retenir
  data.push({
    id: 27,
    title: "Versets à retenir",
    content: withParagraphs([
      `Lister 3–5 versets du chapitre; pour chacun, noter une clé liée à ${pickMany(motifs,2,seed,15).join(", ")}.`,
      `Suggestions hors chapitre : ${joinRefsInline(pickMany(uniqRefs([...canonRefs, ...REFS.LECTURE_PAROLE, ...REFS.EVANGILE]),3,seed,16), version)}`
    ])
  });

  // 28. Prière de fin
  data.push({ id: 28, title: "Prière de fin", content: withParagraphs([`Que la Parole reçue en ${ref} devienne en nous foi, prière et obéissance. Amen.`]) });

  data.forEach(s => s.content = cleanText(s.content));
  return data;
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

    const testament = classifyTestament(cap(book));
    const genre = classifyGenre(cap(book));

    let motifs = [];
    let attrs  = [];

    let source = "canonical";
    let warn   = "";

    if (OPENAI_API_KEY) {
      try {
        const motifsRaw = await callOpenAI({
          ...buildMotifsPrompt(reference, version, directives.priere_ouverture || ""),
          model: "gpt-4o-mini",
          temperature: 0.2,
          max_tokens: 250
        });
        const motifsJson = safeParseJSON(motifsRaw) || {};
        motifs = Array.isArray(motifsJson.motifs) ? motifsJson.motifs.filter(Boolean).slice(0, 8) : [];
        attrs  = Array.isArray(motifsJson.attributsDivins) ? motifsJson.attributsDivins.filter(Boolean).slice(0, 6) : [];
        if (!motifs.length) motifs = guessMotifs(book, chapter, verse);
        if (!attrs.length)  attrs  = ATTRS[genre] || ["Dieu"];
        source = "openai+fallback";
      } catch {
        motifs = guessMotifs(book, chapter, verse);
        attrs  = ATTRS[genre] || ["Dieu"];
        source = "canonical";
        warn   = "OpenAI indisponible — fallback varié (OT/NT + genre)";
      }
    } else {
      motifs = guessMotifs(book, chapter, verse);
      attrs  = ATTRS[genre] || ["Dieu"];
      source = "canonical";
      warn   = "AI désactivée — fallback varié (OT/NT + genre)";
    }

    // Construire toutes les sections à partir des motifs/attributs
    let sections = buildAllSections({ book, chapter, verse, version, motifs, attrs });

    // Prière d’ouverture
    const opening = buildOpeningPrayerFallback(book, chapter, verse, version);
    if (sections && sections[0]) sections[0].content = cleanText(opening);

    // Nettoyage global
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
