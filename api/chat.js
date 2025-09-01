// /api/chat.js — Version robuste (toujours un 200 avec fallback au pire)

const TITLES = [
  "1. Prière d’ouverture","2. Canon et testament","3. Questions du chapitre précédent","4. Titre du chapitre",
  "5. Contexte historique","6. Structure littéraire","7. Genre littéraire","8. Auteur et généalogie",
  "9. Verset-clé doctrinal","10. Analyse exégétique","11. Analyse lexicale","12. Références croisées",
  "13. Fondements théologiques","14. Thème doctrinal","15. Fruits spirituels","16. Types bibliques",
  "17. Appui doctrinal","18. Comparaison entre versets","19. Comparaison avec Actes 2","20. Verset à mémoriser",
  "21. Enseignement pour l’Église","22. Enseignement pour la famille","23. Enseignement pour enfants","24. Application missionnaire",
  "25. Application pastorale","26. Application personnelle","27. Versets à retenir","28. Prière de fin"
];

const TEMPLATE = `# {{BOOK}} {{CHAP}}

1. Prière d’ouverture

{{S1}}

2. Canon et testament

{{S2}}

3. Questions du chapitre précédent

{{S3}}

4. Titre du chapitre

{{S4}}

5. Contexte historique

{{S5}}

6. Structure littéraire

{{S6}}

7. Genre littéraire

{{S7}}

8. Auteur et généalogie

{{S8}}

9. Verset-clé doctrinal

{{S9}}

10. Analyse exégétique

{{S10}}

11. Analyse lexicale

{{S11}}

12. Références croisées

{{S12}}

13. Fondements théologiques

{{S13}}

14. Thème doctrinal

{{S14}}

15. Fruits spirituels

{{S15}}

16. Types bibliques

{{S16}}

17. Appui doctrinal

{{S17}}

18. Comparaison entre versets

{{S18}}

19. Comparaison avec Actes 2

{{S19}}

20. Verset à mémoriser

{{S20}}

21. Enseignement pour l’Église

{{S21}}

22. Enseignement pour la famille

{{S22}}

23. Enseignement pour enfants

{{S23}}

24. Application missionnaire

{{S24}}

25. Application pastorale

{{S25}}

26. Application personnelle

{{S26}}

27. Versets à retenir

{{S27}}

28. Prière de fin

{{S28}}`.trim();

function youVersionLink(book, chapter) {
  const map = {
    "Genèse":"GEN","Exode":"EXO","Lévitique":"LEV","Nombres":"NUM","Deutéronome":"DEU",
    "Josué":"JOS","Juges":"JDG","Ruth":"RUT","1 Samuel":"1SA","2 Samuel":"2SA",
    "1 Rois":"1KI","2 Rois":"2KI","1 Chroniques":"1CH","2 Chroniques":"2CH","Esdras":"EZR",
    "Néhémie":"NEH","Esther":"EST","Job":"JOB","Psaumes":"PSA","Proverbes":"PRO",
    "Ecclésiaste":"ECC","Cantique des cantiques":"SNG","Ésaïe":"ISA","Jérémie":"JER","Lamentations":"LAM",
    "Ézéchiel":"EZK","Daniel":"DAN","Osée":"HOS","Joël":"JOL","Amos":"AMO",
    "Abdias":"OBA","Jonas":"JON","Michée":"MIC","Nahoum":"NAM","Habacuc":"HAB",
    "Sophonie":"ZEP","Aggée":"HAG","Zacharie":"ZEC","Malachie":"MAL",
    "Matthieu":"MAT","Marc":"MRK","Luc":"LUK","Jean":"JHN","Actes":"ACT",
    "Romains":"ROM","1 Corinthiens":"1CO","2 Corinthiens":"2CO","Galates":"GAL","Éphésiens":"EPH",
    "Philippiens":"PHP","Colossiens":"COL","1 Thessaloniciens":"1TH","2 Thessaloniciens":"2TH","1 Timothée":"1TI",
    "2 Timothée":"2TI","Tite":"TIT","Philémon":"PHM","Hébreux":"HEB","Jacques":"JAS",
    "1 Pierre":"1PE","2 Pierre":"2PE","1 Jean":"1JN","2 Jean":"2JN","3 Jean":"3JN",
    "Jude":"JUD","Apocalypse":"REV"
  };
  const code = map[book];
  return code ? `https://www.bible.com/fr/bible/93/${code}.${chapter}.LSG` : "";
}

function mergeIntoTemplate(book, chapter, obj) {
  let t = TEMPLATE.replace("{{BOOK}}", book).replace("{{CHAP}}", String(chapter));
  for (let i = 1; i <= 28; i++) {
    t = t.replace(`{{S${i}}}`, String(obj[`S${i}`] || "—").trim());
  }
  return t;
}

function fallbackMarkdown(book, chapter) {
  const nt = ["Matthieu","Marc","Luc","Jean","Actes","Romains","1 Corinthiens","2 Corinthiens","Galates","Éphésiens","Philippiens","Colossiens","1 Thessaloniciens","2 Thessaloniciens","1 Timothée","2 Timothée","Tite","Philémon","Hébreux","Jacques","1 Pierre","2 Pierre","1 Jean","2 Jean","3 Jean","Jude","Apocalypse"];
  const AT = !nt.includes(book);
  const link = youVersionLink(book, chapter) || "—";
  const obj = {
    S1: `Père céleste, nous venons devant toi pour lire ${book} ${chapter}. Ouvre nos cœurs par ton Saint-Esprit, éclaire notre intelligence et conduis-nous dans la vérité. Au nom de Jésus, amen.`,
    S2: `Le livre de ${book} appartient à l’${AT ? "Ancien" : "Nouveau"} Testament dans le canon biblique.`,
    S3: `(À compléter par l’animateur : préparer au moins 5 questions de révision sur le chapitre précédent — comprendre, appliquer, comparer, retenir.)`,
    S4: `${book} ${chapter} — Titre doctrinal synthétique.`,
    S5: `Contexte : affirmation d’un Dieu unique, personnel et souverain. ${book} ${chapter} s’oppose aux récits païens en plaçant la Parole créatrice de Dieu au centre.`,
    S6: `Structure indicative : jalons majeurs du chapitre pour guider la lecture et la discussion.`,
    S7: `Genre : narratif théologique (prose solennelle).`,
    S8: `Auteur (tradition) : Moïse ; rattaché aux patriarches.`,
    S9: `${book} ${chapter}:1 — Verset de cadrage. (YouVersion : ${link})`,
    S10: `Pistes exégétiques : termes clés, parallèles, progression du discours.`,
    S11: `Mots-clés : liste courte et signification dans le passage.`,
    S12: `Références croisées majeures ; YouVersion : ${link}`,
    S13: `Dieu créateur souverain ; ordre / vocation ; dignité de l’homme.`,
    S14: `Thème : Dieu met de l’ordre et appelle à la vie selon sa Parole.`,
    S15: `Fruits : gratitude, adoration, responsabilité.`,
    S16: `Types : repos / sabbat ; image de Dieu ; ordre de la création.`,
    S17: `Appui : Psaume 8 ; Psaume 104 ; Apocalypse 4:11, etc.`,
    S18: `Comparaisons internes : ouverture, refrain, conclusion.`,
    S19: `Parallèle avec Actes 2 : Parole, lumière, communauté par l’Esprit.`,
    S20: `${book} ${chapter}:1 — « Au commencement… »`,
    S21: `Implications ecclésiales : célébrer Dieu Créateur, dignité humaine.`,
    S22: `Famille : transmettre l’émerveillement devant la création ; gérance.`,
    S23: `Enfants : Dieu a tout créé par amour ; je suis précieux.`,
    S24: `Mission : annoncer que le monde a un Auteur et un sens.`,
    S25: `Pastoral : accompagner les doutes sur la valeur / vocation.`,
    S26: `Personnel : examen et décisions concrètes (gérance, repos, etc.).`,
    S27: `À retenir : ${book} ${chapter}:1 ; ${book} ${chapter}:27 ; Ps 8:4–6 ; Jn 1:3.`,
    S28: `Seigneur, merci pour ta Parole. Aide-nous à la mettre en pratique. Amen.`
  };
  return mergeIntoTemplate(book, chapter, obj);
}

function parseRef(q) {
  if (!q) return { book: "Genèse", chapter: 1 };
  const m = String(q).match(/^(.+?)\s+(\d+)\s*$/);
  if (m) return { book: m[1].trim(), chapter: Number(m[2]) || 1 };
  return { book: String(q).trim() || "Genèse", chapter: 1 };
}

async function askOpenAI_JSON({ book, chapter, version, apiKey }) {
  const schema = {
    type: "object",
    properties: Object.fromEntries(Array.from({ length: 28 }, (_, i) => [`s${i + 1}`, { type: "string" }])),
    required: Array.from({ length: 28 }, (_, i) => `s${i + 1}`),
    additionalProperties: false
  };

  const SYSTEM = `
Tu dois répondre en JSON strict (aucun texte hors JSON), avec exactement 28 clés "s1"..."s28".
Chaque clé contient 3–6 phrases en français, style pastoral, version ${version} pour citations.
Correspondance stricte: s1=>"Prière d’ouverture", ..., s28=>"Prière de fin".
`.trim();

  const link = youVersionLink(book, chapter) || "—";
  const USER = `
Livre="${book}", Chapitre="${chapter}", Version="${version}".
Si utile, inclure "YouVersion : ${link}" dans s9/s12/s20/s27.
Renvoie uniquement un JSON valide.
`.trim();

  const payload = {
    model: "gpt-4o-mini",
    temperature: 0.35,
    max_tokens: 1600,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: USER }
    ]
  };

  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const text = await r.text();
  if (!r.ok) throw new Error(`OpenAI ${r.status}: ${text.slice(0, 200)}`);

  let data;
  try { data = JSON.parse(text); } catch { throw new Error("Réponse OpenAI non JSON"); }
  const raw = data?.choices?.[0]?.message?.content || "";
  let obj;
  try { obj = JSON.parse(raw); } catch { throw new Error("Contenu non JSON renvoyé"); }

  // Validation simple
  for (let i = 1; i <= 28; i++) {
    if (typeof obj[`s${i}`] !== "string") throw new Error(`Champ manquant s${i}`);
  }

  return Object.fromEntries(Array.from({ length: 28 }, (_, i) => [`S${i + 1}`, obj[`s${i + 1}`]]));
}

export default async function handler(req, res) {
  // Toujours capturer pour renvoyer un fallback 200
  try {
    // 1) Lire les query params de façon 100% compatible Node (pas de req.on ici)
    const { searchParams } = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    const q = searchParams.get("q") || "";
    const probe = searchParams.get("probe") === "1";
    const version = searchParams.get("version") || "LSG";

    const { book, chapter } = parseRef(q || "Genèse 1");

    // 2) Si probe => force le fallback pour vérifier la route
    if (probe) {
      const md = fallbackMarkdown(book, chapter);
      res.setHeader("Content-Type", "text/markdown; charset=utf-8");
      return res.status(200).send(md);
    }

    // 3) Sans clé OpenAI → fallback direct (aucun 500)
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      const md = fallbackMarkdown(book, chapter);
      res.setHeader("Content-Type", "text/markdown; charset=utf-8");
      res.setHeader("X-Note", "OPENAI_API_KEY absente → fallback");
      return res.status(200).send(md);
    }

    // 4) Essai OpenAI → sinon fallback
    let sections;
    try {
      sections = await askOpenAI_JSON({ book, chapter, version, apiKey });
    } catch (err) {
      const md = fallbackMarkdown(book, chapter);
      res.setHeader("Content-Type", "text/markdown; charset=utf-8");
      res.setHeader("X-OpenAI-Error", String(err?.message || err));
      return res.status(200).send(md);
    }

    const md = mergeIntoTemplate(book, chapter, sections);
    res.setHeader("Content-Type", "text/markdown; charset=utf-8");
    return res.status(200).send(md);

  } catch (e) {
    // Dernier filet de sécurité : ne JAMAIS rendre un 500 au client
    try {
      const fallback = fallbackMarkdown("Genèse", 1);
      res.setHeader("Content-Type", "text/markdown; charset=utf-8");
      res.setHeader("X-Last-Error", String(e?.message || e));
      return res.status(200).send(fallback);
    } catch {
      // Ultime secours
      return res.status(200).send("# Genèse 1\n\nImpossible de générer, mais la route fonctionne.");
    }
  }
}
