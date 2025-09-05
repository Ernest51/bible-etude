export const config = { runtime: "edge" };

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const API_KEY = process.env.API_BIBLE_KEY;
const DEFAULT_BIBLE_ID = process.env.API_BIBLE_BIBLE_ID || "a93a92589195411f-01";

function jsonResponse(obj, status = 200) {
  return new Response(JSON.stringify(obj, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

async function fetchPassage(bibleId, osis) {
  const url = `https://api.scripture.api.bible/v1/bibles/${bibleId}/passages/${osis}?content-type=text&include-verse-numbers=false&include-chapter-numbers=false&include-titles=false&include-notes=false&include-headings=false&include-footnotes=false&include-crossrefs=false`;

  const r = await fetch(url, { headers: { "api-key": API_KEY } });
  if (!r.ok) throw new Error(`API.Bible ${r.status}: ${await r.text()}`);

  const data = await r.json();
  const passageText = data?.data?.content?.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

  return {
    passageText,
    reference: data?.data?.reference || osis,
    wordsCount: passageText.split(/\s+/).length,
  };
}

function buildPrompt(passageText, reference, translation) {
  return [
    {
      role: "system",
      content:
        "Tu es un bibliste pédagogue. Génère une étude en **28 sections** fixes, en français, dans un format JSON clair.",
    },
    {
      role: "user",
      content: `Passage: ${reference} (${translation})
Texte: """${passageText}"""

Sortie STRICTE attendue:

{
  "reference": "...",
  "translation": "...",
  "sections": [
    { "index": 1, "title": "...", "content": "...", "verses": ["v.1-3"] },
    ...
    { "index": 28, "title": "...", "content": "...", "verses": [] }
  ]
}

Contraintes :
- EXACTEMENT 28 sections numérotées.
- "title" = un des titres fixes de la trame.
- "content" = 4 à 8 phrases claires.
- "verses" = liste des versets du passage utilisés.
Aucune autre sortie que ce JSON valide.
`,
    },
  ];
}

export default async function handler(req) {
  try {
    const { searchParams } = new URL(req.url);
    const book = searchParams.get("book") || "";
    const chapter = searchParams.get("chapter") || "";
    const verses = searchParams.get("verses") || "";
    const translation = searchParams.get("translation") || "JND";
    const bibleId = searchParams.get("bibleId") || DEFAULT_BIBLE_ID;

    if (!API_KEY) throw new Error("API_BIBLE_KEY manquant dans les variables d’environnement.");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY manquant dans les variables d’environnement.");

    if (!book || !chapter) {
      return jsonResponse({ ok: false, error: "Paramètres 'book' et 'chapter' requis." }, 400);
    }

    // ⚡ Mapping OSIS minimal (on peut réutiliser celui du provider)
    const MAP = { genèse: "GEN", jean: "JHN" };
    const osisBook = MAP[book.toLowerCase()];
    if (!osisBook) return jsonResponse({ ok: false, error: `Livre non mappé: ${book}` }, 400);

    const osis = verses ? `${osisBook}.${chapter}.${verses}` : `${osisBook}.${chapter}`;
    const { passageText, reference, wordsCount } = await fetchPassage(bibleId, osis);

    const messages = buildPrompt(passageText, reference, translation);

    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        temperature: 0.2,
        messages,
        response_format: { type: "json_object" },
      }),
    });

    if (!r.ok) throw new Error(`OpenAI ${r.status}: ${await r.text()}`);

    const data = await r.json();
    const parsed = JSON.parse(data.choices[0].message.content);

    return jsonResponse({
      ok: true,
      data: {
        meta: { book, chapter, translation, wordsCount },
        ...parsed,
      },
    });
  } catch (err) {
    return jsonResponse({ ok: false, error: err.message || String(err) }, 500);
  }
}
