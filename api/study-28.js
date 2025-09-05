// api/study-28.js
export const config = { runtime: "edge" };

// ---------- ENV ----------
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL   = process.env.OPENAI_MODEL || "gpt-4o-mini";

// Correction : accepte BIBLE_API_KEY ou API_BIBLE_KEY
const BIBLE_API_KEY  = process.env.BIBLE_API_KEY || process.env.API_BIBLE_KEY;
// Correction : accepte BIBLE_ID ou API_BIBLE_BIBLE_ID
const BIBLE_ID       = process.env.BIBLE_ID || process.env.API_BIBLE_BIBLE_ID;

// ---------- 28 points (titres modifiables pour coller à ta trame) ----------
const STUDY_TITLES = [
  "Thème central",
  "Résumé en une phrase",
  "Contexte historique",
  "Auteur et date",
  "Genre littéraire",
  "Structure du passage",
  "Plan détaillé",
  "Mots-clés",
  "Termes clés (définis)",
  "Personnages et lieux",
  "Problème / Question de départ",
  "Idées majeures (développement)",
  "Verset pivot (climax)",
  "Références croisées (AT)",
  "Références croisées (NT)",
  "Parallèles bibliques",
  "Lien avec l’Évangile (Christocentrique)",
  "Vérités doctrinales (3–5)",
  "Promesses et avertissements",
  "Principes intemporels",
  "Applications personnelles (3–5)",
  "Applications communautaires",
  "Questions pour petits groupes (6)",
  "Prière guidée",
  "Méditation courte",
  "Versets à mémoriser (2–3)",
  "Difficultés/objections & réponses",
  "Ressources complémentaires"
];

// ---------- Utils ----------
function jsonResponse(obj, status = 200) {
  return new Response(JSON.stringify(obj, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}

function stripHtml(html = "") {
  return html
    .replace(/<sup[^>]*>.*?<\/sup>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Récupère un passage via API.Bible
async function fetchPassageText(osis) {
  if (!BIBLE_API_KEY || !BIBLE_ID) {
    throw new Error("BIBLE_API_KEY ou BIBLE_ID manquant(s) dans les variables d’environnement.");
  }

  const url = `https://api.scripture.api.bible/v1/bibles/${encodeURIComponent(
    BIBLE_ID
  )}/passages/${encodeURIComponent(
    osis
  )}?contentType=text&includeVerseNumbers=false&includeChapterNumbers=false&includeTitles=false&paragraphs=false`;

  const r = await fetch(url, { headers: { "api-key": BIBLE_API_KEY } });
  if (!r.ok) {
    const msg = await r.text();
    throw new Error(`API.Bible ${r.status}: ${msg}`);
  }
  const data = await r.json();
  const text = stripHtml(data?.data?.content ?? "");
  const ref  = data?.data?.reference ?? osis;
  return { text, ref };
}

// Construit le prompt OpenAI
function buildPrompt({ passageText, passageRef, translation }) {
  const titlesNumbered = STUDY_TITLES.map((t, i) => `${i + 1}. ${t}`).join("\n");

  return [
    {
      role: "system",
      content: [
        "Tu es un bibliste pédagogue.",
        "Produis une étude *structurée et concise* en **28 sections** fixes.",
        "Langue: **français**, ton pastoral mais rigoureux.",
        "NE PAS inventer de versets; cite uniquement le passage fourni.",
        "Ta sortie DOIT être STRICTEMENT du JSON conforme au schéma demandé."
      ].join(" ")
    },
    {
      role: "user",
      content: [
        `Passage: ${passageRef} (${translation}).`,
        "Texte fourni ci-dessous (utilise-le comme base unique pour l’exégèse) :",
        "```",
        passageText,
        "```",
        "",
        "Étude attendue : 28 sections exactement, dans cet ordre strict :",
        titlesNumbered,
        "",
        "Contraintes de sortie JSON:",
        "- root object:",
        '  { "reference": string, "translation": string, "sections": Section[] }',
        "- Section:",
        '  { "index": number (1..28), "title": string, "content": string, "verses": string[] }',
        "- `content` doit être clair et actionnable (4–10 phrases max par section).",
        "- `verses` = liste de références locales au passage (ex: [\"v.1-3\", \"v.26\"]).",
        "Aucune autre clé que celles indiquées. Aucun texte hors JSON."
      ].join("\n")
    }
  ];
}

// Appel OpenAI
async function callOpenAI(messages) {
  if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY manquant.");

  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      temperature: 0.2,
      messages,
      response_format: { type: "json_object" }
    })
  });

  if (!r.ok) {
    const msg = await r.text();
    throw new Error(`OpenAI ${r.status}: ${msg}`);
  }
  const data = await r.json();
  return data?.choices?.[0]?.message?.content ?? "";
}

// ---------------- handler ----------------
export default async function handler(req) {
  try {
    if (req.method !== "POST") {
      return jsonResponse({ ok: false, error: "Method Not Allowed" }, 405);
    }

    const body = await req.json();
    const { book, chapter, verse, translation, bibleId } = body;

    if (!book || !chapter) {
      return jsonResponse({ ok: false, error: "Champs 'book' et 'chapter' obligatoires" }, 400);
    }

    const osis = `${book.slice(0,3).toUpperCase()}.${chapter}`;
    const { text: passageText, ref: passageRef } = await fetchPassageText(osis);

    const messages = buildPrompt({
      passageText,
      passageRef,
      translation: translation || "LSG"
    });

    const content = await callOpenAI(messages);

    return jsonResponse({ ok: true, data: JSON.parse(content) });
  } catch (err) {
    return jsonResponse({ ok: false, error: err.message }, 500);
  }
}
