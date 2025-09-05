export const config = { runtime: "edge" };

const API_KEY = process.env.API_BIBLE_KEY;
const DEFAULT_BIBLE_ID = process.env.API_BIBLE_BIBLE_ID || "a93a92589195411f-01";

// Mapping basique des livres FR → OSIS
const BOOK_MAP = {
  "genèse": "GEN",
  "exode": "EXO",
  "lévitique": "LEV",
  "nombres": "NUM",
  "deutéronome": "DEU",
  "josué": "JOS",
  "juges": "JDG",
  "rut": "RUT",
  "1 samuel": "1SA",
  "2 samuel": "2SA",
  "1 rois": "1KI",
  "2 rois": "2KI",
  "1 chroniques": "1CH",
  "2 chroniques": "2CH",
  "esdras": "EZR",
  "néhémie": "NEH",
  "esther": "EST",
  "job": "JOB",
  "psaumes": "PSA",
  "proverbes": "PRO",
  "ecclésiaste": "ECC",
  "cantique des cantiques": "SNG",
  "esaïe": "ISA",
  "jérémie": "JER",
  "lamentations": "LAM",
  "ezéchiel": "EZK",
  "daniel": "DAN",
  "osée": "HOS",
  "joël": "JOL",
  "amos": "AMO",
  "abdias": "OBA",
  "jonas": "JON",
  "michée": "MIC",
  "nahum": "NAM",
  "habacuc": "HAB",
  "sophonie": "ZEP",
  "aggée": "HAG",
  "zacharie": "ZEC",
  "malachie": "MAL",
  "matthieu": "MAT",
  "marc": "MRK",
  "luc": "LUK",
  "jean": "JHN",
  "actes": "ACT",
  "romains": "ROM",
  "1 corinthiens": "1CO",
  "2 corinthiens": "2CO",
  "galates": "GAL",
  "éphésiens": "EPH",
  "philippiens": "PHP",
  "colossiens": "COL",
  "1 thessaloniciens": "1TH",
  "2 thessaloniciens": "2TH",
  "1 timothée": "1TI",
  "2 timothée": "2TI",
  "tite": "TIT",
  "philemon": "PHM",
  "hébreux": "HEB",
  "jacques": "JAS",
  "1 pierre": "1PE",
  "2 pierre": "2PE",
  "1 jean": "1JN",
  "2 jean": "2JN",
  "3 jean": "3JN",
  "jude": "JUD",
  "apocalypse": "REV",
};

function jsonResponse(obj, status = 200) {
  return new Response(JSON.stringify(obj, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

export default async function handler(req) {
  try {
    const { searchParams } = new URL(req.url);

    const action = searchParams.get("action") || "passage";
    const book = (searchParams.get("book") || "").toLowerCase();
    const chapter = searchParams.get("chapter") || "";
    const verses = searchParams.get("verses") || "";
    const bibleId = searchParams.get("bibleId") || DEFAULT_BIBLE_ID;

    if (!API_KEY) {
      return jsonResponse({ ok: false, error: "API_BIBLE_KEY manquant" }, 500);
    }

    if (action === "bibles") {
      const r = await fetch(
        "https://api.scripture.api.bible/v1/bibles?language=fra",
        { headers: { "api-key": API_KEY } }
      );
      const data = await r.json();
      return jsonResponse({ ok: true, data });
    }

    // --- Passage ---
    const osisBook = BOOK_MAP[book];
    if (!osisBook) {
      return jsonResponse({ ok: false, error: `Livre inconnu: "${book}"` }, 400);
    }
    if (!chapter) {
      return jsonResponse({ ok: false, error: "Chapitre manquant" }, 400);
    }

    const osis = verses ? `${osisBook}.${chapter}.${verses}` : `${osisBook}.${chapter}`;

    const url = `https://api.scripture.api.bible/v1/bibles/${bibleId}/passages/${osis}?content-type=text&include-verse-numbers=false&include-chapter-numbers=false&include-titles=false&include-notes=false&include-headings=false&include-footnotes=false&include-crossrefs=false`;

    const r = await fetch(url, { headers: { "api-key": API_KEY } });
    if (!r.ok) {
      return jsonResponse({ ok: false, error: `API.Bible ${r.status}: ${await r.text()}` }, r.status);
    }

    const data = await r.json();
    const passageText = data?.data?.content?.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

    return jsonResponse({
      ok: true,
      data: {
        reference: data?.data?.reference || `${book} ${chapter}`,
        bibleId,
        osis,
        passageText,
        source: "api.bible",
      },
    });
  } catch (err) {
    return jsonResponse({ ok: false, error: err.message || String(err) }, 500);
  }
}
