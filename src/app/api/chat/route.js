// src/app/api/chat/route.js
// Étude biblique “école théologique” — 28 rubriques (App Router / Next 13+)
// - Robuste : ne jette JAMAIS d’exception vers le client (au pire -> { ok:false })
// - Si OPENAI_API_KEY est absente ou en échec → fallback “canonical” (local) sans casser l’API

export const runtime   = "nodejs";
export const dynamic   = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";

/* ───────────────────────── Env ───────────────────────── */
const OPENAI_API_KEY =
  process.env.OPENAI_API_KEY ||
  process.env.OPENAI_APIKEY ||
  process.env.OPENAI_KEY ||
  "";

/* ───────────────────────── Utils ───────────────────────── */
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n || 1));
const cap   = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "");
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

/* ───────────────── Canon / Genre ───────────────── */
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

/* ───────────────── Variabilité déterministe ───────────────── */
function simpleHash(str){ let h=0; for (let i=0;i<str.length;i++){ h=((h<<5)-h)+str.charCodeAt(i); h|=0;} return Math.abs(h); }
const pick = (arr, seed, salt=0) => arr[(seed + salt) % arr.length];
const pickMany = (arr, k, seed, salt=0) => {
  const a = [...arr];
  for (let i=a.length-1;i>0;i--){ const j=(seed+salt+i*31)%(i+1); [a[i],a[j]]=[a[j],a[i]]; }
  return uniqRefs(a).slice(0, Math.max(1, Math.min(k, a.length)));
};

/* ───────────────── Références et banques ───────────────── */
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

/* ───────────────── Heuristiques motifs ───────────────── */
function classify(book){ return { testament: classifyTestament(cap(book)), genre: classifyGenre(cap(book)) }; }

function guessMotifs(book, chapter, verse) {
  const b = (book || "").toLowerCase();
  const ch = Number(chapter || 1);
  const v  = verse ? Number(String(verse).split(/[–-]/)[0]) : null;

  if ((b === "genèse" || b === "genese") && ch === 1) {
    if (!v)  return ["création","Parole qui ordonne","lumière et ténèbres","séparations","vie naissante","image de Dieu"];
    if (v === 1)  return ["cieux et terre","commencement","Parole créatrice"];
    if (v === 2)  return ["tohu-bohu","ténèbres","Esprit planant","eaux profondes"];
    if (v <= 5)   return ["Que la lumière soit","séparation lumière/ténèbres","jour et nuit"];
  }
  const { testament, genre } = classify(book);
  if (testament === "AT" && genre === "narratif") return ["alliance","appel","épreuves","promesse","fidélité de Dieu"];
  if (genre === "poétique") return ["louange","lamentation","sagesse","métaphores","images fortes"];
  if (genre === "prophétique") return ["oracle","appel à revenir","jugement","espérance","Alliance renouvelée"];
  if (genre === "épistolaire") return ["Évangile","sainteté","charité fraternelle","espérance","vie dans l’Esprit"];
  if (testament === "NT" && genre === "narratif") return ["Royaume","paroles de Jésus","signes","appel à suivre","disciples"];
  return ["Dieu parle","réponse de foi","espérance","sagesse pour vivre"];
}

/* ───────────────── OpenAI (facultatif) ───────────────── */
async function callOpenAI({ system, user, model = "gpt-4o-mini", temperature = 0.25, max_tokens = 250 }) {
  if (!OPENAI_API_KEY) return null;
  const url = "https://api.openai.com/v1/chat/completions";
  const body = { model, messages:[{role:"system",content:system},{role:"user",content:user}], temperature, max_tokens };
  const r = await fetch(url, { method:"POST", headers:{ "Authorization":`Bearer ${OPENAI_API_KEY}`, "Content-Type":"application/json" }, body: JSON.stringify(body) });
  if (!r.ok) return null;
  const j = await r.json().catch(()=>null);
  return j?.choices?.[0]?.message?.content || null;
}
function buildMotifsPrompt(ref, version, note=""){
  return {
    system: "Tu es un bibliste rigoureux. Réponds uniquement en JSON valide.",
    user: `
Donne 6 à 10 motifs concrets pour ${ref} (${version||"LSG"}).
Format strict:
{"motifs":[...],"attributsDivins":[...]}
${note ? `Note: ${note}` : ""}`.trim()
  };
}
const safeParseJSON = (s)=>{ try{ return JSON.parse(s); }catch{ return null; } };

/* ───────────────── Composition pédagogique ───────────────── */
function dynamicRefsFromMotifs(motifs = [], testament = "AT", genre = "narratif", seed = 0) {
  const m = motifs.map((x) => x.toLowerCase());
  const buckets = [];
  if (m.some((t) => /création|commencement|cieux|terre|lumière|parole|image/.test(t))) buckets.push("CREATION");
  if (m.some((t) => /alliance|pères|promesse|élection/.test(t))) buckets.push("ALLIANCE");
  if (m.some((t) => /évangile|grâce|foi|justification|christ/.test(t))) buckets.push("EVANGILE");
  if (m.some((t) => /sagesse|louange|psaume|parole/.test(t))) buckets.push("LECTURE_PAROLE");
  if (m.some((t) => /appel|repentance|jugement|espérance|oracle/.test(t))) buckets.push("PROPHETIC");
  if (m.some((t) => /esprit|église|communauté|disciples/.test(t))) buckets.push("ACTES2");

  const from = [];
  if (buckets.includes("CREATION")) from.push(...REFS.CREATION);
  if (buckets.includes("ALLIANCE")) from.push(...REFS.ALLIANCE);
  if (buckets.includes("EVANGILE")) from.push(...REFS.EVANGILE);
  if (buckets.includes("LECTURE_PAROLE")) from.push(...REFS.LECTURE_PAROLE);
  if (buckets.includes("PROPHETIC")) from.push("Ésaïe 40:8","Ésaïe 55:10-11");
  if (buckets.includes("ACTES2")) from.push(...REFS.ACTES2);

  if (!from.length) {
    if (testament === "AT") from.push(...REFS.CREATION, ...REFS.ALLIANCE, ...REFS.LECTURE_PAROLE);
    else from.push(...REFS.EVANGILE, ...REFS.LECTURE_PAROLE, ...REFS.ACTES2);
  }
  const base = uniqRefs(from);
  const genreBoost =
    genre === "poétique" ? ["Psaumes 19:8-10","Psaumes 119:105"] :
    genre === "épistolaire" ? ["Romains 12:1-2","Philippiens 2:12-13"] :
    genre === "prophétique" ? ["Jérémie 31:31-34","Ésaïe 53"] : [];
  return uniqRefs([...base, ...genreBoost].slice(0, 14));
}

function shortGlossary(motifs = [], genre = "narratif", seed = 0) {
  const bank = {
    alliance: "relation de fidélité établie par Dieu avec un peuple, assortie de promesses et d’exigences",
    justification: "déclaration de justice par Dieu, non par mérite mais par grâce",
    sanctification: "processus par lequel Dieu met à part et transforme",
    sagesse: "art de vivre selon Dieu, au-delà du seul savoir",
    oracle: "parole prophétique qui diagnostique et promet",
    évangile: "bonne nouvelle de Jésus-Christ: mort et résurrection pour le salut",
    inclusion: "encadrement d’un passage par un même motif au début et à la fin",
    typologie: "figure ou motif de l’AT accomplis en Christ"
  };
  const keys = Object.keys(bank);
  const chosen = pickMany(keys, 3, seed, 21).map(k => `<em>${k}</em>: ${bank[k]}`);
  return chosen.join(" ; ");
}

function sectionTextFromMotifs(ref, motifs, attrs, testament, genre, version, seed) {
  const m2 = pickMany(motifs, 2, seed, 1).join(", ");
  const a1 = pick(attrs, seed, 3) || "Dieu";
  const lineCanon =
    testament === "AT"
      ? `${ref} prend place dans le Premier Testament et s’éclaire par ${m2}.`
      : `${ref} s’inscrit dans l’accomplissement en Christ; ${m2} structurent la lecture.`;

  const lineStruct =
    genre === "narratif"
      ? "Rechercher ouverture, péripéties, charnières et résolution; noter les changements de scène et les verbes directeurs."
      : genre === "poétique"
      ? "Identifier parallélismes, images, champs lexicaux; suivre la progression affective et sapientiale."
      : genre === "prophétique"
      ? "Distinguer diagnostic, oracle (jugement/promesse) et appel; relever les marqueurs d’alliance."
      : "Suivre l’argument: indicatifs de l’Évangile → impératifs → applications communautaires, avec connecteurs logiques.";

  const lineFruits = `Sous l’action du ${a1}, ces motifs suscitent gratitude, repentance, discernement et persévérance.`;
  const lineMethod = `Méthode: lire, observer, formuler une hypothèse, vérifier par ${joinRefsInline(["Néhémie 8:8","Luc 24:27","2 Timothée 2:15"], version)}.`;

  return { lineCanon, lineStruct, lineFruits, lineMethod };
}

/* ───────────────── Génération des 28 rubriques ───────────────── */
function buildAllSections({ book, chapter, verse, version, motifs, attrs }) {
  const B = cap(book);
  const ref = refString(book, chapter, verse);
  const { testament, genre } = classify(B);
  const seed = simpleHash(`${B}|${chapter}|${verse || ""}|${version || "LSG"}|${(motifs||[]).join("|")}`);

  const { lineCanon, lineStruct, lineFruits, lineMethod } =
    sectionTextFromMotifs(ref, motifs, attrs, testament, genre, version, seed);
  const canonRefs = dynamicRefsFromMotifs(motifs, testament, genre, seed);
  const gloss = shortGlossary(motifs, genre, seed);

  const data = [];
  data.push({ id: 1, title: "Prière d’ouverture", content: "<p>…</p>" }); // remplacée plus tard

  data.push({
    id: 2,
    title: "Canon et testament",
    content: withParagraphs([
      `${B} appartient au ${testament === "AT" ? "Premier" : "Nouveau"} Testament; genre: ${genre}.`,
      lineCanon,
      `Repères canoniques: ${joinRefsInline(canonRefs.slice(0, 4), version)}.`,
      `Glossaire: ${gloss}.`
    ])
  });

  data.push({
    id: 3,
    title: "Questions du chapitre précédent",
    content: [
      `<p><strong>Observation.</strong> Acteurs, lieux, procédés (répétitions, inclusions, parallélismes). Verbes-clés; questions: “qui fait quoi, où, quand, pourquoi ?”.</p>`,
      `<p><strong>Compréhension.</strong> Que révèle ${ref} de Dieu et de l’humain ? Quelles intentions dominent ?</p>`,
      `<p><strong>Interprétation.</strong> Identifier un verset-charnière; expliciter la logique du passage et sa place dans l’Alliance.</p>`,
      `<p><strong>Connexions.</strong> Échos canoniques pertinents: ${joinRefsInline(pickMany(canonRefs, 3, seed, 5), version)}.</p>`,
      `<p><strong>Application.</strong> Décision concrète (quoi/quand/comment) et prière-réponse.</p>`
    ].join("\n")
  });

  data.push({
    id: 4,
    title: "Titre du chapitre",
    content: withParagraphs([
      `${ref} — <strong>Orientation</strong>: lire à la lumière de ${pickMany(motifs, 2, seed, 2).join(", ")}.`,
      `Appuis: ${joinRefsInline((testament==="AT"?["Psaumes 19:8-10","Psaumes 119:105"]:["Luc 24:27","2 Timothée 3:16-17"]), version)}.`,
      `Méthodologie: énoncer le thème en une phrase puis justifier par 2–3 indices textuels.`
    ])
  });

  data.push({
    id: 5,
    title: "Contexte historique",
    content: withParagraphs([
      `Situer ${ref}: période, peuple(s), cadre géopolitique et cultuel; place dans l’histoire du salut.`,
      `Textes de contexte: ${joinRefsInline(pickMany(canonRefs, 3, seed, 4), version)}.`,
      `Conseil: cartographier les lieux cités; noter institutions et fêtes; distinguer coutume/commandement.`
    ])
  });

  data.push({
    id: 6,
    title: "Structure littéraire",
    content: withParagraphs([
      lineStruct,
      `Indicateurs: connecteurs (“or”, “ainsi”, “c’est pourquoi”), inclusions, changements de locuteur.`
    ])
  });

  data.push({
    id: 7,
    title: "Genre littéraire",
    content: withParagraphs([
      `Genre: ${genre}. Chaque genre forme le lecteur différemment (récit, prière, oracle, argument).`,
      `Conséquence: adapter les attentes d’application et la prise de notes.`
    ])
  });

  data.push({
    id: 8,
    title: "Auteur et généalogie",
    content: withParagraphs([
      `Auteur/tradition, destinataires, enracinement canonique pour ${ref}.`,
      testament==="AT"
        ? `Lien aux pères: ${joinRefsInline(["Genèse 15:6","Exode 34:6-7","Psaumes 103:17-18"], version)}.`
        : `Lien à l’Église apostolique et à la mission: ${joinRefsInline(["Matthieu 28:18-20","Actes 2:42-47"], version)}.`
    ])
  });

  data.push({
    id: 9,
    title: "Verset-clé doctrinal",
    content: withParagraphs([
      `Choisir un pivot lié à ${pickMany(motifs,2,seed,5).join(", ")} et montrer comment il organise le passage.`,
      `Aide: ${joinRefsInline(["Psaumes 119:11","Colossiens 3:16"], version)}.`
    ])
  });

  data.push({
    id: 10,
    title: "Analyse exégétique",
    content: withParagraphs([
      `Relever marqueurs (répétitions, inclusions), champs lexicaux et verbes gouverneurs; confronter hypothèses.`,
      `Aides: ${joinRefsInline(REFS.EXEGESE, version)}.`,
      `Méthode: lire, observer, formuler une hypothèse, vérifier par ${joinRefsInline(["Néhémie 8:8","Luc 24:27","2 Timothée 2:15"], version)}.`
    ])
  });

  data.push({
    id: 11,
    title: "Analyse lexicale",
    content: withParagraphs([
      `Éclairer 1–2 termes associés à ${pickMany(motifs,2,seed,7).join(", ")} dans ${ref}; noter sens, contexte et réemploi ailleurs.`,
      `Voir aussi: ${joinRefsInline(REFS.LEXIQUE, version)}.`,
      `Mini glossaire: ${shortGlossary(motifs, genre, seed)}.`
    ])
  });

  const towardsNT = ["Jean 1:1-3","Hébreux 1:1-3","Galates 3:8"];
  const rootsAT   = ["Genèse 12:3","Psaumes 110:1","Ésaïe 53"];
  data.push({
    id: 12,
    title: "Références croisées",
    content: withParagraphs([
      `Relier ${ref} à l’unité du canon via ${pickMany(motifs,2,seed,8).join(", ")}.`,
      classify(B).testament==="AT"
        ? `Vers le NT: ${joinRefsInline(pickMany(uniqRefs([...towardsNT, ...canonRefs]), 3, seed, 9), version)}.`
        : `Racines AT: ${joinRefsInline(pickMany(uniqRefs([...rootsAT, ...canonRefs]), 3, seed, 10), version)}.`
    ])
  });

  data.push({
    id: 13,
    title: "Fondements théologiques",
    content: withParagraphs([
      `Dieu agit comme ${pick(ATTRS[genre] || ["Dieu"], seed, 11)}; l’humain est appelé à la foi agissante. ${lineFruits}`,
      `Ancrages: ${joinRefsInline(classify(B).testament==="AT"?REFS.THEOLOGIE_AT:REFS.THEOLOGIE_NT, version)}.`
    ])
  });

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
      `Textes en appui: ${joinRefsInline(genre==="poétique"?["Psaumes 1","Psaumes 19:8-10","Psaumes 119:105"]:["Romains 12:1-2","Philippiens 2:12-13"], version)}.`
    ])
  });

  data.push({ id: 15, title: "Fruits spirituels", content: withParagraphs([lineFruits]) });
  data.push({ id: 16, title: "Types bibliques", content: withParagraphs([`Repérer figures/motifs de ${ref} qui préfigurent le Christ (typologie) et expliciter l’accomplissement.`]) });
  data.push({ id: 17, title: "Appui doctrinal", content: withParagraphs([`Repères: ${joinRefsInline(["Ésaïe 40:8","Ésaïe 55:10-11","Jean 17:17"], version)}.`]) });
  data.push({ id: 18, title: "Comparaison entre versets", content: withParagraphs([`Comparer ouverture/charnière/conclusion; noter évolutions sémantiques d’un mot-clé.`]) });
  data.push({ id: 19, title: "Comparaison avec Actes 2", content: withParagraphs([`Parole – Esprit – Communauté; pertinence: ${joinRefsInline(REFS.ACTES2, version)}.`]) });
  data.push({ id: 20, title: "Verset à mémoriser", content: withParagraphs([`Choisir un verset de ${ref}; phrase-mémo et prière-réponse.`, `Aide: ${joinRefsInline(REFS.MEMO, version)}.`]) });
  data.push({ id: 21, title: "Enseignement pour l’Église", content: withParagraphs([`Impact communautaire (annonce, édification, mission): ${joinRefsInline(REFS.EGLISE, version)}.`]) });
  data.push({ id: 22, title: "Enseignement pour la famille", content: withParagraphs([`Transmettre ${ref}: lecture, prière, service, pardon, bénédiction: ${joinRefsInline(REFS.FAMILLE, version)}.`]) });
  data.push({ id: 23, title: "Enseignement pour enfants", content: withParagraphs([`Raconter simplement; utiliser images/gestes: ${joinRefsInline(REFS.ENFANTS, version)}.`]) });
  data.push({ id: 24, title: "Application missionnaire", content: withParagraphs([`Témoignage humble et cohérent à partir de ${ref}: ${joinRefsInline(REFS.MISSION, version)}.`]) });
  data.push({ id: 25, title: "Application pastorale", content: withParagraphs([`Prière, consolation, conseil: ${joinRefsInline(REFS.PASTORAL, version)}.`]) });
  data.push({ id: 26, title: "Application personnelle", content: withParagraphs([`Décider 1–2 actions concrètes (quoi/quand/comment) pour la semaine avec ${ref}: ${joinRefsInline(["Jacques 1:22-25","Psaumes 139:23-24"], version)}.`]) });
  data.push({ id: 27, title: "Versets à retenir", content: withParagraphs([`Lister 3–5 versets du chapitre; noter une clé liée à ${ref}.`]) });
  data.push({ id: 28, title: "Prière de fin", content: withParagraphs([`Que la Parole reçue en ${ref} devienne en nous foi, prière et obéissance. Amen.`]) });

  data.forEach(s => s.content = cleanText(s.content));
  return data;
}

function buildOpeningPrayerFallback(book, chapter, verse, version) {
  const ref = refString(book, chapter, verse);
  const motifs = guessMotifs(book, chapter, verse);
  const { testament, genre } = classify(book);
  const seed = simpleHash(`${ref}|${version || "LSG"}|${motifs.join("|")}`);

  const head = pick(INVOCATIONS[testament] || INVOCATIONS.AT, seed);
  const attr = pick(ATTRS[genre] || ATTRS.narratif, seed, 3);
  const end  = pick(CONCLUSIONS, seed, 5);

  const m2 = pickMany(motifs, 2, seed, 7).join(", ");
  const m3 = pickMany(motifs, 3, seed, 11).join(", ");

  const middles = {
    narratif: (m2,m3)=>`Donne-nous de relire l’histoire à la lumière de ${m2}, pour accueillir ton dessein et y coopérer de tout cœur.`,
    poétique: (m2,m3)=>`Ouvre en nous un chant vrai: que ${m3} devienne louange et sagesse vécue.`,
    prophétique: (m2,m3)=>`Fais retentir ton appel: que ${m2} nous conduise à revenir à toi, dans la justice et la paix.`,
    épistolaire: (m2,m3)=>`Éclaire notre intelligence de l’Évangile, afin que ${m2} façonne nos pensées, paroles et actes.`
  };
  const middle = (middles[genre] || middles.narratif)(m2,m3);

  return withParagraphs([`<strong>${head}</strong>, ${attr}, nous venons à toi devant <strong>${ref}</strong>. ${middle} ${end}`]);
}

/* ───────────────── Handlers ───────────────── */
export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    if (body && body.probe) {
      return NextResponse.json({ ok: true, source: "probe", warn: "" }, { status: 200 });
    }

    const {
      book = "Genèse",
      chapter = 1,
      verse = "",
      version = "LSG",
      directives = {}
    } = body || {};

    const reference = refString(book, chapter, verse);
    const { genre } = classify(cap(book));

    let motifs = [];
    let attrs  = [];

    let source = "canonical";
    let warn   = "";

    // 1) Essai OpenAI (facultatif)
    if (OPENAI_API_KEY) {
      try {
        const raw = await callOpenAI({
          ...buildMotifsPrompt(reference, version, directives.priere_ouverture || ""),
          model: "gpt-4o-mini",
          temperature: 0.25,
          max_tokens: 250
        });
        const j = safeParseJSON(raw || "") || {};
        motifs = Array.isArray(j.motifs) ? j.motifs.filter(Boolean).slice(0, 8) : [];
        attrs  = Array.isArray(j.attributsDivins) ? j.attributsDivins.filter(Boolean).slice(0, 6) : [];
        if (!motifs.length) motifs = guessMotifs(book, chapter, verse);
        if (!attrs.length)  attrs  = (ATTRS[genre] || ["Dieu"]);
        source = "openai+fallback";
      } catch {
        motifs = guessMotifs(book, chapter, verse);
        attrs  = (ATTRS[genre] || ["Dieu"]);
        source = "canonical";
        warn   = "OpenAI indisponible — fallback varié (OT/NT + genre)";
      }
    } else {
      motifs = guessMotifs(book, chapter, verse);
      attrs  = (ATTRS[genre] || ["Dieu"]);
      source = "canonical";
      warn   = "AI désactivée — fallback varié (OT/NT + genre)";
    }

    // 2) Sections (28)
    let sections = buildAllSections({ book, chapter, verse, version, motifs, attrs });

    // 3) Prière d’ouverture (spécifique)
    const opening = buildOpeningPrayerFallback(book, chapter, verse, version);
    if (sections && sections[0]) sections[0].content = cleanText(opening);
    sections.forEach(s => { s.content = cleanText(s.content); });

    return NextResponse.json({
      ok: true,
      source,
      warn,
      data: { reference, version: (version || "LSG"), sections }
    }, { status: 200 });
  } catch (e) {
    // Ne jamais renvoyer 500 à l’UI : on encapsule l’erreur en ok:false
    return NextResponse.json({
      ok: false,
      error: String(e?.message || e || "Erreur inconnue")
    }, { status: 200 });
  }
}

// (optionnel) GET -> simple info
export async function GET() {
  return NextResponse.json({ ok: true, hint: "POST { book, chapter, verse?, version? }" }, { status: 200 });
}
