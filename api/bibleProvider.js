// /pages/api/bibleProvider.js
export const config = { runtime: "edge" };

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

export default async function handler(req) {
  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action") || "passage";

    if (!BIBLE_API_KEY) {
      return jsonResponse({ ok: false, error: "API_BIBLE_KEY manquant dans les variables d’environnement." }, 400);
    }

    if (action === "bibles") {
      const lang = searchParams.get("language") || "fra";
      const url = `https://api.scripture.api.bible/v1/bibles?language=${lang}`;
      const r = await fetch(url, { headers: { "api-key": BIBLE_API_KEY } });
      const data = await r.json();
      return jsonResponse({ ok: true, data: data.data });
    }

    // Passage par défaut
    const book = searchParams.get("book");
    const chapter = searchParams.get("chapter");
    const verse = searchParams.get("verse") || "";
    const bibleId = searchParams.get("bibleId") || DEFAULT_BIBLE_ID;

    if (!book || !chapter) {
      return jsonResponse({ ok: false, error: "Paramètres manquants: book et chapter requis." }, 400);
    }

    const osisBook = frToOsisBook(book);
    if (!osisBook) {
      return jsonResponse({ ok: false, error: `Livre inconnu: "${book}"` }, 400);
    }

    const osis = `${osisBook}.${chapter}${verse ? "." + verse : ""}`;
    const url = `https://api.scripture.api.bible/v1/bibles/${bibleId}/passages/${osis}?contentType=text&includeVerseNumbers=false&includeChapterNumbers=false&includeTitles=false&paragraphs=false`;

    const r = await fetch(url, { headers: { "api-key": BIBLE_API_KEY } });
    if (!r.ok) {
      const msg = await r.text();
      return jsonResponse({ ok: false, error: `API.Bible ${r.status}: ${msg}` }, r.status);
    }

    const data = await r.json();
    const passageText = stripHtml(data?.data?.content ?? "");
    const ref = data?.data?.reference ?? osis;

    return jsonResponse({
      ok: true,
      data: {
        reference: ref,
        bibleId,
        osis,
        passageText,
        items: [{ v: 0, text: passageText }],
        source: "api.bible"
      }
    });
  } catch (err) {
    return jsonResponse({ ok: false, error: err.message }, 500);
  }
}
