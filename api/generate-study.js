// api/generate-study.js
//
// Génère les 28 rubriques pour un livre + chapitre donnés.
// - Utilise api.bible (Darby) pour récupérer le texte du chapitre
// - Construit un objet { reference, version:"DARBY", sections:[{n,title,content}] }
// - Le front insère ensuite chaque "content" dans la note du point correspondant.
//
// ⚙️ Config requise dans l'environnement Vercel (Project Settings > Environment Variables):
//   - API_BIBLE_KEY     : votre clé d'API api.bible
//   - BIBLE_ID_DARBY    : l'ID de la Bible Darby dans api.bible
//     (exemple d'ID possible : "f392f5f5f0b74a1a-01" — à confirmer dans votre compte api.bible)
//   - (optionnel) API_BIBLE_BASE : base URL de l'API (défaut: "https://api.scripture.api.bible/v1")
//
// ✅ Cette route répond à:
//   - GET /api/generate-study?book=Jean&chapter=3&version=DARBY
//   - HEAD → 200 (health-check)

const API_KEY = process.env.API_BIBLE_KEY || process.env.APIBIBLE_KEY || "";
const BIBLE_ID = process.env.BIBLE_ID_DARBY || "YOUR_DARBY_BIBLE_ID"; // ← remplacez par l'ID Darby de votre compte
const API_BASE = process.env.API_BIBLE_BASE || "https://api.scripture.api.bible/v1";

const fetchFn = globalThis.fetch || (await import("node-fetch")).default;

// Mapping FR → OSIS (passageId = <OSISBook>.<chapitre>)
const FR_TO_OSIS = {
  "Genèse":"Gen", "Exode":"Exod", "Lévitique":"Lev", "Nombres":"Num", "Deutéronome":"Deut",
  "Josué":"Josh", "Juges":"Judg", "Ruth":"Ruth",
  "1 Samuel":"1Sam","2 Samuel":"2Sam","1 Rois":"1Kgs","2 Rois":"2Kgs",
  "1 Chroniques":"1Chr","2 Chroniques":"2Chr","Esdras":"Ezra","Néhémie":"Neh","Esther":"Esth",
  "Job":"Job","Psaumes":"Ps","Proverbes":"Prov","Ecclésiaste":"Eccl","Cantique des Cantiques":"Song",
  "Ésaïe":"Isa","Jérémie":"Jer","Lamentations":"Lam","Ézéchiel":"Ezek","Daniel":"Dan",
  "Osée":"Hos","Joël":"Joel","Amos":"Amos","Abdias":"Obad","Jonas":"Jonah","Michée":"Mic",
  "Nahum":"Nah","Habacuc":"Hab","Sophonie":"Zeph","Aggée":"Hag","Zacharie":"Zech","Malachie":"Mal",
  "Matthieu":"Matt","Marc":"Mark","Luc":"Luke","Jean":"John","Actes":"Acts","Romains":"Rom",
  "1 Corinthiens":"1Cor","2 Corinthiens":"2Cor","Galates":"Gal","Éphésiens":"Eph","Philippiens":"Phil",
  "Colossiens":"Col","1 Thessaloniciens":"1Thess","2 Thessaloniciens":"2Thess","1 Timothée":"1Tim",
  "2 Timothée":"2Tim","Tite":"Titus","Philémon":"Phlm","Hébreux":"Heb","Jacques":"Jas",
  "1 Pierre":"1Pet","2 Pierre":"2Pet","1 Jean":"1John","2 Jean":"2John","3 Jean":"3John",
  "Jude":"Jude","Apocalypse":"Rev"
};

// Récupère les titres/hints de tes 28 rubriques en appelant l’API locale /api/study-28
async function loadStudyPoints(req) {
  const proto = req.headers["x-forwarded-proto"] || "https";
  const host  = req.headers.host;
  try {
    const r = await fetchFn(`${proto}://${host}/api/study-28`, { method: "GET" });
    if (!r.ok) throw new Error("study-28 HTTP " + r.status);
    const arr = await r.json();
    if (Array.isArray(arr) && arr.length) return arr;
    throw new Error("study-28 format");
  } catch (e) {
    // Fallback — 28 placeholders
    return Array.from({ length: 28 }, (_, i) => ({ title: `Point ${i+1}`, hint: "" }));
  }
}

// Appel api.bible (Darby) pour un chapitre — essaie en mode texte "content-type=text"
async function fetchDarbyChapter(bookFr, chapter) {
  if (!API_KEY || !BIBLE_ID) {
    throw new Error("Configuration manquante: API_BIBLE_KEY et/ou BIBLE_ID_DARBY.");
  }
  const osisBook = FR_TO_OSIS[bookFr];
  if (!osisBook) {
    throw new Error(`Livre non reconnu: "${bookFr}" (ajouter au mapping FR_TO_OSIS si besoin)`);
  }
  const passageId = `${osisBook}.${chapter}`;

  const url = `${API_BASE}/bibles/${encodeURIComponent(BIBLE_ID)}/passages/${encodeURIComponent(passageId)}?content-type=text&include-chapter-numbers=false&include-verse-numbers=true&include-verse-spans=false&use-org-id=false`;
  const r = await fetchFn(url, {
    headers: {
      "accept": "application/json",
      "api-key": API_KEY
    }
  });
  if (!r.ok) {
    const t = await r.text().catch(()=> "");
    throw new Error(`api.bible ${r.status} ${r.statusText} — ${t.slice(0,200)}`);
  }
  const data = await r.json();
  // L'API peut renvoyer data.data.content (texte) ou data.data.passages[0].content selon les bibles/params.
  const d = data && (data.data || data.result || data);
  const content =
    (d && d.content) ||
    (d && Array.isArray(d.passages) && d.passages[0] && d.passages[0].content) ||
    "";

  // Normalisation: supprime tags éventuels si jamais l'API renvoie encore un peu de HTML
  const text = String(content)
    .replace(/<[^>]+>/g, "")
    .replace(/\u00A0/g, " ")
    .replace(/\s+\n/g, "\n")
    .trim();

  return { passageId, text };
}

// Fabrique 28 sections en se basant sur tes titres + le texte Darby récupéré
function buildSections(points, book, chapter, darbyText) {
  const reference = `${book} ${chapter}`;
  const intro =
`*Texte source*: ${reference} — DARBY

${darbyText ? darbyText.slice(0, 1200) + (darbyText.length > 1200 ? "\n[…]" : "") : "_(texte indisponible)_"}
`;

  const sections = points.map((p, idx) => {
    const n = idx + 1;
    let content = "";
    if (n === 1) {
      content =
`Prière: Seigneur, ouvre nos yeux et nos coeurs afin que ${reference} (DARBY) éclaire notre foi et notre marche. Amen.

${intro}`;
    } else if (n === 4 && /Titre du chapitre/i.test(p.title || "")) {
      // Petite valeur ajoutée: propose un titre si le livre+chapitre est donné
      content = `Proposition de titre pour **${reference}** : _à préciser selon l'axe doctrinal identifié_.\n\n${intro}`;
    } else if (n === 9 && /Verset-clé/i.test(p.title || "")) {
      content = `Choisir un verset pivot de **${reference}** (DARBY), l'écrire intégralement et expliquer en quelques lignes pourquoi il structure la compréhension du chapitre.\n\n${intro}`;
    } else {
      content = `Élabore ce point en t'appuyant prioritairement sur **${reference}** (DARBY).\n\n${intro}`;
    }
    return { n, title: p.title || `Point ${n}`, content };
  });

  return { reference, version: "DARBY", sections };
}

export default async function handler(req, res) {
  if (req.method === "HEAD") {
    res.status(200).end();
    return;
  }
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET, HEAD");
    res.status(405).json({ error: "Method Not Allowed" });
    return;
  }

  const { book, chapter, version } = req.query || {};

  const bookFr   = (book || "").toString().trim();
  const chapterN = (chapter || "").toString().trim();
  const ver      = (version || "DARBY").toString().trim().toUpperCase();

  if (!bookFr || !chapterN) {
    res.status(400).json({ error: "Paramètres requis: book, chapter" });
    return;
  }
  if (ver !== "DARBY") {
    // On force DARBY comme demandé
    // (le front envoie déjà DARBY, mais on verrouille côté serveur)
  }

  try {
    const [points, passage] = await Promise.all([
      loadStudyPoints(req),
      fetchDarbyChapter(bookFr, chapterN)
    ]);

    const payload = buildSections(points, bookFr, chapterN, passage.text || "");
    // Caching court (1 min) pour lisser la charge
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "private, max-age=60");
    res.status(200).json(payload);
  } catch (e) {
    // Remonte quand même une structure exploitable par le front
    const points = await loadStudyPoints(req);
    const { reference, version, sections } = buildSections(points, bookFr, chapterN, "");
    res.status(200).json({
      reference,
      version,
      sections,
      warning: "Génération partielle: " + (e && e.message ? e.message : "erreur inconnue")
    });
  }
}
