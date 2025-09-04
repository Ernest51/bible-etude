// /api/chat.js
// Étude biblique “école théologique”
// - 28 rubriques, toutes dynamiques (2→27 enrichies)
// - Paragraphes pédagogiques + glossaire court intégré
// - Références BibleGateway cliquables, sans doublons
// - HTML sûr: <p>, <strong>, <em> (+ <a> inline)
//
// POST: { book, chapter, verse?, version?, directives? }

export const config = { runtime: "nodejs" };

const OPENAI_API_KEY =
  process.env.OPENAI_API_KEY ||
  process.env.OPENAI_APIKEY ||
  process.env.OPENAI_KEY;

/* ───────────────────────── Utils ───────────────────────── */

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

/* ───────────────── Canon / Testament / Genre ───────────────── */

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

/* ───────────────── Références d’appui ───────────────── */

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

/* ───────────────── Motifs/attributs ───────────────── */

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

/* ───────────────── OpenAI (motifs/attributs) ───────────────── */

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
  if (bu
