// pages/api/chat.js
// Next.js API Route (Pages Router)
// POST JSON: { book, chapter, verse?, version?, directives? }
// Renvoie 28 rubriques adaptées au Testament (OT/NT) et au genre (narratif/poétique/prophétique/épistolaire).
// Prière d’ouverture spécifique au passage avec gabarits OT/NT + genre. Fallback varié si IA indisponible.

export const config = { runtime: "nodejs" };

const OPENAI_API_KEY =
  process.env.OPENAI_API_KEY ||
  process.env.OPENAI_APIKEY ||
  process.env.OPENAI_KEY;

/* ─────────────────────────── Utils ─────────────────────────── */

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n || 1));
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "");
function refString(book, chapter, verse) {
  const ch = clamp(parseInt(chapter, 10), 1, 150);
  if (verse) return `${cap(book)} ${ch}:${verse}`;
  return `${cap(book)} ${ch}`;
}
const shortPara = (t) => `<p>${t}</p>`;
function simpleHash(str){ let h=0; for (let i=0;i<str.length;i++){ h=((h<<5)-h)+str.charCodeAt(i); h|=0;} return Math.abs(h); }
const pick = (arr, seed, salt=0) => arr[(seed + salt) % arr.length];
const pickMany = (arr, k, seed, salt=0) => {
  const a = [...arr];
  for (let i=a.length-1;i>0;i--){
    const j = (seed + salt + i*31) % (i+1);
    [a[i],a[j]] = [a[j],a[i]];
  }
  return a.slice(0, Math.max(1, Math.min(k, a.length)));
};

/* ────────────────────── Canon / Testament / Genre ────────────────────── */

const BOOK_GROUPS = {
  // AT
  TORAH: ["Genèse","Exode","Lévitique","Nombres","Deutéronome"],
  HIST: ["Josué","Juges","Ruth","1 Samuel","2 Samuel","1 Rois","2 Rois","1 Chroniques","2 Chroniques","Esdras","Néhémie","Esther"],
  POETIC: ["Job","Psaumes","Proverbes","Ecclésiaste","Cantique des cantiques"],
  PROPHETIC: ["Ésaïe","Esaïe","Isaïe","Jérémie","Lamentations","Ézéchiel","Daniel","Osée","Joël","Amos","Abdias","Jonas","Michée","Nahoum","Habacuc","Sophonie","Aggée","Zacharie","Malachie"],
  // NT
  GOSPELS: ["Matthieu","Marc","Luc","Jean"],
  ACTS: ["Actes"],
  EPISTLES: ["Romains","1 Corinthiens","2 Corinthiens","Galates","Éphésiens","Philippiens","Colossiens","1 Thessaloniciens","2 Thessaloniciens","1 Timothée","2 Timothée","Tite","Philémon","Hébreux","Jacques","1 Pierre","2 Pierre","1 Jean","2 Jean","3 Jean","Jude"],
  APOCALYPSE: ["Apocalypse"]
};

function inGroup(book, group){ return BOOK_GROUPS[group].includes(book); }

function classifyTestament(book) {
  const AT = [...BOOK_GROUPS.TORAH, ...BOOK_GROUPS.HIST, ...BOOK_GROUPS.POETIC, ...BOOK_GROUPS.PROPHETIC];
  const NT = [...BOOK_GROUPS.GOSPELS, ...BOOK_GROUPS.ACTS, ...BOOK_GROUPS.EPISTLES, ...BOOK_GROUPS.APOCALYPSE];
  if (AT.includes(book)) return "AT";
  if (NT.includes(book)) return "NT";
  return "AT"; // défaut conservateur
}

function classifyGenre(book) {
  if (inGroup(book, "TORAH") || inGroup(book, "HIST") || inGroup(book, "GOSPELS") || inGroup(book, "ACTS")) return "narratif";
  if (inGroup(book, "POETIC")) return "poétique";
  if (inGroup(book, "PROPHETIC") || inGroup(book, "APOCALYPSE")) return "prophétique";
  if (inGroup(book, "EPISTLES")) return "épistolaire";
  return "narratif";
}

/* ───────────────────── Heuristique motifs (fallback) ─────────────────── */

function guessMotifs(book, chapter, verse) {
  const b = (book || "").toLowerCase();
  const ch = Number(chapter || 1);
  const v  = verse ? Number(String(verse).split(/[–-]/)[0]) : null;

  // Exemple plus fin pour Genèse 1
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

  // Catégories génériques par testament/genre
  const testament = classifyTestament(cap(book));
  const genre = classifyGenre(cap(book));
  if (testament === "AT" && genre === "narratif") return ["alliance","appel","épreuves","promesse","fidélité de Dieu"];
  if (genre === "poétique") return ["louange","lamentation","sagesse","métaphores","images fortes"];
  if (genre === "prophétique") return ["oracle","appel à revenir","jugement","espérance","Alliance renouvelée"];
  if (genre === "épistolaire") return ["Évangile","sainteté","charité fraternelle","espérance","vie dans l’Esprit"];
  if (testament === "NT" && genre === "narratif") return ["Royaume","paroles de Jésus","signes","appel à suivre","disciples"];
  return ["Dieu parle","réponse de foi","espérance","sagesse pour vivre"];
}

/* ─────────────── Gabarits OT/NT + genre (fallback prières) ────────────── */

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

// modèles de phrase « centrale » par genre
const MIDDLES_BY_GENRE = {
  narratif: [
    (m2,m3)=>`Par ta Parole qui éclaire, apprends-nous à discerner ton œuvre au cœur de ${m2}, et à marcher dans tes voies.`,
    (m2,m3)=>`Raconte-nous encore tes œuvres, pour que ${m3} façonne notre confiance et notre obéissance concrète.`,
    (m2,m3)=>`Donne-nous de relire l’histoire à la lumière de ${m2}, pour accueillir ton dessein et y coopérer de tout cœur.`,
    (m2,m3)=>`Que le souvenir de tes actes en ${m3} affermisse notre foi et oriente nos décisions présentes.`
  ],
  poétique: [
    (m2,m3)=>`Ouvre en nous un chant vrai: que ${m2} devient louange et prière, afin que notre cœur s’accorde à ta sagesse.`,
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

// interdictions (évite les redites connues)
const FORBIDDEN_PHRASES = [
  "nous nous approchons de toi pour méditer",
  "ouvre notre intelligence",
  "purifie nos intentions",
  "fais naître en nous l’amour de ta volonté",
  "Que ta Parole façonne notre pensée, notre prière et nos décisions.",
  "Que ton Esprit ouvre nos yeux, oriente notre volonté et établisse en nous une obéissance joyeuse."
];

/* ───────────────────── Prière d’ouverture (fallback) ──────────────────── */

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

  return [
    `<p><strong>${head}</strong>, ${attr}, nous venons à toi devant <strong>${ref}</strong>. `,
    `${middle} `,
    `${end}</p>`
  ].join("");
}

/* ─────────────────────────── Rubrique 3 adaptée ───────────────────────── */

function buildRubrique3(book, chapter) {
  const ref = refString(book, chapter);
  const genre = classifyGenre(cap(book));
  const blocks = {
    narratif: [
      `<h3>Révision sur ${ref} — 5 questions (genre: narratif)</h3>`,
      `<p><strong>1) Observation.</strong> Acteurs, lieux, succession d’actions, formules récurrentes.</p>`,
      `<p><strong>2) Compréhension.</strong> Que révèle le récit de Dieu et de l’humain ? intention du passage ?</p>`,
      `<p><strong>3) Interprétation.</strong> Verset-charnière, logique du récit, accents théologiques.</p>`,
      `<p><strong>4) Connexions.</strong> Parallèles dans le canon (Torah/Histoire/Évangiles/Actes).</p>`,
      `<p><strong>5) Application.</strong> Décision concrète (quoi/quand/comment) en cohérence avec le récit.</p>`
    ],
    poétique: [
      `<h3>Révision sur ${ref} — 5 questions (genre: poétique)</h3>`,
      `<p><strong>1) Observation.</strong> Images, parallélismes, champs lexicaux, tonalité (louange/lam.)</p>`,
      `<p><strong>2) Compréhension.</strong> Quelle vision de Dieu et de la vie est donnée ?</p>`,
      `<p><strong>3) Interprétation.</strong> Fonction de la poésie: former l’âme, affiner le désir.</p>`,
      `<p><strong>4) Connexions.</strong> Échos sapientiaux et liturgiques.</p>`,
      `<p><strong>5) Application.</strong> Prière-réponse, mémoire d’un verset, transformation du regard.</p>`
    ],
    prophétique: [
      `<h3>Révision sur ${ref} — 5 questions (genre: prophétique)</h3>`,
      `<p><strong>1) Observation.</strong> Oracle, destinataires, raisons, promesse/jugement.</p>`,
      `<p><strong>2) Compréhension.</strong> Exigence de Dieu, diagnostic spirituel, horizon d’espérance.</p>`,
      `<p><strong>3) Interprétation.</strong> Place dans l’Alliance, continuité/rupture, accomplissements.</p>`,
      `<p><strong>4) Connexions.</strong> Échos prophétiques/évangéliques/apocalyptiques.</p>`,
      `<p><strong>5) Application.</strong> Pas de retour concret, justice, miséricorde, fidélité.</p>`
    ],
    épistolaire: [
      `<h3>Révision sur ${ref} — 5 questions (genre: épistolaire)</h3>`,
      `<p><strong>1) Observation.</strong> Structure argumentaire, indicatifs/impératifs, destinataires.</p>`,
      `<p><strong>2) Compréhension.</strong> Évangile central, enjeux de sainteté/communauté.</p>`,
      `<p><strong>3) Interprétation.</strong> Théologie de l’auteur, logique de l’exhortation.</p>`,
      `<p><strong>4) Connexions.</strong> Parallèles paulinien/pétrinien/johannique.</p>`,
      `<p><strong>5) Application.</strong> Règle de vie simple, charité, espérance, persévérance.</p>`
    ]
  };
  return blocks[genre].join("\n");
}

/* ─────────────────────── 28 rubriques adaptées ───────────────────────── */

function canonicalStudy(book, chapter, verse, version) {
  const B = cap(book);
  const ref = refString(book, chapter, verse);
  const testament = classifyTestament(B);
  const genre = classifyGenre(B);

  const bulletsStructure = {
    narratif: `<ul><li>Ouverture: situation et appel</li><li>Déroulement: actions et réponses</li><li>Clôture: signe, bénédiction ou jugement</li></ul>`,
    poétique: `<ul><li>Parallélismes et images</li><li>Progression affective et sapientiale</li><li>Clôture: louange, confiance ou silence</li></ul>`,
    prophétique: `<ul><li>Diagnostic spirituel</li><li>Oracle: jugement et/ou promesse</li><li>Appel à revenir</li></ul>`,
    épistolaire: `<ul><li>Indicatifs de l’Évangile</li><li>Impératifs de la vie nouvelle</li><li>Applications communautaires</li></ul>`
  };

  const genreLine = {
    narratif: "Genre: narratif (récit théologique qui forme par l’histoire).",
    poétique: "Genre: poétique/sapiential (forme le cœur et le regard).",
    prophétique:"Genre: prophétique (appel, jugement, promesse, espérance).",
    épistolaire:"Genre: épistolaire (enseignement et exhortation pour la vie chrétienne)."
  }[genre];

  const data = [];
  data.push({ id: 1, title: "Prière d’ouverture", content: shortPara("…") }); // remplacée plus tard
  data.push({
    id: 2, title: "Canon et testament",
    content: shortPara(`${B} se situe dans le ${testament === "AT" ? "Premier" : "Nouveau"} Testament. ${genreLine}`)
  });
  data.push({ id: 3, title: "Questions du chapitre précédent", content: buildRubrique3(book, chapter) });
  data.push({
    id: 4, title: "Titre du chapitre",
    content: shortPara(`${ref} — <strong>Lecture orientée par ${genre === "poétique" ? "la sagesse" : genre === "prophétique" ? "l'appel de Dieu" : genre === "épistolaire" ? "l'Évangile" : "les actes de Dieu"}</strong>.`)
  });
  data.push({
    id: 5, title: "Contexte historique",
    content: shortPara(`Situer le passage dans l’histoire du salut (datation, peuple, contexte). ${testament === "AT" ? "Promesses en germe" : "Accomplissement en Christ"} et implications.`)
  });
  data.push({ id: 6, title: "Structure littéraire", content: bulletsStructure[genre] || bulletsStructure.narratif });
  data.push({
    id: 7, title: "Genre littéraire",
    content: shortPara(genreLine)
  });
  data.push({
    id: 8, title: "Auteur et généalogie",
    content: shortPara(`Auteur/tradition, destinataires et enracinement canonique. ${testament==="AT"?"Lien aux pères et à l’Alliance":"Lien à l’Église apostolique et à la mission"}.`)
  });
  data.push({
    id: 9, title: "Verset-clé doctrinal",
    content: shortPara(`Identifier un pivot qui condense l’intention du passage; expliquer ce qu’il révèle de Dieu et ce qu’il appelle chez l’humain.`)
  });
  data.push({
    id:10, title: "Analyse exégétique",
    content: shortPara(`Marqueurs du texte (répétitions, inclusions, formules). Qui agit ? Dans quel ordre ? Quels effets ?`)
  });
  data.push({
    id:11, title: "Analyse lexicale",
    content: shortPara(`Éclairer 1–2 termes décisifs pour le sens (justice, alliance, foi, sagesse, esprit, etc.).`)
  });
  data.push({
    id:12, title: "Références croisées",
    content: shortPara(`${testament==="AT"?"Échos dans la Torah/Prophètes/Sagesse":"Échos dans l’enseignement de Jésus/Épîtres/Apocalypse"}; unité du dessein de Dieu.`)
  });
  data.push({
    id:13, title: "Fondements théologiques",
    content: shortPara(`Dieu ${testament==="AT"?"crée, élit, appelle, juge, promet":"révèle en Christ, sauve, sanctifie, envoie"}; l’homme ${testament==="AT"?"répond par l’obéissance de la foi":"marche par l’Esprit, dans la charité"}.`)
  });
  data.push({
    id:14, title: "Thème doctrinal",
    content: shortPara(`Axe: ${genre==="prophétique"?"appel à revenir/espérance": genre==="poétique"?"sagesse/louange": genre==="épistolaire"?"Évangile/sainteté": "actes de Dieu et réponse humaine"}.`)
  });
  data.push({
    id:15, title: "Fruits spirituels",
    content: shortPara(`Gratitude, discernement, persévérance, justice, charité, espérance.`)
  });
  data.push({
    id:16, title: "Types bibliques",
    content: shortPara(`Préfigurations et figures (motifs, lieux, personnes) qui convergent vers le Christ.`)
  });
  data.push({
    id:17, title: "Appui doctrinal",
    content: shortPara(`Autres passages qui consolident la lecture: ${testament==="AT"?"Psaumes/Prophètes":"Épîtres/Évangiles"}.`)
  });
  data.push({
    id:18, title: "Comparaison entre versets",
    content: shortPara(`Comparer ouverture/charnière/conclusion pour clarifier la ligne théologique du passage.`)
  });
  data.push({
    id:19, title: "Comparaison avec Actes 2",
    content: shortPara(`Parallèle: Parole–Esprit–Communauté; pertinence pour aujourd’hui.`)
  });
  data.push({
    id:20, title: "Verset à mémoriser",
    content: shortPara(`Choisir un verset; rédiger une phrase-mémo et une prière-réponse.`)
  });
  data.push({
    id:21, title: "Enseignement pour l’Église",
    content: shortPara(`Annonce, édification, discipline, mission: impact communautaire du passage.`)
  });
  data.push({
    id:22, title: "Enseignement pour la famille",
    content: shortPara(`Transmettre: lecture, prière, service, pardon, bénédiction.`)
  });
  data.push({
    id:23, title: "Enseignement pour enfants",
    content: shortPara(`Approche simple et visuelle: raconter, prier, mémoriser, agir.`)
  });
  data.push({
    id:24, title: "Application missionnaire",
    content: shortPara(`Témoignage humble et cohérent; parole claire; amour concret.`)
  });
  data.push({
    id:25, title: "Application pastorale",
    content: shortPara(`Accompagnement: prière, consolation, conseil, persévérance.`)
  });
  data.push({
    id:26, title: "Application personnelle",
    content: shortPara(`Nommer 1–2 décisions concrètes (quoi/quand/comment) pour la semaine.`)
  });
  data.push({
    id:27, title: "Versets à retenir",
    content: shortPara(`Lister 3–5 versets; noter une clé de compréhension pour chacun.`)
  });
  data.push({
    id:28, title: "Prière de fin",
    content: shortPara(`Que ta Parole devienne en nous foi, prière, obéissance; et que notre vie te glorifie. Amen.`)
  });
  return data;
}

/* ───────────────────────── OpenAI helpers ────────────────────────────── */

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
  return {
    system: "Tu es un bibliste pastoral. HTML autorisé: <p>, <strong>, <em> uniquement.",
    user: `
Écris une Prière d’ouverture spécifique à ${ref} (${version||"LSG"}).
Contraintes:
- Utiliser au moins 2 éléments de: ${JSON.stringify(motifs||[])}
- Nommer Dieu avec un attribut de: ${JSON.stringify(attrs||["Créateur","Libérateur","Juste","Miséricordieux"])}
- Intégrer le contexte: Testament=${testament}, Genre=${genre}.
- 1 paragraphe, 70–120 mots, ton humble et précis au passage.
- Interdictions: ${FORBIDDEN_PHRASES.map(s=>`“${s}”`).join(", ")}.
- Commencer par une invocation + attribut; conclure brièvement (variante “amen”).
Graines: ${seed}.
${custom ? `Directives:\n${custom}` : ""}`.trim()
  };
}

/* ───────────────────────────── Handler ───────────────────────────────── */

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok:false, error:"Method Not Allowed" });

  try {
    if (req.body && req.body.probe) {
      return res.status(200).json({ ok:true, source:"probe", warn:"" });
    }

    const { book="Genèse", chapter=1, verse="", version="LSG", directives={} } = req.body || {};
    const reference = refString(book, chapter, verse);

    // Étude canonique adaptée (toutes les rubriques)
    let sections = canonicalStudy(book, chapter, verse, version);
    let source   = "canonical";
    let warn     = "";

    // Prière d’ouverture
    let opening = "";

    const testament = classifyTestament(cap(book));
    const genre = classifyGenre(cap(book));

    if (OPENAI_API_KEY) {
      try {
        // Étape A — motifs
        const motifsRaw = await callOpenAI({
          ...buildMotifsPrompt(reference, version, directives.priere_ouverture || ""),
          model: "gpt-4o-mini",
          temperature: 0.2, max_tokens: 250
        });
        const motifsJson = safeParseJSON(motifsRaw) || {};
        const motifs = Array.isArray(motifsJson.motifs) ? motifsJson.motifs.filter(Boolean).slice(0, 8) : [];
        const attrs  = Array.isArray(motifsJson.attributsDivins) ? motifsJson.attributsDivins.filter(Boolean).slice(0, 6) : ["Créateur","Libérateur","Juste","Miséricordieux"];

        // Étape B — prière
        const seed = simpleHash(`${reference}|${version}|${motifs.join("|")}|${testament}|${genre}`);
        opening = await callOpenAI({
          ...buildPrayerPrompt(reference, version, motifs, attrs, testament, genre, directives.priere_ouverture || "", seed),
          model: "gpt-4o-mini",
          temperature: 0.9, max_tokens: 450
        });

        if (!opening || opening.length < 40) {
          opening = buildOpeningPrayerFallback(book, chapter, verse, version);
          warn = "IA: motifs/prière trop courts — fallback varié (OT/NT + genre)";
        } else {
          source = "openai";
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

    // Injection rubrique 1
    if (sections && sections[0]) sections[0].content = opening;

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
