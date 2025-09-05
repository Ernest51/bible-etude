// /pages/api/study-28.js
export const config = { runtime: "edge" };

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const BIBLE_API_KEY = process.env.API_BIBLE_KEY;
const DEFAULT_BIBLE_ID = process.env.API_BIBLE_BIBLE_ID || "a93a92589195411f-01";

// Mapping FR -> OSIS
const FR2OSIS = {
  "genese": "GEN",
  "genèse": "GEN",
  "exode": "EXO",
  "levitique": "LEV", "lévitique": "LEV",
  "nombres": "NUM",
  "deuteronome": "DEU", "deutéronome": "DEU",
  "jean": "JHN",
};

function frToOsisBook(name) {
  const key = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  return FR2OSIS[key] || null;
}

function jsonResponse(obj, status = 200) {
  return new Response(JSON.stringify(obj, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}

function stripHtml(html = "") {
  return html.replace(/<sup[^>]*>.*?<\/sup>/g, " ")
             .replace(/<[^>]+>/g, " ")
             .replace(/\s+/g, " ")
             .trim();
}

async function fetchPassageText(osis, bibleId) {
  const url = `https://api.scripture.api.bible/v1/bibles/${bibleId}/passages/${osis}?contentType=text&includeVerseNumbers=false&includeChapterNumbers=false&includeTitles=false&paragraphs=false`;
  const r = await fetch(url, { headers: { "api-key": BIBLE_API_KEY } });
  if (!r.ok) {
    throw new Error(`API.Bible ${r.status}: ${await r.text()}`);
  }
  const data = await r.json();
  const text = stripHtml(data?.data?.content ?? "");
  const ref = data?.data?.reference ?? osis;
  return { text, ref };
}

function buildPrompt({ passageText, passageRef, translation }) {
  const titles = Array.from({ length: 28 }, (_, i) => `${i + 1}. Point ${i + 1}`).join("\n");

  return [
    {
      role: "system",
      content: "Tu es un bibliste. Rédige une étude structurée en 28 sections fixes. Langue: français. Sortie strictement JSON."
    },
    {
      role: "user",
      content: [
        `Passage: ${passageRef} (${translation})`,
        "Texte:",
        passageText,
        "",
        "Étude attendue : 28 sections exactement, dans cet ordre strict :",
        titles,
        "",
        "Contraintes de sortie JSON:",
        "{ \"reference\": string, \"translation\": string, \"sections\": Section[] }",
        "Section = { \"index\": number, \"title\": string, \"content\": string }",
        "Pas d’autre texte que du JSON valide."
      ].join("\n")
    }
  ];
}

async function callOpenAI(messages) {
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "authorization": `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      temperature: 0.2,
      messages,
      response_format: { type: "json_object" }
    })
  });

  if (!r.ok) throw new Error(`OpenAI ${r.status}: ${await r.text()}`);
  const data = await r.json();
  return JSON.parse(data.choices[0].message.content);
}

export default async function handler(req) {
  try {
    const { searchParams } = new URL(req.url);
    const book = searchParams.get("book");
    const chapter = searchParams.get("chapter");
    const verse = searchParams.get("verse") || "";
    const translation = searchParams.get("translation") || "JND";
    const bibleId = searchParams.get("bibleId") || DEFAULT_BIBLE_ID;

    if (!OPENAI_API_KEY) return jsonResponse({ ok: false, error: "OPENAI_API_KEY manquant." }, 400);
    if (!BIBLE_API_KEY) return jsonResponse({ ok: false, error: "BIBLE_API_KEY manquant." }, 400);
    if (!book || !chapter) return jsonResponse({ ok: false, error: "book et chapter requis." }, 400);

    const osisBook = frToOsisBook(book);
    if (!osisBook) return jsonResponse({ ok: false, error: `Livre inconnu: "${book}"` }, 400);

    const osis = `${osisBook}.${chapter}${verse ? "." + verse : ""}`;
    const { text: passageText, ref: passageRef } = await fetchPassageText(osis, bibleId);

    const messages = buildPrompt({ passageText, passageRef, translation });
    const study = await callOpenAI(messages);

    return jsonResponse({ ok: true, data: study });
  } catch (err) {
    return jsonResponse({ ok: false, error: err.message }, 500);
  }
}
