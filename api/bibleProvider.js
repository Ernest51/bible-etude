// api/bibleProvider.js
export const config = { runtime: "edge" };

// Correction : accepte les 2 variantes
const BIBLE_API_KEY = process.env.BIBLE_API_KEY || process.env.API_BIBLE_KEY;
const BIBLE_ID      = process.env.BIBLE_ID || process.env.API_BIBLE_BIBLE_ID;

function jsonResponse(obj, status = 200) {
  return new Response(JSON.stringify(obj, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}

// Strip balises HTML et numéros
function stripHtml(html = "") {
  return html
    .replace(/<sup[^>]*>.*?<\/sup>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Récupère un passage
async function fetchPassage(book, chapter, verses) {
  if (!BIBLE_API_KEY || !BIBLE_ID) {
    throw new Error("BIBLE_API_KEY ou BIBLE_ID manquant(s) dans les variables d’environnement.");
  }

  const osis = `${book.slice(0,3).toUpperCase()}.${chapter}`;
  const url = `https://api.scripture.api.bible/v1/bibles/${encodeURIComponent(
    BIBLE_ID
  )}/passages/${encodeURIComponent(osis)}${
    verses ? `.${verses}` : ""
  }?contentType=text&includeVerseNumbers=false&includeChapterNumbers=false&includeTitles=false&paragraphs=false`;

  const r = await fetch(url, { headers: { "api-key": BIBLE_API_KEY } });
  if (!r.ok) {
    const msg = await r.text();
    throw new Error(`API.Bible ${r.status}: ${msg}`);
  }
  const data = await r.json();

  return {
    reference: data?.data?.reference ?? `${book} ${chapter}`,
    bibleId: BIBLE_ID,
    osis,
    passageText: stripHtml(data?.data?.content ?? ""),
    items: [
      {
        v: 0,
        text: stripHtml(data?.data?.content ?? "")
      }
    ],
    source: "api.bible"
  };
}

// Liste des bibles FR
async function fetchBibles(language = "fra") {
  if (!BIBLE_API_KEY) {
    throw new Error("BIBLE_API_KEY manquant");
  }

  const url = `https://api.scripture.api.bible/v1/bibles?language=${language}`;
  const r = await fetch(url, { headers: { "api-key": BIBLE_API_KEY } });
  if (!r.ok) {
    const msg = await r.text();
    throw new Error(`API.Bible ${r.status}: ${msg}`);
  }
  const data = await r.json();
  return data?.data ?? [];
}

// ---------------- handler ----------------
export default async function handler(req) {
  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action") || "passage";

    if (action === "bibles") {
      const lang = searchParams.get("language") || "fra";
      const bibles = await fetchBibles(lang);
      return jsonResponse({ ok: true, data: bibles });
    }

    const book = searchParams.get("book");
    const chapter = searchParams.get("chapter");
    const verses = searchParams.get("verses");

    if (!book || !chapter) {
      return jsonResponse({ ok: false, error: "Paramètres book et chapter requis" }, 400);
    }

    const passage = await fetchPassage(book, chapter, verses);
    return jsonResponse({ ok: true, data: passage });
  } catch (err) {
    return jsonResponse({ ok: false, error: err.message }, 500);
  }
}
